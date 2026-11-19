---
id: TASK-511.7
title: スキャン画面のサイドバーと新規作品・更新済みタブを作り直し、用語を行方不明にそろえる
status: To Do
assignee: []
created_date: '2026-11-19 00:24'
updated_date: '2026-11-19 00:51'
labels:
  - scan
  - ui
dependencies:
  - TASK-511.4
  - TASK-511.6
  - TASK-511.11
references:
  - 'https://claude.ai/artifact/GbuEuRQyKeD9xN4CM3Fv1k'
documentation:
  - docs/adr/0034-scan-modal-restructure.md
parent_task_id: TASK-511
priority: high
ordinal: 576000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0034のタブ構成のうち、サイドバー・新規作品タブ・更新済みタブと用語の統一をクライアントに実装する。要対応タブはTASK-511.12。現行は client/src/features/scan/ui/ScanModal.tsx、scanModal/ScanSidebar.tsx・NewlyRegisteredTab.tsx・UpdatedWorksTab.tsx・ScanFooter.tsx。レイアウトの正は実装と docs/design-system.md、見た目はモック（ref）を参考にする。TASK-511.6とScanModal・ScanSidebarが衝突するので、511.6の後に着手する。

文言と表示:
- 左の縦タブは「未登録 / 新規作品 / 要対応 / 更新済み」。件数は未登録と要対応だけに出し、開いているタブには出さない。選択中は左端の線と太字で示す。現行サイドバーの集計行（更新なし・ライブラリ全体）は削除する。
- サイドバー下: 1行目「最終スキャン」、2行目に年入りの日時（例 2026/11/08 17:49）。その下に分割ボタン「スキャン」＋▾（中に「すべての作品を読み直す」）。スキャン中は「スキャンを中止」に入れ替わる。「再スキャン」という文言は使わない。
- 一覧に行ごとの文字の操作ボタンを並べない。パスは押すとFilesで開く。作品タイトル（新規作品ではタイトル横のアイコン）を押すと、作品詳細ページ（openWorkDetailAtom、client/src/entities/work/model/navigationActions.ts の workDetail ルート）を開き、スキャンモーダルは閉じる。ホバーで下線、title属性で行き先を示す。
- 新規作品: タイトルはその場で編集。作品詳細へはタイトル横のホバー時だけ出る小アイコン。タイトルの下にパス（Filesへのリンク）。DLsite列は「連携済み」（リンクのアイコン・完了の色）/「未連携」（破線リンクのアイコン・薄い色。status が none のほか、not_found・error の投影＝取得に失敗した作品も含める）/ RJコードなしは空欄。現行の「取得待ち」表示（client/src/features/scan/ui/scanModal/dlsiteLinkStatus.ts）はここで無くす。
- 更新済み: 列は 作品 / 変更内容。変更内容は変化1つにつき1行、アイコン＋短い文（「移動 旧パス → 新パス」「作品情報ファイルを更新」「音声ファイル +3」）。長いパスは省略してtitle属性で全文。表の上に種類ごとの絞り込み（アイコン・種類・件数のテキスト切り替え。丸いピルは使わない）。値の差分は出さない。フォルダー単位のまとめ表示はしない。
- 用語: 作品の状態ラベル「ファイル欠損」（client/src/entities/work/workStatusLabel.ts）を「行方不明」に変え、関連するUI文言（ライブラリのエラー表示のバナーは「行方不明の作品が N 件あります」、client/src/features/library/ui/ErrorViewBulkUnregisterBanner.tsx）、コメント（client/src/entities/player/model/workPlaybackRequest.ts）、smokeの期待値（client/tests/smoke/library.smoke.spec.ts の「ファイル欠損」）も合わせる。client/src/shared/lib/trackDuration.ts の「再生時間計測失敗（ファイル欠損）」はトラック単位の別の概念なので対象外。
- UIに説明文を置かない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 左の縦タブが未登録・新規作品・要対応・更新済みの順に並び、件数は未登録と要対応だけに出て、開いているタブには出ない。サイドバーの集計行（更新なし・ライブラリ全体）が無い
- [ ] #2 サイドバー下に「最終スキャン」と年入りの日時、分割ボタン「スキャン」（▾に「すべての作品を読み直す」）があり、スキャン中は「スキャンを中止」に入れ替わる
- [ ] #3 新規作品タブでタイトルをその場で直せ、DLsite列が連携済み・未連携（取得に失敗した作品を含む）をアイコンつきで出し、「取得待ち」が出ない。新規作品が件数で切れずに全件見える
- [ ] #4 更新済みタブが作品ごとに変化を1行ずつ出し、種類で絞り込める。作品タイトルを押すと作品詳細ページが開き、スキャンモーダルが閉じる
- [ ] #5 rg「ファイル欠損」が client/ で client/src/shared/lib/trackDuration.ts 以外0件で、ライブラリのエラー表示のバナーが「行方不明の作品が N 件あります」になっている
- [ ] #6 pnpm test:smoke を含めて pnpm check・pnpm test が通る
<!-- AC:END -->
