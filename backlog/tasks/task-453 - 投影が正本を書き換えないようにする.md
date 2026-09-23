---
id: TASK-453
title: 投影が正本を書き換えないようにする
status: Done
assignee: []
created_date: '2026-09-21 10:48'
updated_date: '2026-09-23 22:17'
labels: []
dependencies: []
documentation:
  - docs/adr/0025-source-mutation-projection-read-separation.md
ordinal: 507000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0025 の「投影」契約。syncDetectedRjCode は assembleWorkForUpsert（scanRegister.ts）からのみ直接呼ばれ、registerMetaFile 経由で scan（フル、または fingerprint 変化）と単作品の登録・投影・復元（full:true）に入る。正本を観測する処理が正本を書き換える構造をなくす。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 scan と再投影の経路が mimimilli.json を書き換えない
- [x] #2 RJコード候補の検出そのものは残っている
- [x] #3 登録時に自動採用する場合、登録コマンドが一度の正本確定に含め、その確定済み snapshot を投影へ渡す
- [x] #4 既存作品の通常scanでは候補の提示までに留まり、適用は正本変更として扱われる
- [x] #5 一作品の投影値と由来revisionが、同じ入力snapshotに対応している
- [x] #6 公開前に入力の変更を検知した場合、古い投影を最新として公開せず、未反映・再確認が必要な状態として扱う
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. syncDetectedRjCode を削除し、assemble は prepared snapshot だけを使う
2. 登録は writeMetaFile 1回の戻り snapshot を投影へ渡す
3. publishWork でも discardChangedSources。単作品は ProjectOutcome を返す
4. 既存作品の候補提示は DlsiteEditor の初期値と警告文面のみ。新しい一括操作は足さない
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
入力変更の検知は、外部書込みを永久にロックする要求ではない。確認後の将来変更まで防ぐ保証や無限再試行は求めない。

RJコード確定の受け皿（2026-09-24決定）: 登録コマンドがフォルダー名等から検出したコードを1回の正本確定に含める。既存作品でコードが空のものは、scanは候補の検出までに留め、確定は作品編集（RJ/VJコード入力）での明示操作とする。新しい一括操作は追加しない。

実測（2026-09-24）: 直接呼び出しは assembleWorkForUpsert のみ。projectMetaFile は直接呼んでいないが registerSingleWorkFromPrepared → registerMetaFile 経由で必ず通る。ADR-0025 の経路記述は正しい。増分 scan の fingerprint 一致では assemble 前に skip するため空 RJ は埋まらない。設計: scratchpad/design-TASK-453.md

段階2実装（2026-09-24）: syncDetectedRjCode 削除。assemble は prepared.meta / revisions のみ。writeMetaFile と reassignMetaIdsOnDbCollision は { meta, bytes, sourceRevision } を返す。prepareSingleMeta / projectMetaFile は呼び出し側 snapshot を入力にしディスクを読み直さない。publishWork でも discardChangedSources。単作品投影の戻りは ProjectOutcome（work なし）。detectRjCode は shared へ移し server 再 export なし。

unpublished の暫定（TASK-455 が正式に扱う）: patchWork は getWorkWithLiveProbe を返し新 revision を載せない。reassignIdentityConflict と登録/復元は既存の取得失敗エラー。dlsitePersist は false。scanCandidateSession は failures[]。updateDlsiteState の応答組み立ては今どおり getWorkWithLiveProbe。旧 catalog 値と新 revision の合成はしない。

既存テストの正本: sample library の RJ900002_既存メタ、apply-missing 系の RJ フォルダー作品は、scan が書いていた RJ を mimimilli.json に移した。scan が正本を書き換えなくなったため。
<!-- SECTION:NOTES:END -->
