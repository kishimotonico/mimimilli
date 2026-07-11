---
id: TASK-30
title: モバイルUI方針を決定しADR化する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-10 12:34'
updated_date: '2026-07-11 10:54'
labels: []
dependencies: []
documentation:
  - docs/design-system.md
priority: high
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スマホ向けUIの追加にあたり、実装前に方針を確定してADRとして記録する。

決定済みの前提（2026-07-10 ユーザー合意）:
- スマホはストリーミング再生のプレイヤー＋作品を探す道具。管理系機能（タグ編集・スマートフォルダー編集等）はPC専用のまま
- スマホの初期スコープはミニマム: 再生とマーキング（お気に入り＋あとで整理フラグ）のみ
- URLは分けない（/m のような別ツリーは作らない）。同一ルート内でレイアウトを切り替える
- 方向性: スマホ単体再生 + カバーグリッド/スマートフォルダーポータルでのブラウズ + マーキングのみの書き込み + PWA

このタスクで決めること:
- ブレークポイント戦略（値・段数・tokens.css / Tailwind へのトークン化）
- シェルの分岐方式: AppShell（スロット式レイアウト）をCSSで畳むか、モバイル専用シェルコンポーネントに分岐するか。データ層・featureのmodelは共有し、分岐はどの層で行うのが保守しやすいかを決める
- ナビゲーション形態（ボトムタブ / ドロワー等）とプレイヤーの表示形態（ミニプレイヤー＋全画面展開）
- 既存タスクとの整合: TASK-6（900px狭幅）・TASK-14（グリッド表示）・TASK-25（インスペクタ）がモバイルレイアウトとどう噛み合うか

決定後、モバイル実装のドラフト群（このタスク作成時に同時に起票）を確定内容に合わせて更新・promoteする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ブレークポイント戦略とシェル分岐方式が docs/adr/ に新規ADRとして記録されている
- [x] #2 スマホ初期スコープ（再生＋マーキングのみ・URL共通・管理系はPC専用）が仕様として docs/ に明文化されている
- [x] #3 TASK-6・TASK-14・TASK-25 との整合方針がADRまたは各タスクのノートに反映されている
- [x] #4 モバイル実装ドラフト群が決定内容に合わせて更新されている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## 事前調査（2026-07-11 実施、実装は未着手）

### 現状把握
- ルーティング: ルーターライブラリ不使用。features/navigation/model/navigationUrl.ts の parseNavigationUrl + useNavigationHistory による独自管理（AppMode）。URL共通方針と相性が良く、モバイル分岐はビュー層だけで完結できる
- AppShell: 純レイアウト（スロット式）。grid-template-rows: 48px 38px 1fr / columns: 56px 1fr（LeftNavは56pxアイコンレール）
- PlayerDock: fixed オーバーレイで bar/popup の2モード（playerUiModeAtom, atomWithStorage）。モバイルのミニプレイヤーは第3のモードか専用コンポーネントかが論点
- ストリーミング: server の adapter が byte range 読み出し対応済みで、スマホ再生は技術的に既に成立する見込み
- @media はコードベースにほぼ無し。ブレークポイントは新規設計

### ユーザー決定待ちの論点
1. ブレークポイント構成
   - 案A（推奨）: 768px 単一分岐でモバイル/デスクトップの二値。TASK-6 の900px問題はデスクトップ内の狭幅調整として独立に扱う
   - 案B: sm/md/lg の多段トークンを最初から定義
2. モバイルナビ形態
   - 案A（推奨）: ボトムタブ（ライブラリ / スマートフォルダー / お気に入り の3タブ想定）＋その上にミニプレイヤー
   - 案B: 上部ハンバーガー＋ドロワー（LeftNavの内容をそのまま流用）
3. シェル分岐方式
   - 案A（推奨）: MobileShell を別コンポーネントとして新設し、App.tsx で useMediaQuery による出し分け。スロット（body, fullScreenPlayer, overlays）は共有、topBar/addressBar/leftNav はモバイルでは使わずタブ＋簡易ヘッダーに置換
   - 案B: AppShell に @media を足してCSSで畳む（コンポーネント追加なし、ただし条件分岐がCSSに散る）
4. 「あとで整理」フラグのデータモデル
   - 案A（推奨）: Work に独立フィールド（favorite / needsReview 等）を持たせ shared の契約に追加
   - 案B: 特殊タグとして表現（既存タグ機構に相乗り）
5. 続きから再生（再生位置のサーバー保存）を初期スコープに含めるか
   - 推奨: 初期スコープ外（「再生とマークだけ」の合意に従い、効果が大きいので次フェーズ最有力候補としてドラフト起票）

### 決定後の流れ
ADR起草（docs/adr/0005）→ design-system.md へモバイル規約追記 → DRAFT-13〜18 を決定内容で更新・順次promote
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
5論点すべてユーザー決定済み（2026-07-11）: 768px単一分岐 / ボトムタブ / MobileShell分岐 / マークはタグ表現 / 続きから再生は初期スコープ外。マークのタグ化はユーザー提案（個別属性を増やさず仕様を単純に保つ）。お気に入りも同原則でタグとし、スマートフォルダーのタグ条件と整合させた。ドラフト更新は promote→edit→demote で実施したためドラフトIDが変動（シェル=DRAFT-19、ブラウズ=DRAFT-20、マーキング=DRAFT-21）。続きから再生を DRAFT-22 として次フェーズ候補に起票。別エージェント作業中のため docs 変更はコミットしていない。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
モバイルUI方針を docs/adr/0005-mobile-ui-strategy.md として記録（スコープ=再生+マークのみ、URL共通、768px単一分岐、MobileShell新設、ボトムタブ、マークはフラットタグ、PWA）。design-system.md にモバイルレイアウト節を追加。TASK-6/14/25 との整合方針をADR帰結に記載。モバイル実装ドラフト（DRAFT-14/17/18/19/20/21）を決定内容へ更新し、次フェーズ候補として DRAFT-22（続きから再生）を起票。
<!-- SECTION:FINAL_SUMMARY:END -->
