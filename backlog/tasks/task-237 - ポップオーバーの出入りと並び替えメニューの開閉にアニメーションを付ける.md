---
id: TASK-237
title: ポップオーバーの出入りと並び替えメニューの開閉にアニメーションを付ける
status: Done
assignee: []
created_date: '2026-08-07 15:10'
updated_date: '2026-08-07 16:27'
labels: []
dependencies: []
ordinal: 247000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ライブラリ検索の値選択UIにモーションを足す。docs/design-system.md の Motion 規約に従い、構造的な出入りは usePresence / Presence（client/src/shared/ui/）で実装する。

対象:
(1) 並び替え選択列（AxisValueQuickList.tsx:210-237 の `{sortMenuOpen && ...}`）— 縦方向の出し入れのみなので既存の collapse variant（grid-template-rows 0fr→1fr + opacity、150ms、shell.css:3386）がそのまま使える
(2) ポップオーバー3種 — AxisQuickOverlay.tsx:63（`if (!isOpen || !anchorEl) return null` のポータル）、FilterChipAddButton.tsx:58-79 と 80（軸選択ステージと値ステージの条件レンダー）、およびチップの兄弟値ドロップダウン。既存の dock-popup-scale（scale 0.85→1 + fade、180ms、shell.css:3430）と同系のスケール＋フェードを使う。ただし transform-origin が bottom right 固定のため、そのままでは合わない。汎用の popover-scale variant を1つ追加し、transform-origin は各ポップオーバーのCSSクラス側で指定する（軸レールのクイックオーバーレイはトリガーの右に出るので left center、チップの値ドロップダウンと「＋絞り込み」は下に出るので top left）

注意点:
- 新しい Presence variant を追加したら shell.css:3514-3528 の prefers-reduced-motion 一括無効化リストへ必ず追加する（漏れると規約違反）
- 軸レールのクイックオーバーレイは useHoverGroupCoordinator（shared/lib/）と連携しており、閉じる指示から実際にDOMから消えるまでに exit の遅延が入ると、素早く別の軸行へ再ホバーしたときのパネル使い回し判定と競合しうる。isOpen が再度 true になったときに usePresence の enter が正しく割り込むかを実機で確認すること
- AxisQuickOverlay.tsx:69-70 に「layout.top 未確定の1フレーム目がある」旨のコメントがある。enter アニメーションを足すと初期位置のジャンプが可視化される可能性があるため、実機で確認する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 並び替え選択列の開閉に collapse のアニメーションが付く
- [x] #2 軸レールのクイックオーバーレイ・チップの兄弟値ドロップダウン・「＋絞り込み」の表示と非表示にスケール＋フェードのアニメーションが付く
- [x] #3 transform-origin が各ポップオーバーの出現方向に合っている（右に出るものは左端、下に出るものは上端）
- [x] #4 新規 Presence variant が prefers-reduced-motion の無効化リストに追加されている
- [x] #5 軸行を素早く移動したときにパネルの表示が破綻しない（exit中の再オープンが正しく割り込む）ことを実機で確認済み
- [x] #6 オーバーレイの初期位置ジャンプがアニメーションで可視化されていないことを実機で確認済み
- [x] #7 pnpm check と変更範囲のテスト、pnpm test:smoke が通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Presenceにpopover-scale variant（180ms、scale+opacity、transform-originは呼び出し側クラスへ委譲）を追加し、軸レールのクイックオーバーレイ・チップの兄弟値ドロップダウン・「＋絞り込み」の出入りと並び替え選択列の開閉をアニメーション化。prefers-reduced-motionの無効化リストにも追加。退出中に値が失われないよう直前値保持ref（軸・アンカー要素・選択軸・facet結果）を置き、退出中の要素はPresence側でinert化（keepInteractiveOnExitでopt-out可）。退出中の再オープンで検索欄フォーカスが戻るようisOpenを依存に追加。Codexレビュー2巡で指摘なしまで到達。pnpm check・unit25件・smoke10件全通過
<!-- SECTION:FINAL_SUMMARY:END -->
