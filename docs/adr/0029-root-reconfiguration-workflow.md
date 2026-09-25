# ADR-0029: root変更を再設定ワークフローとして扱う

- ステータス: 承認
- 日付: 2026-09-25
- 関連: [ADR-0002](0002-mock-as-fixture-adapter.md)（fixtureアダプタ）、[ADR-0008](0008-persistence-topology-query-ownership-playback-ids.md)（catalog/user DBの分離）、[ADR-0017](0017-meta-source-projection-and-work-identity.md)（Work UUIDとuser状態）、[仕様レビュー2026-09-20 S1](../specification-review-2026-09-20.md)、backlog TASK-469・469.1・469.2

## 文脈

root変更は `PUT /api/settings` による設定値の即時更新だった。realアダプタはパスを検証して user DB の `root_folder` を書き換え、候補の除外と候補sessionを破棄するだけで、catalogは次のスキャンまで旧rootの内容を持つ。Files と未登録メディアは新rootを、Library は旧rootのcatalogを見る状態が、スキャンが終わるまで続く。実行中のscanやDLsite一括取得も、root変更をまたいで動き続ける。

設定・公開catalog・メディア配信・ジョブがそれぞれ違う時点のrootを前提にするため、どのライブラリの資源を扱っているかが操作ごとに揺れる。catalog と user DB は別ファイルで、一つのtransactionでは切り替えられない。途中で止まったとき、どこまで切り替わったかを判断できる境界もなかった。

## 決定

root変更を、単一の管理対象を作り直す明示的な操作（再設定）にする。旧rootを使いながら新rootを準備する段階切替、世代管理、旧世代メディアのlease、複数ライブラリ管理は作らない。

### 状態遷移

```text
通常運用(idle) ──開始──▶ 再設定中(running) ──成功──▶ 通常運用(idle)
                               │
                               └──失敗/中断──▶ 失敗(failed) ──再試行──▶ 再設定中(running)
```

- 再設定中と失敗のあいだ、通常の操作APIは閉じる（後述の操作ロック）。
- 取消は作らない。失敗から抜ける手段は再試行だけで、旧rootへ戻す場合も旧パスを指定して再試行する。取消を作ると、root確定後に削除したcatalog行や破棄した候補除外を元に戻す処理が要り、catalog と user DB をまたぐ復元を正しく作る必要が生じる。再設定は同じ手順を別のrootで実行すれば旧状態に戻れるため、取消は再試行で代替できる。
- 初回設定（`root_folder` が未設定）も同じ開始操作で行う。rootを確定してcatalogを構築する手順は再設定と同一で、分ける理由がない。

### 永続化

user DB の `app_settings` に `root_reconfiguration` キーを置き、値をJSONで持つ。

- `{"phase":"running"}`: 再設定を開始した。
- `{"phase":"failed","message":"..."}`: catalog構築に失敗した。
- キーなし: 通常運用。

`root_folder` と `root_reconfiguration` は同じ user DB transaction で書く。検証に成功した時点で `root_folder` を新rootに確定し、同時に `running` を書く。完了時にキーを消す。

サーバー再起動後に `running` が残っていれば、構築の途中で停止したことを意味する。プロセス内に実行中の構築がないとき、ワークフローは永続値の `running` を「失敗（中断）」として公開する。永続値は書き換えず、次の再試行で上書きする。

### 開始・再試行の手順

開始と再試行は同じ操作で、前提だけが違う。通常運用・失敗のどちらからでも受け付け、再設定中なら409で拒否する。

1. 指定パスを検証する（realは `realpath` とディレクトリ判定）。失敗したら400を返し、状態は変えない。失敗状態からの再試行で検証に失敗した場合も、失敗状態はそのまま残る。
2. プロセス内の状態を再設定中にする。この時点から操作ロックが効き、新しいscan開始やDLsite一括取得の要求は拒否される。ただしロック確立前に既にロック判定を通過した要求（ストリーミングbody受信中など）はそのまま進行しうるため、これらの受理済み要求が完了するまで待つ。
3. 実行中のscanジョブとDLsite一括ジョブを取り消し、終了を待つ（`ScanJobManager.cancelActiveAndAwait` → `DlsiteJobManager.cancelActiveAndAwait`）。DLsiteの待機キューも破棄する。
4. `root_folder` と `running` を永続化する。rootが変わる場合は候補除外と候補sessionも破棄する（TASK-459の意味論を引き継ぐ）。ここで202を返し、以降はバックグラウンドで進む。
5. catalogを新rootで作り直す。新rootの配下にない作品のcatalog行を削除してから、新rootをフルスキャンする。フルスキャンがcatalogと候補プールを構築する。
6. 成功したら `root_reconfiguration` を消して通常運用へ戻る。構築結果はスキャンの直近完了結果（`GET /api/scan/last`）として記録し、新規作品はスキャン完了時と同じくDLsite取得（`new`）へ渡す。
7. 失敗したら `failed` とメッセージを永続化する。

サーバー終了時は構築を中断して待つ。永続値は `running` のまま残り、次回起動で中断として扱われる。

### 旧rootの作品とuser状態

新rootの配下にない作品は、catalogから行ごと削除する（tags・DLsite投影・playlist・trackを含む）。missing扱いでは残さない。旧rootのmissing一覧は、再設定後のLibraryに現れない。

user状態（再生履歴・ブックマーク・レジューム等）はWork UUIDをキーに user DB に残す。削除しない。同じ `mimimilli.json` を持つ作品が新rootで見つかれば、同じUUIDで投影され、user状態がそのまま結び付く。旧rootへ戻す再試行でも同じ。

