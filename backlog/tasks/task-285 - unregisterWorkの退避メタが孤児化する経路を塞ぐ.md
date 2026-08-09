---
id: TASK-285
title: unregisterWorkの退避メタが孤児化する経路を塞ぐ
status: To Do
assignee: []
created_date: '2026-08-09 19:14'
updated_date: '2026-08-09 19:18'
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
- [ ] #1 退避後・catalog削除前のkillを模した状態から、スキャンでメタ正本が復元されること
- [ ] #2 catalog削除後・退避ファイル削除前のkillを模した状態から、スキャンで孤児退避ファイルが除去されること
- [ ] #3 上記2つが再現テストで担保されていること
- [ ] #4 ADR-0008の保全要件に退避メタの回収が記載されていること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
退避後・catalog削除前の窓は、同じworkIdへunregisterを再実行すればstageMetaForDeletionが退避済み状態を許容して続行できる構造ではある。ただしユーザーの再実行に依存するうえ、その前にスキャンが走るとメタ無しとして扱われて実害が出るため、自動回収が必要という判断。
<!-- SECTION:NOTES:END -->
