---
id: TASK-111
title: ScanModalがタイトル保存の失敗を成功として表示する問題を修正する
status: To Do
assignee: []
created_date: '2026-07-27 01:57'
labels:
  - client
  - scan
  - bug
dependencies: []
priority: high
ordinal: 119000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
コンポーネント設計レビュー（2026-07-27）で発見。コード上は確定、実機での再現確認は未実施。

ScanModal.tsx:132 の handleSaveTitle が patchWork(workId, { title }).catch(() => {}) で失敗を握りつぶし、その直後にローカルの newWorks state だけを新しいタイトルへ更新している。結果、保存に失敗しても画面上は保存されたように見え、リロードすると元のタイトルに戻る。

AGENTS.md の「過度なフォールバック禁止・エラーは正しくハンドリングし問題を隠蔽しないこと」に反する。

修正の方向:
- 失敗時はエラーを表示し、ローカル state を更新しない
- 保存中の状態表示と、失敗後の再試行手段も併せて検討する（他のモーダルのエラー表示と揃える）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 タイトル保存が失敗したとき、画面にエラーが表示される
- [ ] #2 保存が失敗したときローカルの表示名が更新されない
- [ ] #3 保存成功時は従来どおり表示名が更新され編集モードが閉じる
- [ ] #4 空文字・空白のみのタイトルは従来どおり保存されない
<!-- AC:END -->
