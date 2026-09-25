# ADR-0030: ジョブ進捗SSEは現在状態の同期とする

- ステータス: 承認
- 日付: 2026-09-25
- 関連: [ADR-0028](0028-work-management-mutation-ownership.md)（作品変更後のキャッシュ更新）、[ADR-0029](0029-root-reconfiguration-workflow.md)（root再設定。ジョブの取消と409ロック）、[仕様レビュー2026-09-20 S2](../specification-review-2026-09-20.md)、backlog TASK-470・470.1・470.2

## 文脈

scanジョブは完全な `ScanJobSnapshot` を持ちながら、ジョブごとに最大128件のイベント履歴とsequenceを持ち、SSEフレームの `id` にsequenceを載せていた。再接続時は `Last-Event-ID` から履歴を差分再生し、履歴が切り詰められていれば `reset` で現在snapshotを送る。routeには再生分とlive分を区別するキューとprogressの圧縮処理があった。それでも全履歴を保証するわけではなく、保持範囲内の再接続差分を追従するだけだった。クライアントは接続エラーや終端イベントのたびに `GET /api/scan/:id` で取り直しており、sequenceを使っていなかった。

DLsite一括取得のサーバーは履歴もsequenceも持たず、購読時に直近のprogressか直近の終端を1件返すだけだった。ただしジョブIDが無く、`GET /api/dlsite/bulk` やイベントがどのジョブのものかを区別できなかった。サーバーは終端を配信した直後に待機キューの次のジョブ（新規作品の自動取得など）を始めるため、終端後や再接続後に見える状態は、追跡していたジョブのものとは限らなかった。クライアントの `DlsiteBulkRuntime` は、自分で開始した直後の購読だけ「progressを全部見た」とみなし（`freshStartRef`）、後乗りや再接続があれば取りこぼしの可能性ありとして（`missedProgress`）、progressで見たWork IDの集合と合わせて完了後の作品詳細の無効化範囲を決めていた。受信履歴の完全性がキャッシュ整合性の条件になっていた。

画面が必要とするのは現在のphase・件数と最後の結果で、切断中の中間イベントを順に見せ直す体験は提供していない。

## 決定

### 進捗＝現在状態

ジョブの進捗SSEは、サーバーが持つジョブの現在状態をクライアントへ同期する経路とする。イベントの列を記録・再生する台帳ではない。中間のprogressは欠けても、間引かれてもよい。

残す要素:

- ジョブID（scanは既存、DLsiteは本ADRで加える）と、実行中ジョブの発見（`GET /api/scan/active`、`GET /api/dlsite/bulk`）
- 取消（`DELETE /api/scan/:id`、`DELETE /api/dlsite/bulk`）
- 完了結果（`GET /api/scan/:id`、`GET /api/scan/last`、`GET /api/dlsite/bulk` の `lastTerminal`）
- heartbeat（scanの15秒間隔の `ping`。間隔と扱いは変えない）

外す要素:

- ジョブごとのイベント履歴と保持上限
- sequence（イベントの `seq`、SSEフレームの `id`）
- `Last-Event-ID` による差分再生（ヘッダは読まない）
- 履歴切れ時の `reset` イベント
- routeの再生用キューとprogressの圧縮

### scanの契約

`GET /api/scan/:id/events`:

- 接続時、サーバーはまず現在snapshotを `state` イベントで1件送る。以後はliveの `state`・`progress`・終端（`completed`・`failed`・`cancelled`）を送る。
- 接続時点でジョブが終端済みなら、終端snapshotの `state` を1件送って閉じる。
- イベントの種別は `state`・`progress`・`completed`・`failed`・`cancelled` の5種で、どれも `seq` を持たない。

### DLsiteの契約

DLsite一括取得のジョブにIDを採番する。IDはジョブを待機キューへ積んだ時点で決める。

- `POST /api/dlsite/bulk` → 202 `{ jobId }`。開始したクライアントは応答のIDを追跡する。
- `GET /api/dlsite/bulk` → 200 `{ current, lastTerminal }`。
  - `current`: 実行中ジョブ `{ jobId, status: "running" | "cancelling", progress }`、無ければ `null`
  - `lastTerminal`: 直近に終わったジョブ `{ jobId, status: "complete" | "cancelled", result }` または `{ jobId, status: "error", message }`、無ければ `null`
  - 204は廃止する。実行中のジョブと直近の終端は同時に存在しうる（終端の直後に次のジョブが始まる）ため、両方を並べた形にする。未実行は両方 `null` で表せるので、本文なしの応答を別に残す理由がない。
