---
id: TASK-447.11
title: ビュー一覧のエラー行の警告アイコンを他の行と縦に揃える
status: Done
assignee: []
created_date: '2026-09-11 04:27'
updated_date: '2026-09-11 04:47'
labels:
  - ui
  - ux
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 479000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
実機確認フィードバック第1回（tmp/uiux-triage-2026-09-11/followup-1.md の1）。左サイドバー「ビュー」の「エラー」行（AxisColumn.tsx の ax.id === "error"）の三角アイコンが他の行のアイコンと縦位置が揃っていない。原因を計測で特定してから直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 エラー行と他のビュー行のアイコンの縦中心の位置が、計測値（getBoundingClientRect）で揃っている
- [x] #2 原因（viewBox・サイズ・line-height・余白など）が計測値とともにタスクメモに記録されている
- [x] #3 着手前後のスクリーンショット（fixture、1440x900、ビュー一覧付近の切り出し）を tmp/uiux-triage-2026-09-11/shots-intake/447.11-before.jpg と -after.jpg に置いている
- [x] #4 変更範囲のテストが通り、既存テストの期待値を辻褄合わせで削除・緩和していない（仕様変更で消した・書き換えたテストはタスクメモに列挙）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 計測（1440x900、dev:fixture:errors、getBoundingClientRect + SVG getBBox + canvas centroid）

修正前、ビュー一覧5行（すべての作品/最近再生/最近追加/お気に入り/エラー）の .mll-axis 行・.ic span・svg 要素の getBoundingClientRect は、全行で row中心=icon box中心=svg中心が誤差0.01px以内で一致していた（例: エラー行 rowCenter=248.586 / svgCenter=248.578）。つまり「箱」としてのアイコン配置はCSS上すべて完全にセンタリングされており、行レイアウト側（.mll-axis の grid align-items:center、.ic の place-items:center、バッジ有無によるセル高さ差など）に原因はなかった。

SVG座標系でのpath bbox（getBBox、viewBox 0 0 24 24基準）も、エラー行のTriangleAlertは y=2.986〜21.0（中心11.993）で幾何学的にはほぼ中心（12）に一致しており、box自体の非対称も無かった。

原因はアイコンの視覚的重心（インクの分布）にあった。各アイコンのsvgをcanvasにレンダリングし、不透明ピクセルのY座標をアルファ加重平均した重心（viewBox単位、中心=12が基準）を比較:
- すべての作品(grid): 11.97 (offset -0.03)
- 最近再生(refresh): 11.97 (offset -0.03)
- 最近追加(plus): 11.97 (offset -0.03)
- お気に入り(star): 12.46 (offset +0.46)
- エラー(TriangleAlert): 14.09 (offset +2.09) ← 他より約2 viewBox単位（14px表示で約1.2px）下寄り

TriangleAlertは三角形の底辺＋感嘆符のドットが下側に集中しており、path bboxは中心対称でも「見た目の重さ」が下に寄るため、他のアイコンより低い位置にあるように見えていた。バッジの有無やviewBox/line-height差は原因ではなかった。

## 修正

client/src/shared/ui/Icon.tsx の `err` を `lucideIcon(TriangleAlert)` から、TriangleAlertのpathを `<g transform="translate(0 -2)">` で2 viewBox単位（24x24基準）だけ上へ寄せたカスタムSVG定義に変更。sizeプロパティに対して相対的なviewBox座標系での補正のため、I.errを使う全箇所（NotificationBell / Toast / WorkRow / WorkTile / DataIntegrityWarningBanner / PlaybackErrorNotice / SmartFolderEditorModal / SmartFolderView / WorkDetail / WorkStatusWarnings、size 10〜16px）に一律で正しく効く。

修正後の同じcentroid計測: エラー行 centroid=12.09 (offset +0.09) となり、他アイコン（-0.03〜+0.46）と同水準に収まった。ページ座標での重心とrow中心の差も、エラー行+0.045px（修正前は+2px相当のズレ）に対し、他アイコンは-0.02〜+0.27pxの範囲であり同等になった。

## 対象外にしたアプローチ

行レイアウト側（.mll-axis や .ic）へのtranslateY等の数値合わせは、原因がアイコン単体（TriangleAlertのグリフ自体）にあり、他画面のI.err使用箇所にも同じ非対称が存在するため採用しなかった。修正はアイコン定義（Icon.tsx）に閉じ、行レイアウト・CSSは変更していない。

## レビュー指摘への追加対応（2回目コミット 5ea0e8f）

### (1) WorkRow一覧の二重補正
client/src/styles/shell/library-d.css の .mll-wrow__status { vertical-align: -1px; } は
fd9c0ae（I.err導入時）に、旧TriangleAlertが視覚的に低く見える分を一覧行側で個別に
相殺するために追加されたものと判明（git logで確認）。67b1890でアイコン自体の
重心を補正したため二重補正になっていた。

計測（1440x900、dev:fixture:errors、「メタデータ生成エラー作品」行）:
- 修正前（-1px残存）: アイコンのインク重心とタイトル1行目テキストの行ボックス中心の差 = +1.04px
- vertical-align: baseline（＝-1px除去後と等価）: 差 = 0.04px
- -1px除去後の実測（再ビルド後）: 差 = 0.04px、computedスタイルは baseline

-1pxを削除。スクリーンショット: shots-intake/447.11-after-list.jpg

### (2) size=10でのクリッピング懸念
最小使用箇所 SmartFolderView.tsx:43（size=10、strokeWidth=2.4）で、translate(0 -2)後に
自然な頂点形状（viewBox y<0相当）がSVGのデフォルトoverflow:hiddenで理論上ごく僅かに
削れることを、viewBox="0 0 24 24"（実際の描画）と viewBox="0 -6 24 24"（削れない基準）の
canvasピクセル比較で確認。差分が最初に出る位置はy_vb=0、alpha差21/255（クリップ側152 vs
基準131）で、vb単位で0.02程度（10px表示で約0.008px相当）。実ブラウザでの15倍ズーム
スクリーンショットでは頂点の丸みが自然に見え、視認できる欠けはなし。理論上の
サブピクセル未満の差であり、実害なしと判断してコード変更なし。

### (3) Svgヘルパーへの統合
Icon.tsx の err を独自svg丸ごと記述から、既存の Svg ヘルパー（play/pauseなどが使う
共通実装）へ `transform` propを追加して寄せる形に統一。Svgは `d`（string|string[]）に
加えて任意の `transform`（viewBox座標系のtranslateなど）を受け取れるようになり、
指定時のみ内部で `<g transform>` にラップする。汎用化はこの1プロパティのみに留めた。

## 検証（2回目分）
- pnpm --filter @mimimilli/client exec tsc --noEmit: pass
- pnpm check: pass
- pnpm --filter @mimimilli/client test: 147 files / 1085 tests all pass
- pnpm test:smoke: 25 passed
<!-- SECTION:NOTES:END -->
