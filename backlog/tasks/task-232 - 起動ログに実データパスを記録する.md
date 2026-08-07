---
id: TASK-232
title: 起動ログに実データパスを記録する
status: To Do
assignee: []
created_date: '2026-08-07 12:50'
labels: []
dependencies: []
references:
  - docs/adr/0011-logging-logtape-jsonl.md
priority: medium
ordinal: 242000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Windowsでの開発ドッグフード時に、どのデータ領域とログファイルを使って起動したかをコンソールとJSONLから確認できるようにする。製品向け診断UIは作らず、既存のserver起動INFOを充実させる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 real adapterの起動INFOに、解決済みdata root、catalog DB、user DB、log fileの絶対パスがpropertiesとして記録される
- [ ] #2 ログ初期化処理が実際に選んだlog fileパスを呼び出し元へ返し、起動側でファイル名生成規則を重複実装しない
- [ ] #3 fixture adapterの起動INFOには存在しないDBパスやlog fileを空値・推測値で記録しない
- [ ] #4 既存のconsole sinkとreal adapterのfile sink、起動メッセージ、正常終了時のflush挙動が維持される
- [ ] #5 realとfixtureの起動ログ差分を対象テストで確認できる
<!-- AC:END -->
