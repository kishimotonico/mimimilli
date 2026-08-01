---
id: TASK-167
title: メタファイル名を .meta.json から mimimilli.json に変更する
status: To Do
assignee: []
created_date: '2026-08-01 18:44'
labels: []
dependencies: []
priority: high
ordinal: 177000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
出典: メタファイル名の検討 2026-08-02（本会話でユーザー合意）。メタファイル名.meta.jsonは出自が分からず一般名詞すぎて衝突・検索性に難がある。Windowsではドットファイルが隠れないため先頭ドットの意味も薄い。ユーザー決定: ブランド名を冠したmimimilli.json（ドットなし）へ変更する。ファイルモード改修（TASK-163〜165）でメタの手動生成・削除を作る前に実施する。

要件:
- スキャナーの検出対象をmimimilli.jsonに変更する。新規生成も同名にする
- 既存の.meta.jsonはスキャン時に検出したらmimimilli.jsonへ自動リネームして移行する（メタファイルはアプリ管理物なのでリネームしてよい。音声等ユーザーのファイルは不変）。恒久的な旧名読み取りフォールバックは残さない
- *.meta.json（プレフィックス付き変種、単一ファイル形式のメタ）の現仕様を確認し、新名でどう扱うか（廃止 or *.mimimilli.json）をタスク内で決めて統一する
- docs（requirements-v4.mdのメタ仕様記述等）を新名に更新する

現状のコード側事実（調査済み、2026-08-02）:
- メタ定数: server/src/adapters/real/meta.ts:8 の META_SUFFIX = ".meta.json"。同ファイルのisMetaFileName（:11-13）がフォルダー形式".meta.json"と単一ファイル形式"xxx.meta.json"の両方を判定している
- 新規生成: server/src/adapters/real/scanner.ts:944（generateMetaForFolder内）でjoin(workDir, ".meta.json")を書き込み
- 検出・登録: scanner.ts:579付近でprepareSingleMeta(join(workDir, ".meta.json"))
- 表示除外: server/src/adapters/real/fsBrowse.ts:85でentry.name.endsWith(".meta.json")のファイルをファイルツリー表示から隠している
- .meta.jsonという文字列はdocs/requirements-v4.md、docs/ARCHITECTURE.md、docs/adr/0001,0003,0005,0008、shared/src/meta.ts、shared/src/work.ts、server配下の多数のテストヘルパー・テストに広く出現する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 新規スキャンでフォルダに mimimilli.json が生成される
- [ ] #2 既存の .meta.json を含むフォルダをスキャンすると mimimilli.json へ自動リネームされ、作品の登録状態（履歴・タグ含む）が維持される
- [ ] #3 *.meta.json（単一ファイル形式の変種）の新名での扱いが決まり、タスク内の方針に沿って統一的に実装されている
- [ ] #4 リポジトリ内（server/client/shared/docs）に .meta.json を参照するコードが残らない（テスト・docsのメタ仕様記述を含む）
<!-- AC:END -->
