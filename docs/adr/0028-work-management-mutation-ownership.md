# ADR-0028: 作品を変更する操作とキャッシュ更新方針を entities/work/model に集約する

- ステータス: 承認
- 日付: 2026-09-25
- 関連: [ADR-0025](0025-source-mutation-projection-read-separation.md)（正本変更と投影の分離）、[ADR-0008](0008-persistence-topology-query-ownership-playback-ids.md)、[ADR-0027](0027-dlsite-meta-state-type-separation.md)、[設計レビュー2026-09-20 R2](../architecture-review-2026-09-20.md)、backlog TASK-465

## 文脈

作品を変更する操作の入口が Library・Files・Scan・DLsite・App に分かれ、成功後にどのキャッシュを更新するかをそれぞれが決めている。入口は 13 箇所あり、更新する集合は操作の意味ではなく、書いた画面の都合で決まっていた。

- Library の単体登録解除は `["works"]` だけを無効化する。facet・タグ一覧・スマートフォルダーの作品一覧・DLsite 通知は古いまま残る。
- Scan のインラインタイトル編集は、詳細と自分が表示している一覧だけを無効化する。検索やスマートフォルダーの所属、facet は更新しない。
- 作品編集ダイアログ系の `invalidateWorkViewQueries` は DLsite 通知を含まない。通知一覧の行は作品タイトルを表示する。
- Files の登録・解除・ID 再採番は FS・scan 診断・`["works"]` を無効化し、facet・タグ・スマートフォルダーを含まない。
- スキャン完了はタグ一覧と詳細を無効化しない。スキャンは meta の変更を取り込むため、両方が変わりうる。
- DLsite 未設定項目の一括適用は正本を書き換えるが、編集用 source キャッシュを残す。次の編集で CAS が失敗する。

無効化の helper は `features/scan`・`features/dlsite`・`features/library` にあり、形も「キー配列を返す純関数と実行 wrapper」と「Library の navigation state で分岐する手続き」が混在する。`features` 間の sibling import は禁止のため、Library の `DlsiteEditor` は DLsite の無効化を jotai atom 越しに呼んでいた（`dlsiteInvalidateAtom`）。新しい集計や表示を足すたびに、全入口を横断して更新漏れを探す必要がある。

## 決定

### 集約する範囲

作品を変更する API の呼び出しと、その操作に必須のキャッシュ更新を、操作ごとに 1 つの hook（React 外から呼ぶものは関数）として共通モジュールが提供する。画面はこの hook を経由して作品を変更し、無効化するキーの集合を知らない。

共通モジュールが所有するもの:

- 変更 API の呼び出し（mutationFn）
- 成功時の必須キャッシュ更新（source・詳細への書き戻し、無効化、削除）
- 正本変更が失敗したときの詳細の再取得（CAS 不一致後に最新を読み直すため）

画面側に残すもの:

- 選択解除、遷移、ダイアログの開閉、トースト、エラー文言
- Library の表示中一覧への直接パッチや一覧 reset など、表示最適化
- scan 候補の非表示集合（`scanCandidateHiddenPathsAtom`）や、Files の表示中ディレクトリの再取得など、画面の表示状態
- DLsite 一括取得ジョブと SSE の寿命管理（TASK-448.3 の範囲）

画面の後処理は `mutate(variables, { onSuccess })` の呼び出し単位の callback で書く。hook 定義側の `onSuccess`（必須更新）が完了してから呼ばれるため、画面の処理は必須更新の後に走る。

### 配置

`client/src/entities/work/model/` に置く。

- `workCacheUpdates.ts`: 操作ごとの必須キャッシュ更新関数。`QueryClient` だけを受け取る純粋な手続きで、React に依存しない。
- `workMutations.ts`: 操作ごとの mutation hook。mutationFn と `workCacheUpdates.ts` の関数を結ぶ。

`features/work-management` は新設しない。Library・Files・Scan・DLsite のすべてから sibling import なしで使えるのは `entities` 以下であり、`shared` はドメイン非依存の層なので置かない。既存の `entities/work/invalidateWorkViewQueries.ts` はこのモジュールへ吸収して削除する。

変更 API のうち `features` にあるもの（`createWork`・`reassignIdentityConflict` は `features/files/api.ts`、`registerScanCandidates` は `features/scan/api.ts`）は `entities/work/api.ts` へ移す。読取り専用の API は移さない。

### navigation 型を参照しない

共通モジュールは Library の `LibraryViewState` など navigation の型・atom を import しない。`LibraryViewState` は `features/library` にあり、`entities` から `features` への import はレイヤ境界チェック（`scripts/layer-boundary-rules.mjs`）が禁止するため、この制約は機械的に守られる。表示中の一覧に関する情報は、次節の契約を通じて query key と関数としてだけ受け取る。

### 表示最適化の契約

