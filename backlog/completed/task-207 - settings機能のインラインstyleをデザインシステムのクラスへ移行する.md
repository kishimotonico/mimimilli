---
id: TASK-207
title: settings機能のインラインstyleをデザインシステムのクラスへ移行する
status: Done
assignee: []
created_date: '2026-08-06 04:57'
updated_date: '2026-08-09 15:00'
labels: []
dependencies: []
priority: high
ordinal: 217000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
settings 機能だけが、他の全機能で完了している Tailwind + mle-/mll- クラスへの移行から取り残され、インライン style オブジェクトのまま残っている。「設定画面は変更頻度が低いから後回し」という判断が続き、CSS アーキテクチャの移行のたびに settings だけ対象外にされ続けた結果と見られる。

実測:
- client/src/features/settings/ui/SettingsModal.tsx（426行）: className= 3回に対し style={{...}} 29回
- client/src/features/settings/ui/TagPrefixSettings.tsx（330行）: className= 1回に対し style={{...}} 16回

比較対象:
- client/src/features/scan/ui/ScanModal.tsx: className= 47回・style={{}} 0回
- client/src/features/files/ui/FilePreview.tsx: className= 26回・style={{}} 3回

docs/design-system.md は「mle-/mll- は Library/Files 共通の骨格・固有UI」「Tailwind v4 のレイヤー順に乗せる」という規約を持ち、scan/files/library は準拠している。settings だけが規約から外れているため、design-system.md の規約が実装から読み取れない状態になっている。

放置するほど設定項目追加のたびにインライン style が積み増される（現状で14項目以上の色指定・レイアウトが複製されている）ので、着手は早いほど得。

設計判断は不要で、既存の他機能のクラス構成をなぞる作業。段階を踏むなら小さい TagPrefixSettings.tsx から着手して型を確立し、SettingsModal.tsx 本体へ展開する。

カラートークン・テーマ・z-index・motion は docs/design-system.md の規約に従うこと。見た目を変えないこと（移行であって再デザインではない）。

判断の基準: 実装コストや分量を理由に見送らないこと。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SettingsModal.tsx と TagPrefixSettings.tsx の style={{...}} が解消され、Tailwind ユーティリティと mle-/mll- 系クラスで構成されている
- [x] #2 色指定が docs/design-system.md のカラートークン経由になり、CSS 変数やカラーコードの直書きが残っていない
- [x] #3 移行前後で設定画面の見た目が変わっていない（ライト・ダーク両テーマで確認）
- [x] #4 z-index とモーダルの重なり順が design-system.md の規約どおりで、他のモーダルとの前後関係が変わっていない
- [x] #5 pnpm check と pnpm test と pnpm test:visual が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ダークテーマは未実装（docs/design-system.md:19）で切替手段が存在しないため、AC#3の確認はライトテーマのみで実施した。
<!-- SECTION:NOTES:END -->