削除をフルスキャンより先に行うのは、ライブラリを別ドライブへ移したときに、旧rootの行が残っていると同じUUIDの作品を別パスの重複として扱うためである。

### 操作ロック

再設定中と失敗のあいだ、`/api` 配下の要求は次の許可リストだけを通す。

| メソッド | パス                        | 理由                  |
| -------- | --------------------------- | --------------------- |
| GET      | `/api/settings`             | 起動時の状態判定      |
| GET      | `/api/root-reconfiguration` | 進捗と失敗理由の取得  |
| POST     | `/api/root-reconfiguration` | 再試行                |
| POST     | `/api/__test__/reset`       | fixtureのテスト間分離 |

それ以外（Library・Files・メディア配信・scan・候補・DLsite・タグ・スマートフォルダー等）は `RootReconfiguringError` として409で拒否する。ロックは `app.ts` のmiddlewareで一括して掛け、各ルートに判定を散らさない。静的ファイル配信は対象外。

### API契約

契約は `shared/src/rootReconfiguration.ts` にZodで定義する。

```ts
type RootReconfigurationState =
  | { status: "idle"; completedAt: string | null }
  | { status: "running"; rootFolder: string; progress: ScanProgressEvent | null }
  | { status: "failed"; rootFolder: string; message: string };
```

`idle` の `completedAt` は直近の再設定が完了した時刻（一度も完了していなければ`null`）。別クライアントが開始した再設定を、このタブがreconfiguringを観測しないまま完了した場合を検知するのに使う（`rootFolder`だけでは同じパスへの再構築を拾えない）。クライアントはreadyの間、`rootFolder`または`completedAt`が前回観測値から変わったことを離脱側後処理（非破壊リセット・player停止→クエリ破棄→DLsite attach→再取得）のトリガーにする。初回起動時の観測値は基準として記録するだけで発火しない。409観測（`onApiError`）はロック中の合図であって離脱の合図ではないため、離脱側後処理のトリガーにはしない（settingsのinvalidateだけ行い、reconfiguring→readyの観測は別経路で拾う）。`GET /api/settings` のクエリは（全体既定の `refetchOnWindowFocus: false` と異なり）`refetchOnWindowFocus: "always"` にし、staleTimeに関わらずタブへ戻った時点でこの変化を観測できるようにする。

- `GET /api/root-reconfiguration` → 200 `RootReconfigurationState`
- `POST /api/root-reconfiguration`、body `{ rootFolder: string }`（絶対パス。旧 `settingsUpdateSchema` と同じ検証）
  - 202 `RootReconfigurationState`（`running`）
  - 400 `invalid_request`（パスの形式不正・存在しない・フォルダーでない）
  - 409 `conflict`（すでに再設定中）
- `GET /api/settings` の応答 `Settings` に `rootReconfiguration: RootReconfigurationState` を加える。クライアントは起動時の1回の取得で、未設定・再設定中・失敗・通常運用を判定できる。
- ロック中の拒否は409で、`ApiError` の `code` に `root_reconfiguring` を加える。クライアントはこのコードを受けたら設定を再取得して再設定画面へ移る。

`running` の `progress` は構築中のフルスキャンの最新進捗である。再起動後の中断は `failed` として返し、`message` で中断を伝える。

### 実装の置き場所と real/fixture の分担

ワークフローは `server/src/rootReconfiguration.ts` に置く。`ScanJobManager` / `DlsiteJobManager` と同じく、プロセス内状態を持つアプリケーションサービスである。`core/` は純粋関数の層なので置かない。`app.ts` がワークフローを生成し、job manager、操作ロックのmiddleware、ルートを配線する。

ワークフローは状態遷移・ジョブ終了の順序・プロセス内の実行状態と進捗・中断の解釈を持つ。アダプタは `RootReconfigurationAdapter`（`server/src/adapter/rootReconfiguration.ts`）でI/Oだけを担う。

- rootの検証と正規化
- 再設定状態の読み取りと、開始・失敗・完了の永続化（開始時は `root_folder` と候補除外・候補sessionの破棄を含む）
- catalogの作り直し（範囲外の行削除とフルスキャン）

real と fixture は同じワークフローを通る。fixtureは状態をインメモリに持つ。新rootの配下にない作品はcatalog相当の一覧から外し、アダプタ内に保持する。これは fixture における物理ファイルの代わりで、rootを戻せば同じUUID・同じuser状態で一覧へ戻る。fixtureでは次を再現できるようにする。

- 構築に一定の時間をかけ、再設定中の状態と進捗を観測できる。
- 予約パス（`/fixture/unreadable-library`）への再設定は構築段階で失敗し、失敗状態と再試行を再現できる。
- シナリオ `root-reconfiguration-failed` は失敗状態から起動し、再起動後の失敗状態を再現できる。

## 帰結

- `PUT /api/settings`、`settingsUpdateSchema`、`SettingsAdapter.updateSettings` を削除する。root変更と初回設定は `POST /api/root-reconfiguration` だけになる。
- rootだけ先に変えてFilesを閲覧する操作、root変更をまたいで管理ジョブを続ける動作はなくなる。再生の停止と画面の初期化はクライアント（TASK-469.2）の責務で、サーバーはロック中のメディア配信を拒否することでそれを補強する。
- 再設定中は通常操作がすべて止まる。大きなライブラリではフルスキャンが終わるまでLibraryを使えない。段階切替を作らない以上、これは受け入れる。
- 旧rootのmissing作品はcatalogから消える。user状態は残るので、同じ作品を新rootへ置けば履歴は戻る。
- 失敗状態から抜けるには再試行するしかない。旧rootのパスが消えていれば、存在する別のパスを指定する必要がある。
