---
id: TASK-193
title: 値一覧の見出し行の折り返しで仮想化のレイアウトが崩れる問題を直す
status: In Progress
assignee:
  - impl-182
created_date: '2026-08-04 16:41'
updated_date: '2026-08-04 17:16'
labels: []
dependencies:
  - TASK-191
priority: high
ordinal: 203000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-192 のレビュー（2026-08-05）で見つかった副作用。ライブラリ再設計のブランチ内で対応し、マージ前に解消する。

## 1. 見出し行の折り返し × 行高固定の衝突（対応必須）

階層表示の見出し行には nowrap 指定がなく、長いセグメント名で折り返しうる。

- .mll-qlist__heading（shell.css:1640-1647）: nowrap 無し
- .mll-vrow-heading（shell.css:1431-1442）: nowrap 無し
- 値行 .mll-qlist__item .nm（shell.css:1627-1632）は nowrap + ellipsis で折り返さない

一方 AxisValueQuickList・AxisValueRows はいずれも仮想化されており、行の高さを固定値で見積もっている。見出しが折り返して実高さが見積もりを超えると translateY の計算がずれ、以降の行が重なる・スクロール位置がずれる。見出しの数だけズレが累積する。

見出しラベルはタグの1セグメント名（ユーザーの自由記述）なので、長い名前は現実に起こりうる。

nowrap 欠如自体は再設計以前から存在した潜在的な穴だが、仮想化の導入によって初めて実害（レイアウト崩壊）に変わった。値行と同じ扱いに揃えて塞ぐ。オーバーレイ側だけでなく値一覧本体側も同じ問題を抱えているので両方直すこと。

## 2. measureElement が実測を捨てているのに計測しているように見える（対応必須）

AxisValueQuickList.tsx:95,104 の measureElement は実DOM要素を無視して常に定数を返すのに、234行目で各行に ref={virtualizer.measureElement} を配線しており、ResizeObserver による動的計測をしているように読める。実態と見た目が食い違っている。

統括判断: 1 の対応で全行が1行に収まるようになるため、固定見積もりのままでよい。ただし誤解を招く ref 配線と名目だけの measureElement は取り除き、固定高さで見積もっていることがコードから読み取れる形にする。

## 3. activeIndexRef が items の変化でリセットされない（低）

resetKey（AxisValueQuickList.tsx:107）が axis:sort.key:sort.direction:query のみで items を含まない。同じ軸・ソート・検索語のまま、選択中タグの変化などで facet の中身が変わったとき activeIndexRef が古いまま残る。

範囲外でもクラッシュはしないが、旧実装（activeElement から逆算、見失うと -1 扱い）では ArrowUp が末尾へ飛んだのに対し、新実装ではラップ計算経由で先頭へ着地する場合があり挙動が変わっている。意図した変更ではないため、items の同一性を resetKey に含めて元の着地点に揃える。

## 4. 何も検証していないテストがある（低）

AxisValueQuickList.test.tsx:54-62 の「スクロールコンテナに max-height によるクリップがある」テストは要素の存在を truthy 判定しているだけで、max-height / overflow-y が効いているかを検証していない。実効性のあるアサーションにするか、担保できないなら削除する（通すためだけのテストを残さない）。

対象: client/src/styles/shell.css / client/src/features/library/ui/AxisValueQuickList.tsx / AxisValueRows.tsx / client/tests/unit/AxisValueQuickList.test.tsx
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 見出し行が長いセグメント名でも折り返さず、値行と同じく省略表示になる（クイックオーバーレイ・値一覧本体の両方）
- [x] #2 見出しを含むリストを仮想化スクロールしても行が重ならず、スクロール位置がずれない
- [x] #3 measureElement の名目だけの実装と誤解を招く ref 配線が取り除かれ、固定高さで見積もっていることがコードから読み取れる
- [x] #4 resetKey に items の同一性が含まれ、facet の中身が変わったときに activeIndexRef がリセットされる
- [x] #5 位置未確定の状態からの ArrowUp が末尾へ着地する（旧実装の挙動に揃っている）
- [x] #6 何も検証していないテストが、実効性のあるアサーションに直されているか削除されている
- [x] #7 pnpm check と pnpm test が通る
<!-- AC:END -->
