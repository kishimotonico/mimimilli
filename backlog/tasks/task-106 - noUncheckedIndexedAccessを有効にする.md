---
id: TASK-106
title: noUncheckedIndexedAccessを有効にする
status: Done
assignee:
  - '@cursor'
created_date: '2026-07-26 14:35'
updated_date: '2026-07-26 14:47'
labels: []
dependencies: []
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
tsconfig の strict は有効だが noUncheckedIndexedAccess が無効なため、配列やRecordのインデックスアクセスに undefined が付かない。TASK-104.1 で残した AxisColumn の PREFIX_ICONS[p.prefix] ?? "folder" のように、実行時に必要なフォールバックが型上は不要に見え、将来削除される危険がある。有効化すると client 23件・server 17件・shared 0件のエラーが出る(計測済み)。件数が多いのは client の useAudioEngineLifecycle.ts が10件、server の thumbnail.test.ts と dlsiteCacheCli.ts が各6件。機械的に non-null assertion で潰さず、undefined があり得るかを箇所ごとに判断する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 3パッケージすべての tsconfig で noUncheckedIndexedAccess が有効
- [x] #2 pnpm check が通る
- [x] #3 undefined があり得ない箇所は型が絞られる形に直され、non-null assertion の新規追加が最小限に留まる
- [x] #4 undefined があり得る箇所はエラーまたは明示的な既定値として扱われ、黙って落とす処理を追加していない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cursorが実装。non-null assertion の新規追加ゼロ。useAudioEngineLifecycle の10件は if (!track) return; 1つで解消。dlsiteCacheCli は args.length で存在が保証される箇所だが ! ではなく USAGE の throw を選択(不変条件が壊れたとき気付けるため)。
<!-- SECTION:NOTES:END -->
