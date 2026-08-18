---
id: TASK-285
title: unregisterWorkの退避メタが孤児化する経路を塞ぐ
status: Done
assignee: []
created_date: '2026-08-09 19:14'
updated_date: '2026-08-10 19:59'
labels: []
dependencies: []
priority: high
ordinal: 295000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-281のクラッシュセーフ化に未達の窓がある。

server/src/adapters/real/workRegister.ts:133 の unregisterWork は「メタを .mimimilli.json.unregistering へrename退避 → catalog行削除 → user状態削除 → 退避ファイル削除」の順で進む。JS例外は catch → restoreStagedMeta で守られているが、プロセスがkillされた場合は復元も掃除も走らない。

窓は2つある。

1. 退避後・catalog削除前にkill … 作品はcatalogに残ったままメタファイルだけが退避名で消えた状態になる。次回スキャンはメタ無しとして扱うため、タグ・DLsite情報を持つ正本が事実上失われる。こちらのほうが影響が大きい
2. catalog削除成功後・退避ファイル削除前にkill … 再起動後は getWorkDeleteTarget が null を返して即false で抜けるため回収に到達しない。退避ファイルがフォルダー内に残り続け、再登録時に新規メタで上書きされる

grep で確認したところ unregistering の文字列は workRegister.ts:61（パス生成）にしか現れず、スキャンにも掃除経路が無い。発生確率は低いがユーザーデータ喪失につながる。

対応案: スキャンのメタ読取り経路で孤児退避ファイルを検知し、catalogに該当workが存在すれば正本へrename復元、存在しなければ削除する。ADR-0008の保全要件へ追記すること。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 退避後・catalog削除前のkillを模した状態から、スキャンでメタ正本が復元されること
- [x] #2 catalog削除後・退避ファイル削除前のkillを模した状態から、スキャンで孤児退避ファイルが除去されること
- [x] #3 上記2つが再現テストで担保されていること
- [x] #4 ADR-0008の保全要件に退避メタの回収が記載されていること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
退避後・catalog削除前の窓は、同じworkIdへunregisterを再実行すればstageMetaForDeletionが退避済み状態を許容して続行できる構造ではある。ただしユーザーの再実行に依存するうえ、その前にスキャンが走るとメタ無しとして扱われて実害が出るため、自動回収が必要という判断。

Codexレビューでの補足（2026-08-10）: 窓2で孤児化した後にユーザーが同じフォルダーを再登録して新しい正本 mimimilli.json ができると、以降の unregisterWork は stageMetaForDeletion の「正本と退避が同時に存在します」（workRegister.ts:102 付近）で失敗し続ける。回収ロジックはこの正本・退避同時存在状態も解消対象に含めること（受け入れ条件#2の検証にこのケースを含めるのが望ましい）。

実装: 退避パス生成・検知を server/src/adapters/real/metaStaging.ts へ切り出し、walk が .<正本名>.unregistering を stagedMetaPaths として収集。scanMetaStagingRecovery.ts の recoverStagedMetaFiles を walkPhase と registerPhase の間で実行し、併存→退避削除 / 正本なし＋catalogあり→正本へ復元 / 正本なし＋catalogなし→退避削除 の順で判定。復元した正本は metaPaths・metaDirs・dirsWithMetaInSubtree へ反映して当該回のスキャンで登録する。ID不読・fs操作失敗はログに記録してスキップし、スキャンは継続する。検証: 新規テスト5件を workUnregister.test.ts に追加。回収を外すと窓1・窓2・併存の3件が落ちることを負のコントロールで確認。pnpm check && pnpm test は Bun 558 pass / Vitest 794 pass。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
unregisterWork がプロセス停止で残した退避メタを、通常スキャンの回収フェーズで正本復元または削除するようにした。正本と退避の併存も解消するため、以降の登録解除が恒久的に失敗する状態も救える。回収規則は ADR-0008 の保全要件へ追記。
<!-- SECTION:FINAL_SUMMARY:END -->
