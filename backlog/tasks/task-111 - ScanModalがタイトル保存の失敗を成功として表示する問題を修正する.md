---
id: TASK-111
title: ScanModalがタイトル保存の失敗を成功として表示する問題を修正する
status: Done
assignee: []
created_date: '2026-07-27 01:57'
updated_date: '2026-07-30 07:04'
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
- [x] #1 タイトル保存が失敗したとき、画面にエラーが表示される
- [x] #2 保存が失敗したときローカルの表示名が更新されない
- [x] #3 保存成功時は従来どおり表示名が更新され編集モードが閉じる
- [x] #4 空文字・空白のみのタイトルは従来どおり保存されない
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. handleSaveTitleをtry/catchにし、失敗時はローカルstate更新をスキップしてエラーを保持、成功時のみeditingIdを閉じる
2. 保存中はinputをdisabledにして二重送信を防止し、trackCount表示を「保存中…」に切り替える
3. 保存失敗時はSmartFolderEditorModalのエラー表示（role=alert, r-coral）に揃えたインラインエラーをNewWorkRowに追加し、編集モードを維持して再試行可能にする
4. 空文字・空白のみは従来どおりpatchWorkを呼ばずeditingIdだけ閉じる
5. scanModal.test.tsに成功/失敗/空文字の3ケースを追加、既存テストが漏れているmock汚染を防ぐためafterEachでvi.restoreAllMocksを追加
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装完了。ScanModal.tsx: handleSaveTitleをtry/catchに変更し失敗時はr-coralのインラインエラー（role=alert）を表示、newWorksは更新せず編集モードも維持（再試行可能）。保存中はinput disabled + 「保存中…」表示で二重送信防止。空文字は従来どおり無視して編集を閉じる。エラー表示はSmartFolderEditorModalのsaveErrorスタイルに揃えた。scanModal.test.tsに成功/失敗/空文字の3テストを追加し、既存テストのpatchWorkモック汚染防止のためafterEachでvi.restoreAllMocksを追加。pnpm check / pnpm test 全通過（client 346件, server 344件）。ブラウザでの実機確認は未実施（検証担当が対応予定）。

検証担当による確認完了。AC4件合格。破壊テスト実施: handleSaveTitle を旧実装相当（catch握りつぶし）へ一時的に戻すと追加テストが「Unable to find an element with the text: タイトルの保存に失敗しました」で失敗することを確認し、復元後13/13合格。二重送信レース（Enter直後のblur発火）も一時テストで patchWork 1回のみを確認。実機はスキャンモーダルの newWorkIds が空で編集行が存在せず操作不能のため、単体テスト＋コードレビューを代替根拠とした（新規スキャン実行はデータ変更リスクのため回避）。エラー表示は SmartFolderEditorModal の role=alert + coral トークンと一致、design-system 準拠。軽微な任意改善1件: 保存中にモーダルが閉じられた場合の patchWork 継続 Promise にキャンセルガードがない（newWorks 初回ロード effect には cancelled ガードあり）。実害は未確認のためブロッカーとしない。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ScanModal の handleSaveTitle が patchWork の失敗を catch で握りつぶし、ローカル state だけ更新して保存成功に見せていた問題を修正。失敗時はエラー表示（role=alert、SmartFolderEditorModal と同一パターン）を出し state を更新せず編集モードを維持して再試行可能にし、保存中は input を disabled にして二重送信を防止。単体テスト3ケースを追加し、検証担当が破壊テストで実効性を確認。
<!-- SECTION:FINAL_SUMMARY:END -->
