---
id: TASK-97
title: metaIdMigrationのクラッシュセーフ機構を要件相当まで簡素化する
status: To Do
assignee: []
created_date: '2026-07-25 23:34'
updated_date: '2026-07-29 18:25'
labels: []
dependencies: []
priority: medium
ordinal: 98000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
metaIdMigration.ts（701行）のクラッシュセーフ機構が要件に対して過剰ではないかを検証し、存廃を決める。

対象の機構:
- manifest の永続化（先行採番の記録）
- .bak バックアップ（ensureBackup）
- checkpoint コールバック
- VerifiedIdSignature によるハッシュ再計算スキップキャッシュ

呼び出し元は scanner.ts の1箇所のみ。

## 重要: 起票時の前提が崩れている（2026-07-30 の棚卸しで判明）

起票時は「ADR-0003 の『失敗したら再スキャンで戻る』という設計思想からして過剰」を根拠にしていたが、**ADR-0003 は ADR-0008 により廃止済み**（docs/adr/0003-no-db-migrations.md:3）。

代わりに現行の ADR-0008（承認済み）が、既存 meta の一括変更と重複修正に対して manifest 先行採番・バックアップ・外部編集保護を要求している（docs/adr/0008-persistence-topology-query-ownership-playback-ids.md:127 付近）。つまり本タスクは現行 ADR と正面から衝突する。

したがって本タスクは「削除する実装タスク」ではなく、**計測と設計判断を行うゲートタスク**として扱う。削るという結論が先にあるわけではない。

## 判断の進め方

1. 署名キャッシュの効果を計測する。計測条件（cold/warm、ライブラリ規模、試行回数、中央値）を先に決めること。条件を決めずに測ると結論が再現できない
2. manifest・バックアップ・checkpoint・署名キャッシュを一括で「過剰」と扱わず、役割ごとに評価する。ADR-0008 が要求しているのは主に manifest 先行採番・バックアップ・外部編集保護であり、署名キャッシュは性能最適化なので性格が異なる
3. ADR-0008 の要求を変更するなら、ADR 側の更新までを本タスクに含める

## 署名キャッシュを削除しても残る意味要件

scanner.ts の重複検査だけでは Playlist / Track の修復を代替できない。次は機構の存廃に関わらず維持が必要:

- Work / Playlist / Track ID のライブラリ全体での一意性
- 安定した順序による先勝ち
- Work 再採番時の子 ID 更新
- defaultPlaylistId の追従
- 旧 meta への ID 補完
- 外部編集との競合保護

## TASK-89 との関係

TASK-89（size/mtime 判定を内容ハッシュで補強する）は、本タスクが削除候補に挙げている VerifiedIdSignature の強化を要求しており、方向が逆。本タスクを設計判断のゲートとし、結論に応じて分岐する。

- 署名キャッシュを維持する判断なら、TASK-89 を実装する
- 署名キャッシュを廃止する判断なら、本タスクの実装がマージされた時点で TASK-89 を superseded として閉じる

TASK-89 が指摘している正確性の問題（同一バイト長・同一 mtime で内容が変わると検知できない）は、署名キャッシュを維持する場合の必須要件として本タスクの判断材料に含めること。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 署名キャッシュのスキャン時間短縮効果を、事前に定めた条件（cold/warm・ライブラリ規模・試行回数・中央値）で計測し、結果を実装メモに記録している
- [ ] #2 manifest・バックアップ・checkpoint・署名キャッシュそれぞれについて、ADR-0008 の要求と計測結果を踏まえた存廃の判断と根拠が記録されている
- [ ] #3 ADR-0008 の要求を変更する場合、ADR 側の更新が行われている
- [ ] #4 不要と判断した機構が削除され、存置と判断した機構は残っている
- [ ] #5 重複UUIDの検出と再採番、ユーザーへの通知が従来どおり動作する
- [ ] #6 既存の manifest ファイルが残っていてもスキャンが失敗しない
- [ ] #7 TASK-89 の扱い（実装する / superseded として閉じる）が判断結果として記録されている
<!-- AC:END -->
