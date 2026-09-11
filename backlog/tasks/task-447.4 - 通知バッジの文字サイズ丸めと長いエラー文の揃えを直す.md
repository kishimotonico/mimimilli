---
id: TASK-447.4
title: 通知バッジの文字サイズ丸めと長いエラー文の揃えを直す
status: To Do
assignee: []
created_date: '2026-09-11 00:52'
updated_date: '2026-09-11 01:28'
labels:
  - ui
  - ux
  - triage
dependencies:
  - TASK-447.1
parent_task_id: TASK-447
priority: high
ordinal: 472000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-447 の「直す」判定のうち 431・428.8 を直す。431 のユーザー理由「誤差1px未満ならいいが、ボタン内フォントサイズが目に見えて大きくなりダサくなった箇所を直す」。原因の一つは TopBar.tsx:216・NotificationBell.tsx:100 の text-[9px]→text-caption(10px) 丸め（tmp/uiux-triage-2026-09-11/gridsize.md）。428.8 のユーザー理由「長いエラーメッセージが中央揃えで2行になるのは日本語で見栄えが悪い」。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 tokens.css に --fs-badge（9px）と対応ユーティリティ text-badge が追加され、TopBar.tsx・NotificationBell.tsx のバッジ数字が 9px に戻り、docs/design-system.md のトークン表に1行追加されている
- [x] #2 431 で移行した箇所の master とブランチの computed font-size を実測して差分をタスクメモに列挙し、ボタン・バッジ内で master より大きくなった箇所は master と同じ px に戻っている（既存トークンで表せない値は統括に相談）
- [x] #3 起動エラー・セットアップ失敗・通信失敗の画面で、2行以上になるメッセージが左揃えで表示される（メッセージのブロック自体は中央配置のまま）
- [x] #4 着手前後のスクリーンショット（fixture、1440x900）を tmp/uiux-triage-2026-09-11/shots-intake/447.4-before.jpg と tmp/uiux-triage-2026-09-11/shots-intake/447.4-after.jpg に置き、タスクメモから参照している
- [x] #5 変更範囲のテストが通り、既存テストの期待値を削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに列挙）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## TASK-431 移行前後の実測（静的突き合わせ, tmp/4384fce.diff）
text-[Npx] → text-token の変換105箇所を機械抽出。master比で増えたのは以下のみ:
- TopBar.tsx / NotificationBell.tsx の通知バッジ数字: 9px→10px(+1px, text-caption) — バッジ操作要素。--fs-badge(9px)/text-badgeを追加してmaster同値に復元済み
- SmartFolderEditorModal.tsx の"SMART"カーソルラベル: 9px→10px(+1px, text-label) — モーダル見出し脇のキッカーラベルでボタン/バッジ/ピルではない。見出し等の1px差として許容範囲内、据え置き
- 上記以外は全て±0.5px以内（ユーザーの「1px未満ならいい」の許容範囲）で据え置き。負方向（master比で小さくなった）は本ACの対象外のため未対応
既存トークンで表せない値は発生しなかった（統括への相談は不要と判断）

## 長いエラー文の左揃え対象洗い出し
text-centerでラップされたエラーメッセージ画面は StartupErrorScreen.tsx と RootErrorBoundary.tsx の2箇所のみ（grep網羅: formatUserError/role="alert"使用箇所を全確認、SetupScreen.tsx のエラー文は元々text-center配下になくAC対象外）。両方とも外側divのtext-centerを外し、見出し(h1)にtext-centerを個別付与、メッセージ<p>にw-full text-leftを付与してブロックは中央のまま文字だけ左揃えに変更

## スクリーンショット
- tmp/uiux-triage-2026-09-11/shots-intake/447.4-before.jpg / 447.4-after.jpg（TopBar通知バッジ）
- tmp/uiux-triage-2026-09-11/shots-intake/447.4-before-2.jpg / 447.4-after-2.jpg（起動エラー画面、2行エラー文の中央揃え→左揃え）

## テスト
既存テストの期待値変更なし。rootErrorBoundary.test.tsx / notificationBell.test.ts / topBarJobStatus.test.ts / topBarSearch.test.ts / topBarUnregisteredBadge.test.ts / appRootSubscriptions.test.tsx（46件）全通過。pnpm check 全通過（oxfmtの自動整形1件のみ実施）。pnpm test:smoke 25件全通過
<!-- SECTION:NOTES:END -->
