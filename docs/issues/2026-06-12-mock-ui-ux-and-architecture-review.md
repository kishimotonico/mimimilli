# モックUI/UX・設計実装レビューと改善提案

Status: 対応中（2026-06-13 一次バッチ完了）

実機確認（agent-browser によるモックUIの全画面操作）とコードリーディングに基づくレビュー。プレイヤーUIの刷新（シークバー・ボタン・ポップアップモード）は別途検討中のため本書のスコープ外。

## 進捗（2026-06-13）

対応済み（コミット済み）:

- §1 契約統合: client/mocks を server の fixture アダプタへ吸収。client をルート workspace へ合流、型を `@mimimilli/shared` に統一、API を契約 v2（`{items,total}` エンベロープ・`PATCH /works/:id`・`/media/*` 等）へ全面切替。vite dev は fixture アダプタを dev middleware としてマウント（`87ca2c4`）。fixture シナリオ（default/empty/new-work/errors）も server へ移植（`dac3d12`）
- §5 fixture 拡充の一部: 合成メディア配信を実装。無音 WAV（Range 対応）と SVG カバーで、モックでも実時間のシーク・カバー表示が成立（`c714565`）。サークル/カテゴリのタグ拡充は未着手
- §4 欠損/エラー表示: missing/error 作品に警告バッジ＋バナーを表示、再生を無効化、一覧に警告アイコン。再生ハンドラの状態ガードとサイレント失敗（`catch{}`）の解消（`fd9c0ae`）
- §3 飾りUIの一部: 並び替えメニューを実装（飾りボタン→ポップオーバー）。タグ絞り込み結果・分類軸ランディングのカードから作品を開けるよう導線追加＋全件表示（`42d6a28`）
- §6 ドキュメント: AGENTS.md の実態乖離（apps/web・frontend-design.md・asa.localhost）を修正（`1cf73a8`）

残（未着手、優先度順の目安）:

- §4 URL ルーティングとナビ履歴（モード・軸・ドリル・ファイルパスを URL に載せ、戻る/進む・パンくずを本物にする）
- §2 ブックマーク切替・タグ/タイトル編集 UI（API は実装済み、画面が無い）
- §2 レジューム再生（`playWithResume` が未配線。保存だけ走り再生は常に先頭から）
- §4 トランスポートバー右端のレイアウト（「重ねて再生」が音量スライダーに重なる、全画面展開ボタンが隅すぎる）→ プレイヤーUI刷新と一緒に拾う想定
- §3 残りの飾り（ビュー切替リスト/グリッド、通知ベル、スマートフォルダー条件エディタ）
- §5 fixture のサークル/カテゴリタグ拡充
- 軽微: AxisLanding の案内文「左の列から絞り込みを選択してください」が、絞り込み済みで結果が出ている状態でも表示される

開発上の注意: vite dev は server の fixture アダプタをプラグイン初期化時に1度だけ生成するため、`server/src` の変更は起動中 dev サーバーに自動反映されない。サーバー側を変えたら dev サーバーを手動再起動する（client 側は HMR で反映される）。

## 1. 構造の最重要課題: モックと新サーバーの契約乖離

クライアントは今も `client/mocks/`（vite plugin の独自モック）で動いており、`shared/` + `server/` の API 契約 v2 とすでに非互換になっている。

- v2 の `GET /api/works` は `{ items, total }` エンベロープを返すが、client の `searchWorksV2` は `WorkSummary[]` 直接を期待（モックもそう返す）
- v2 では `PATCH /api/works/:id` に統合済みの更新系を、client/mocks は旧 `PUT /works/:id/tags` 等のまま実装
- 型も三重管理: `shared/src/*.ts`（Zod・正典）、`client/src/entities|features` のローカル型、`client/mocks/fixtures/types.ts`

つまり今 `BACKEND_URL` を新サーバーに向けるとクライアントは壊れる。モックを作り込むほど乖離が拡大するフェーズに入っているため、**ADR-0002 の統合（client/mocks → server の fixture アダプタへ吸収、client の型を `@mimimilli/shared` import へ切替、client を root workspace へ合流）を「モック作り込みの続き」より先にやる**ことを提案する。Hono アプリを Vite の dev middleware にマウントすれば `pnpm dev` 一発の DX は維持できる（architecture-v2 §5.3 の通り）。

## 2. 実装済みなのに UI から呼ばれていない機能

API・プレイヤーエンジン側に実装があるのに UI が存在しない（または飾りボタンだけある）もの。モックUXを詰めるうえで「画面がない仕様」が積み上がっている。

| 機能 | 実装箇所 | UI の現状 |
|---|---|---|
| ブックマーク切替 | `entities/work/api.ts` toggleBookmark | 詳細パネルのハートボタンは onClick なし（飾り）。「お気に入り」ビューは fixture 固定値しか映らない |
| レジューム再生 | `usePlayer.ts` playWithResume | どこからも呼ばれていない。resume 保存だけ5秒毎に走り、再生は常に先頭から |
| タグ・タイトル編集 | updateWorkTags / updateWorkTitle | 詳細パネルに編集UIなし（タイトル編集は NewWorkPopup のみ） |
| DLsite 情報取得・適用 | fetchDlsiteInfo / applyDlsiteInfo | UIなし。サーバー側は real アダプタまで実装済みなのに使う画面がない |
| 検索プリセット | saveSearchPreset ほか | UIなし |
| 倍速・ABリピート・チャンネルスワップ | usePlayer / audioEngine | 全画面プレイヤーにもUIなし（プレイヤー刷新時に拾う想定でOK） |
| 並び替え | useLibraryNavigation の sort | 変更UIなし（AddressBar の onSort 未配線） |

