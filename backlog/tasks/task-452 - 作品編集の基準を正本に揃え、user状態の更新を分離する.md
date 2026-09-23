---
id: TASK-452
title: 作品編集の基準を正本に揃え、user状態の更新を分離する
status: Done
assignee: []
created_date: '2026-09-21 10:48'
updated_date: '2026-09-23 22:17'
labels: []
dependencies: []
documentation:
  - docs/adr/0025-source-mutation-projection-read-separation.md
ordinal: 506000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0025 の「編集用読取り」「正本変更」契約を実装する。現在 getWork は catalog 由来の値に、その場で mimimilli.json から読んだ sourceRevision を載せて返すため、外部編集のあとに編集すると正本の配列が意図せず置換される（外部で追加されたタグが全置換で消える）。編集値と revision を同一の source 読取りから得る経路へ変える。あわせて WorkPatch が meta 正本のフィールドと user 状態の bookmarked を同一コマンドで受ける契約を廃止する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 編集値と sourceRevision が同一の source 読取り由来である
- [x] #2 正本を書く入口（作品編集ダイアログ・インラインタグ編集・DLsite適用preview）がすべて同じ編集用読取り契約を通る
- [x] #3 bookmarked の更新が sourceRevision を要求しない独立したコマンドになっている
- [x] #4 閲覧DTOが最新sourceのrevisionを合成しない。残す場合は projectedSourceRevision のように用途が違うと分かる名前になっている
- [x] #5 正本が壊れている作品で、閲覧できることと編集できないことが区別して表示される
- [x] #6 編集開始前の外部変更は編集snapshotに含まれ、編集開始後の外部変更は競合として拒否され外部の値が保護される
- [x] #7 正本snapshotのWork identity・locationが一致しない場合、別作品へ適用せず拒否する
<!-- AC:END -->















## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
getWork から sourceRevision 付与を外す変更の所有はこのタスク。TASK-454 は live probe と公開値更新の分離を担当する。同じ変更を二重に行わない。TASK-455 の結果契約はこのタスクで決める編集snapshotの型・応答契約を利用するため、先に合意しておく。

実装メモ（段階2）:

タグは配列置換CASではなく PUT/DELETE /api/works/:id/tags/:tag にした。サーバーが lock 内の現状に足す・外すので、編集開始後に外部が足したタグを消さない。パス値は decode したあと normalizedTagArraySchema と同じ正規化を通す。NFC と NFD は別タグとして往復する。

正本 mutation の成功応答は { snapshot }。TASK-455 はこの形を使う。snapshot を閲覧 Work キャッシュへは写さない。source クエリだけ setQueryData し、閲覧側は invalidate する。bookmark だけ user DB で sourceRevision 不要。閲覧キャッシュの bookmarked は patch してよい。

mimimilli.json の書き込みは mutateMetaSource 1本。lock 内で read → コールバック → atomic write。patchMetaFileCas は CAS 用の薄い包み。JSON/schema/formatVersion 不正は parse_error、ファイル欠損と identity/location 不一致は conflict、catalog に無いのは not_found。GET /source は lock なし。

projectMetaFile の内部は触っていない。成功後に現行シグネチャで呼ぶ。
<!-- SECTION:NOTES:END -->