表示最適化のオプションを持つのは bookmark だけとする。bookmark は一覧の並びや所属を変えない場合が多く、再取得による一覧の揺れを避ける価値がある。

```ts
interface ActiveListCacheHandler {
  queryKey: QueryKey;
  apply: (
    queryClient: QueryClient,
    change: { workId: string; bookmarked: boolean },
  ) => void | Promise<void>;
}

function useBookmarkWorkMutation(options?: {
  activeList?: ActiveListCacheHandler | null;
}): UseMutationResult<{ bookmarked: boolean }, Error, { workId: string; bookmarked: boolean }>;
```

- `activeList` を渡さない場合、共通モジュールは必須更新をすべて自分で行う。
- `activeList` を渡した場合、画面は `apply` の中で `queryKey` の一覧を新しい値へ揃える責任を負う。直接パッチでも reset でもよい。共通モジュールは `apply` の完了を待ち、その `queryKey` だけを無効化の対象から外す。それ以外の一覧は必須更新どおり無効化する。
- パッチと reset のどちらを選ぶかは、表示中の軸・検索・ソートを知る画面が決める。Library はスマートフォルダー軸とお気に入り軸では reset、それ以外では直接パッチを選ぶ。

meta 編集、登録、登録解除、DLsite 適用には再取得を省略するオプションを設けない。これらは検索・ソート・所属・件数を変えうるため、画面が一部を直接パッチしても、再取得を省略してよい一覧を画面の文脈から正しく判定できない。

### 公開 API

mutation hook は `UseMutationResult` をそのまま返す。

| hook / 関数                           | API                                           | 用途                                                 |
| ------------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| `useEditWorkSourceMutation()`         | `patchWorkSource`                             | 作品編集ダイアログの一括保存                         |
| `useRenameWorkMutation()`             | `getWorkEditSnapshot` → `patchWorkSource`     | Scan のインラインタイトル編集                        |
| `useAddWorkTagMutation()`             | `addWorkTag`                                  | 詳細ペインのタグ追加                                 |
| `useRemoveWorkTagMutation()`          | `removeWorkTag`                               | 詳細ペインのタグ削除                                 |
| `useProjectWorkSourceMutation()`      | `projectWorkSource`                           | 投影の再試行（`SourceProjectionNotice`）             |
| `updateCachesAfterPlaybackPrepared()` | （呼び出し側が `prepareWorkPlayback` を実行） | 再生開始時の投影反映。App の再生要求の競合判定と組む |
| `useBookmarkWorkMutation(options)`    | `patchWorkBookmark`                           | bookmark                                             |
| `useRegisterWorkMutation()`           | `createWork`                                  | Files の単体登録ダイアログ                           |
| `useRegisterScanCandidatesMutation()` | `registerScanCandidates`                      | Scan の候補一括登録                                  |
| `updateCachesAfterLibraryScan()`      | （スキャンジョブの完了通知）                  | スキャン完了                                         |
| `useUnregisterWorkMutation()`         | `deleteWork`                                  | 単体の登録解除（Library・Files）                     |
| `useUnregisterMissingWorksMutation()` | `unregisterMissingWorks`                      | missing 作品の一括登録解除                           |
| `useReassignWorkIdentityMutation()`   | `reassignIdentityConflict`                    | ID 重複の別作品取り込み                              |
| `useUpdateDlsiteLinkageMutation()`    | `updateDlsiteState`                           | RJ コード保存、連携しない切替                        |
| `useFetchDlsitePreviewMutation()`     | `fetchDlsiteInfo`                             | DLsite 情報の取得（取得キャッシュが更新される）      |
| `useApplyDlsiteInfoMutation()`        | `applyDlsiteInfo`                             | DLsite 情報の単体適用                                |
| `useApplyDlsiteMissingMutation()`     | `applyDlsiteMissing`                          | 未設定項目の一括適用                                 |
| `updateCachesAfterDlsiteBulkFetch()`  | （一括取得ジョブの終端通知）                  | DLsite 一括取得の完了                                |

`useEditWorkSourceMutation`・`useRenameWorkMutation`・タグ追加/削除・`useBookmarkWorkMutation` は、失敗時に詳細（`["work", id]` 完全一致）を無効化する。

### 操作ごとの必須更新

キーの略記は次のとおり。

- 詳細(id): `["work", id]` 完全一致。source: `["work", id, "source"]`。作品キャッシュ(id): `["work", id]` 前方一致（詳細と source）。全詳細: `["work"]` 前方一致
- 一覧系: `["works"]` 前方一致（通常一覧、総件数、エラー件数、missing 件数、scan 結果の一覧）
- 一覧: 一覧系のうち `WORK_QUERY_KEYS.list(params)` の形のもの、および `["smartFolderWorks"]` 前方一致
- facet: `["axisFacets"]`。タグ: `["tags"]`。SF: `["smartFolderWorks"]`（件数プレビューを含む）。通知: `["dlsiteNotifications"]`。FS: `["fs"]`。診断: `["scan", "diagnostics"]`