## 3. 飾りUI・配線漏れ（実機確認済み）

- AddressBar: カラム/リスト/グリッド切替・並び替え・その他・戻る/進む の計7コントロールがすべて死んでいる。App.tsx が `viewMode` / `onViewChange` / `onSort` / `onBack` / `onForward` を渡していない（`AddressBar.tsx:10-24`）
- PreviewPane の axis-landing グリッド（タグAND絞り込み結果もここに出る）はカードに onClick がなく、**絞り込んだ作品を開く手段がない**。さらに `slice(0, 8)` で頭打ち（`PreviewPane.tsx:113-120`）
- スマートフォルダー: 「条件を追加」ボタンが飾り。条件エディタ自体が存在せず、新規作成は `window.prompt` で名前のみ・rules 空固定（`LibraryView.tsx:180-184`）。選択時に左レールのハイライトが追従しないバグもあり
- 通知ベル: 完全な飾り。スキャン結果やエラーの通知先として設計するか、消すか決める
- 詳細パネルのトラック行内の再生アイコンボタンは独自ハンドラなし（行クリックにバブルするだけ）

## 4. UXバグ・状態提示の問題（実機確認済み）

深刻度高:

- ファイル欠損作品の詳細が「登録済」バッジ＋有効な再生ボタンを出し、押すとサイレント失敗する。欠損の警告表示・再生無効化・エラートーストが必要。メタ読み込みエラー作品も同様にエラーバナーなし
- トランスポートバー右端で「重ねて再生」ボタンが音量スライダーに約40px重なる（1280px幅で実測）。900px幅では +10 ボタンが見切れる
- 全画面プレイヤー展開ボタンが画面最右下隅にあり、開発時は TanStack Query Devtools のボタンに完全に覆われてクリック不能

深刻度中:

- 検索はライブラリの通常軸でしか効かない。スマートフォルダー選択中・ファイルモード中に入力しても無反応（フィードバックもない）。スコープ外なら検索バーを無効化表示にするなど明示が必要
- URL ルーティングが一切なく（常に `/`）、リロードで現在地喪失。AddressBar の戻る/進むを実装する土台もない。ライブラリのドリル状態（例: CV/水瀬なずな）もパンくずに反映されない（「ライブラリ」固定）
- キーボード操作: リスト行が全部 div+onclick で tabindex なし。矢印キー・Tab でのリスト操作不可。ファイル起点再生では Space トグルも不発（要調査: `App.tsx` の isPlaying 判定）
- スキャン: 進捗表示なし。結果ダイアログの「1 エラー」「1 行方不明」から該当作品へジャンプできない
- App.tsx の `catch { /* ignore */ }` が3箇所（handlePlay / handlePlayFile / handleExport）。AGENTS.md の「問題を隠蔽しない」方針に反する。エクスポートは成功時もフィードバックがない
- 全画面プレイヤーのアイコンボタンに aria-label なし、フォーカストラップなし

## 5. fixture データの網羅性

モックで検証できない状態が多い。fixture アダプタ統合のタイミングで合わせて拡充するとよい。

- サークル軸・カテゴリ軸が常に0件（fixture に `サークル/` `カテゴリ/` プレフィックスのタグが1つもない）。シリーズも1件のみ
- スキャンが常に新規0件のため、NewWorkPopup の主要機能（新規作品リスト＋RJコード編集、実装済み）が一度も発火しない
- 音声実体・カバー画像実体がなく（cover 404、duration 0:00）、再生まわりのUXがモックで検証不能。数秒の無音音声と小さな画像を fixture に持たせるだけで、シーク・レジューム・カバー表示・画像プレビューが全部検証可能になる

## 6. ドキュメントの実態乖離

- AGENTS.md が `apps/web` と `docs/frontend-design.md` に言及しているが、どちらも存在しない（client/ フラット構成に再編済み、frontend-design.md は未作成 or 消失）
- AGENTS.md のデバッグURL `http://asa.localhost:1355` は別プロジェクトのもの。実際は `http://mimi.localhost:1355`（client/package.json の `portless run --name mimi`）

## 7. 推奨する進め方

1. **契約統合を先に**（§1）: client/mocks を fixture アダプタへ吸収し、client の型を shared へ。以降のモック作り込みが本実装と同じ土台に乗る
2. **fixture 拡充**（§5）: サークル/カテゴリタグ・新規作品シナリオ・実音声/画像。1 と同時にやると効率的
3. **状態提示の修正**（§4 高）: 欠損/エラー作品の警告表示と再生無効化、トランスポートバー右端のレイアウト
4. **飾りUIの棚卸し**（§3）: 各コントロールを「実装する/消す」で判定。特にタグ絞り込み結果が開けない問題と、ビュー切替（リスト/グリッド）は優先度高
5. **URL同期とナビゲーション履歴**（§4 中）: モード・軸・ドリル・ファイルパスをURLに載せ、戻る/進むとパンくずを本物にする
6. プレイヤーUI刷新（シークバー・ポップアップモード）は別途。その際に §2 の倍速/AB/レジューム再生とフォーカストラップ/aria を一緒に拾う

検証時のスクリーンショット: /tmp/mimimilli-01〜16, /tmp/mimimilli-sub-01〜29（セッション一時ファイル）