- `GET /api/dlsite/events` の `progress`・`cancelling`・`complete`・`cancelled`・`error` の各イベントに `jobId` を載せる。購読時に実行中なら直近のprogress、実行中でなければ直近の終端を1件送り、以後liveを送って終端で閉じる。
- `DlsiteBulkResult` の中身は変えない。

### 完了を失わない規則

scanとDLsiteで共通の原則とする。

- サーバーの購読は、現在状態の取得とlistenerの登録を同期的に1手で行う。取得と登録のあいだに終端が挟まって失われる隙間を作らない。
- クライアントは追跡中のジョブIDを持ち、終端イベントを受けたとき、接続エラーのとき、再接続のときに、ジョブID単位のGETでそのジョブの状態を確定してから後処理する。イベントの中身は確定のきっかけとして使い、後処理の根拠にはしない。
- scanは `GET /api/scan/:id` で確定する。
- DLsiteは `GET /api/dlsite/bulk` の応答を追跡中のジョブXと照合する。
  - `lastTerminal.jobId` がXなら、その結果で後処理する（結果の通知、キャッシュ更新）。
  - `current.jobId` がXなら、追跡を続ける。
  - どちらでもなければ、Xは切断中などに終わって結果が分からない。結果の通知はせず、終端と同じキャッシュ更新を行ってXの追跡を終える。`current` があればそのジョブの追跡へ移る。
  - 追跡中でないIDのイベントを受けたら、同じくGETで確定する。

### 古い接続の上書き防止

新しい機構は作らず、既存の2つを残す。

- 接続世代: 接続やGETの応答は、発行時の世代が現在の世代と一致するときだけ反映する。scanとDLsiteは `client/src/shared/api/sseTransport.ts` の `createSseGeneration` を共通に使う。
- scanの状態順序: 同じジョブについて、終端済みの状態や、より前の状態（`queued` < `running` < `cancelling` < 終端）への後退は反映しない。

### DLsite一括取得の終端でのキャッシュ更新

一括取得の終端（完了・取消・エラー・結果不明の終端）では、一覧系・facet・タグ・スマートフォルダー・通知と、全作品詳細（`["work"]` 前方一致）を常に無効化する。progressは画面表示にだけ使い、キャッシュ更新の判断には使わない。[ADR-0028](0028-work-management-mutation-ownership.md) の「DLsite 一括取得の完了」の必須更新（処理対象の詳細だけを無効化し、取りこぼしの可能性があれば全詳細）は、この決定で置き換える。

終端結果（`DlsiteBulkResult`）にサーバー確定の対象Work IDを載せて詳細を選択的に無効化する方式は採らない。無効化でTanStack Queryが再取得するのはactiveなobserverを持つクエリだけで、一括取得後に全詳細を無効化しても実際に再取得されるのは開いている詳細の数件にとどまる。選択性のために結果の契約を拡張すると、一括取得結果API（失敗内訳・個別再取得導線、DRAFT-76）が決める結果契約の拡張と重なる。ジョブIDはどのジョブの状態かを識別するためのもので、結果の中身の拡張ではない。

### 他のADRとの関係

root再設定（[ADR-0029](0029-root-reconfiguration-workflow.md) の「API契約」節）の409ロック中は、scanとDLsiteのSSE接続とGETも `root_reconfiguring` で拒否される。クライアントはこれを受けたら追跡を終える（scanは追跡状態のリセット、DLsiteは購読の解除と進捗表示の後片付け）。本ADRの「接続エラーのたびにGETで確定する」規則は、この409の扱いを変えない。

## 帰結

- scanのサーバーからジョブ内の履歴管理が消え、DLsiteと同じ「購読時に現在状態を1件、以後live」の形にそろう。
- scanとDLsiteのクライアントが、どちらも「追跡中のジョブIDをGETで確定する」同じ規則で終端を扱う。
- クライアントのキャッシュ整合性が、progressを最初から全部受け取れたかどうかに依存しなくなる。切断中に追跡中のジョブが終わって次のジョブへ進んでも、無効化は漏れない。
- 保持範囲内の再接続で中間progressを順に追従する挙動はなくなる。切断中の進捗は、再接続後の現在状態で置き換わる。
- DLsite一括取得の後は、開いている作品詳細が処理対象でなくても1回再取得される。
- DLsiteのサーバーが覚える終端は直近の1件だけなので、追跡中のジョブの終端から確定のGETまでのあいだに次のジョブまで終わると、そのジョブは結果不明の終端として扱われ、結果の通知が出ない。キャッシュ更新は行われる。