| 操作                                                                   | 必須更新                                                                                                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| meta 編集（一括保存・タグ追加/削除・インラインタイトル・投影の再試行） | source へ応答の snapshot を書き戻す。詳細(id)・一覧系・facet・タグ・SF・通知を無効化                        |
| 再生開始時の投影反映                                                   | 詳細(id) へ応答の Work を書き戻す。一覧系・facet・タグ・SF・通知を無効化                                    |
| bookmark                                                               | 詳細(id) の `bookmarked` を応答値へ書き換える。一覧を無効化（画面が引き受けた key を除く）                  |
| 登録（候補一括・Files 単体）                                           | 一覧系・facet・タグ・SF・通知・FS・診断を無効化                                                             |
| スキャン完了                                                           | 登録の集合に加え、全詳細を無効化                                                                            |
| 登録解除（単体）                                                       | 作品キャッシュ(id) を削除。一覧系・facet・タグ・SF・通知・FS・診断を無効化                                  |
| 登録解除（missing 一括）                                               | 全詳細を無効化。一覧系・facet・タグ・SF・通知・FS・診断を無効化                                             |
| ID 再採番                                                              | source(新 id) へ応答の snapshot を書き戻す。全詳細と、登録の集合を無効化                                    |
| DLsite 単体（コード保存・連携しない切替・情報適用）                    | source へ応答の snapshot を書き戻す。詳細(id)・一覧系・facet・タグ・SF・通知を無効化                        |
| DLsite 情報の取得                                                      | 成否にかかわらず詳細(id)・一覧系・facet・タグ・SF・通知を無効化                                             |
| DLsite 未設定項目の一括適用                                            | 対象 id ごとに作品キャッシュ(id) を無効化。一覧系・facet・タグ・SF・通知を無効化                            |
| DLsite 一括取得の完了                                                  | 処理対象 id ごとの詳細(id)、取りこぼしの可能性があれば全詳細を無効化。一覧系・facet・タグ・SF・通知を無効化 |

meta 編集と DLsite 単体適用では source を無効化しない。応答の snapshot が確定済みの編集基準であり（ADR-0025）、再取得すると編集中のダイアログの基準がずれる。一括適用は対象ごとの snapshot を返さないため、source ごと無効化する。

scan 候補（`["scan", "candidates"]`）は必須更新に含めない。候補は直近スキャンのスナップショットで、登録や解除では再計算されない。候補一括登録後の表示は、画面側の非表示集合で揃える。

必須更新は操作ごとの関数として `workCacheUpdates.ts` に定義する。共通部分は非公開の関数で組み立ててよいが、操作とキー集合の対応表をデータとして宣言する形にはしない。操作ごとに書き戻し・削除・無効化の組合せが異なり、表にすると例外の列が増えるためである。

### DLsite の無効化経路

DLsite の必須更新は `entities/work/model` に置くため、Library の `DlsiteEditor` は共通モジュールを直接呼べる。`DlsiteBulkRuntime`（`features/dlsite`）も一括取得の完了時に `updateCachesAfterDlsiteBulkFetch` を直接呼ぶ。atom 越しに無効化関数を渡す `dlsiteInvalidateAtom` と `useDlsiteInvalidation` は利用者がいなくなるため削除する。一括取得ジョブの操作を渡す `dlsiteBulkActionsAtom` は残す。

## 帰結

- 作品を変更する画面は、操作に対応する hook を呼ぶだけで必須更新を満たす。新しい集計や表示を足すときは、`workCacheUpdates.ts` の該当操作を直せば全入口に効く。
- 文脈に挙げた更新漏れは、この一覧に揃えることで解消する。Library の登録解除で facet・タグ・SF・通知・FS・診断が、インラインタイトル編集で facet・タグ・SF・通知が、スキャン完了でタグと詳細が、それぞれ更新されるようになる。再取得の回数は増えるが、observer のない query は stale 化だけで再取得しない。
- bookmark 以外の操作では、画面が一覧の再取得を省略できない。一覧の揺れを抑える最適化が必要になった場合は、その操作についてこの ADR の契約を拡張する。
- `features/scan/model/libraryInvalidation.ts`、`features/dlsite/model/dlsiteInvalidation.ts`、`entities/work/invalidateWorkViewQueries.ts`、Library の `staleInactiveListCaches` は削除する。Library に残るのは、表示中の一覧 key を組み立てる処理と、パッチか reset かの選択だけである。
- query key の階層は変えない。「一覧」の判定は `WORK_QUERY_KEYS.list(params)` の形と `["smartFolderWorks"]` 前方一致で行う。
- 必須更新の検証は `QueryClient` へ直接キャッシュを置き、操作後の無効化・書き戻し・削除を確かめる単体テストで行う。
