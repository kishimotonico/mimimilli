---
id: TASK-196
title: マージ前の最終レビュー指摘を解消する
status: Done
assignee:
  - impl-182
created_date: '2026-08-05 01:08'
updated_date: '2026-08-05 01:56'
labels: []
dependencies: []
priority: high
ordinal: 206000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codex による master マージ前の最終レビュー（2026-08-05、base=de83c06、39コミット・143ファイル）で見つかった4件を解消する。3件は ADR-0012 との乖離を伴う実質的なバグで、いずれも通常のテストでは捕捉されない画面状態・入力の組み合わせ。

## 1. 予約タグの検証が正規化前の文字列にしか効いていない（shared/src/work.ts:383-384）

tagSchema は tag.startsWith("@") を生文字列のまま検証しているが、normalizeTag（同ファイル350行）は前後空白を trim してから prefix を lowercase 化する。そのため先頭に空白のある文字列（例: 半角スペース + @year/2024）は検証を素通りし、normalizeTags を通ると予約プレフィックスの疑似タグに化ける。

さらに Source of Truth である metaFileSchema.tags がこの tagSchema を使っていない。結果、保存された実タグが splitSelectedTags で年フィルタの疑似タグと誤解釈され、その実タグの完全一致検索ができなくなる。ADR-0012 §2 の予約文字契約に反する。

全書き込み経路で正規化後の値を検証すること。

## 2. 値一覧のグリッド状態が切替UIに反映されない（libraryPresentation.ts:63-64）

isWorksGridActive は computeResultsPaneKind(axis) === "works" のときだけ判定し、facet/tag 軸（value-list）では常に false を返す。しかし実描画側の AxisValueList.tsx は libraryViewModeAtom を直接見て grid/list を切り替えている（51行目）。つまり実際にはグリッド表示されているのにアドレスバーの切替UIは「リスト選択中」のままで食い違う。

ADR-0012 §3・§5 は値一覧も表示設定に従うとしている。表示と操作UIの状態を一致させること。

## 3. 兄弟値の集計が他軸フィルタを引き継いでいない（FilterChipBand.tsx:69）

AxisValuePopoverPanel に selectedTags={[tag]}（自分自身のタグ1件のみ）を渡している。複数軸で絞り込んでいる状態でも buildAxisFacetFilterParams が自軸タグを除外すると無条件のファセット問い合わせになり、兄弟値の件数・総時間・カバーが他軸フィルタを無視する。

件数が表示されている値を選んだのに作品結果が0件、という空振りが起きうる。これは TASK-187 で自軸除外カウントを採用した目的そのものに反する。現在の全 selectedTags を渡し、自軸だけ除外する形にすること。

## 4. 使い捨てベンチスクリプトの混入（server/_bench_axisFacets_scratch.ts）

ファイル自身に「計測後に削除する」と明記された使い捨てスクリプトが、コミット 44ac818 に紛れ込んでいる（統括が worktree でパス指定コミットした際、未追跡ファイルを巻き込んだもの）。どこからも参照されておらず、旧カバー形式のオブジェクトも残っている。削除する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 予約文字の検証が正規化後の値に対して行われ、先頭に空白のある文字列で回避できない
- [x] #2 metaFileSchema.tags を含むすべての書き込み経路で予約文字の検証が効いている
- [x] #3 上記2点が単体テストで検証されている（空白始まりの回避を試みるケースを含む）
- [x] #4 値一覧をグリッド表示しているとき、アドレスバーの切替UIもグリッドを選択中として表示する
- [x] #5 チップの兄弟値ドロップダウンの件数・総時間・カバーが、他軸のフィルタを反映した値になる（自軸のみ除外）
- [x] #6 server/_bench_axisFacets_scratch.ts が削除されている
- [x] #7 pnpm check と pnpm test と pnpm test:visual が通る
<!-- AC:END -->
