---
id: TASK-194
title: ポータルで描画される要素がアプリのスタイルリセットから外れる問題を直す
status: To Do
assignee: []
created_date: '2026-08-04 16:55'
labels: []
dependencies: []
priority: medium
ordinal: 204000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-191 の実装中に判明した横断的な不具合。クイックオーバーレイの検索欄にブラウザ既定の太枠が出ていた原因を追ったところ、より広い問題であることが分かった。

## 問題

スタイルのリセットとフォント指定が .mle-app にスコープされている（client/src/styles/shell.css）。

- .mle-app, .mle-app *: font-family（--font-jp）、font-smoothing、font-feature-settings
- .mle-app button: font/color/background/border のリセット
- .mle-app input 等: 同様のリセット

createPortal で document.body 直下へ出した要素は .mle-app の外に出るため、これらが一切適用されない。結果としてブラウザ既定のフォント・ボタン枠・入力欄の枠がそのまま出る。

TASK-191 では AxisQuickOverlay に対して個別に border:0 / outline:0 を書いて塞いだが、これは対症療法であり、ポータルを使う箇所が増えるたびに同じ不具合が再発する。

## 現在ポータルを使っている箇所

- client/src/features/library/ui/AxisQuickOverlay.tsx（TASK-191 で個別対処済み）
- client/src/features/files/ui/RegisterWorkDialog.tsx（未確認・同じ問題を抱えている可能性が高い）
- client/src/features/library/ui/preview/DlsiteEditor.tsx（同上）

## 対応方針（統括判断）

個別のコンポーネントに打ち消しCSSを足していく方式は採らない。リセットとフォント指定を .mle-app 依存から切り離し、ポータル先のルート要素にも同じ基盤が当たる形にする。具体的な手段（共通クラスを切り出してポータルルートに付与する / スコープを body 側へ引き上げる / ポータル用のラッパーコンポーネントを用意する）は実装者判断でよいが、ポータルを新しく追加した人が何もしなくても正しく描画される形にすること。

TASK-191 で AxisQuickOverlay に入れた個別対処も、基盤側で解決したら不要になるはずなので取り除くこと。

関連: TASK-108（ビジュアルテストのフォント依存を解消する）。ポータル要素にフォント指定が効いていない点はこちらとも関係する可能性がある。

対象: client/src/styles/shell.css / 上記3コンポーネント / docs/design-system.md（規約として記載する）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ポータルで document.body 直下へ描画される要素にも、アプリのフォント指定とフォーム要素・ボタンのリセットが適用される
- [ ] #2 RegisterWorkDialog と DlsiteEditor で、ブラウザ既定のフォントや枠が出ていないことを実機で確認している
- [ ] #3 TASK-191 で AxisQuickOverlay に入れた個別の打ち消しCSSが不要になり取り除かれている
- [ ] #4 新しくポータルを追加する際に個別対処が要らない仕組みになっており、その方法が docs/design-system.md に記載されている
- [ ] #5 pnpm check と pnpm test が通る
<!-- AC:END -->
