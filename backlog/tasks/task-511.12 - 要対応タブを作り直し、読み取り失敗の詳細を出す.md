---
id: TASK-511.12
title: 要対応タブを作り直し、読み取り失敗の詳細を出す
status: To Do
assignee: []
created_date: '2026-11-19 00:41'
updated_date: '2026-11-19 00:51'
labels:
  - scan
  - ui
dependencies:
  - TASK-511.5
  - TASK-511.7
  - TASK-511.11
references:
  - 'https://claude.ai/artifact/GbuEuRQyKeD9xN4CM3Fv1k'
documentation:
  - docs/adr/0034-scan-modal-restructure.md
parent_task_id: TASK-511
priority: high
ordinal: 581000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0034の「要対応は5種類」をクライアントに実装し、読み取り失敗の行番号と原因を出せるようサーバーのメッセージを改める。現行は client/src/features/scan/ui/scanModal/NeedsAttentionTab.tsx と client/src/features/scan/model/needsAttention.ts。TASK-511.7とScanModalが衝突するので、511.7の後に着手する。

文言と表示:
- 1つの表で、列は 種類 / 対象 / 起きていること / 推奨アクション。行アイコンは付けない。説明文は置かない。
- 種類と推奨アクション:
  - ID重複: 対象に各パス（Filesへのリンク、縦に並べる）。推奨アクション「どちらかを消すか、Filesで別の作品として取り込む」（既存の再採番 POST /works/identity-conflicts/reassign の導線に合わせる）。
  - 読み取り失敗: 対象にパス（リンク）。起きていることに行番号と原因（例「mimimilli.json 12行目: カンマが足りない」）。推奨アクション「ファイルを直す」。
  - アクセス不可: 対象にパス（リンク）。起きていること「フォルダーを開く権限がない」。推奨アクション「アクセス権を確認」。
  - データ不整合: 対象に作品ID（リンクなし）。推奨アクションはボタン「この作品を読み直す」（TASK-511.5）。
  - 行方不明: 対象に作品タイトル（押すと作品詳細ページを開き、スキャンモーダルを閉じる。openWorkDetailAtom）と旧パス（薄い文字、リンクなし）。起きていること「前回あったフォルダーが見つからない」。推奨アクションはボタン「登録を解除」（既存の DELETE /works/:id）。
- 並びは、直すもの（あなたの番の色）を先、行方不明を後。サイドバーの件数は直すものだけを数える。
- DLsite系（RJコード未検出・取得失敗・パース失敗）の行は出さない。
- データの出どころ: ID重複と読み取り失敗は GET /api/scan/diagnostics、アクセス不可・データ不整合・行方不明はTASK-511.11の実行単位の項目。

読み取り失敗のメッセージ: 今は scanner（server/src/adapters/real/scanner.ts の diagnostics.invalidMetaFiles）がパースや検証の例外メッセージをそのまま返している。行番号（JSONの構文エラー）と原因（どのフィールドがどう不正か）を、ユーザーが読める日本語で返すように改める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 要対応タブが5種類を「種類・対象・起きていること・推奨アクション」の1つの表で出し、DLsite系の行を出さない
- [ ] #2 直すものが先、行方不明が後に並び、サイドバーの件数が直すものだけを数える
- [ ] #3 読み取り失敗の「起きていること」に、JSONの構文エラーなら行番号と原因、検証エラーならフィールドと原因が日本語で出る（サーバーのテストで縛っている）
- [ ] #4 データ不整合の「この作品を読み直す」と行方不明の「登録を解除」がその場で動き、成功した行が消える
- [ ] #5 ID重複の対象の各パスと、読み取り失敗・アクセス不可のパスを押すとFilesで開き、行方不明の作品タイトルを押すと作品詳細ページが開いてスキャンモーダルが閉じる
- [ ] #6 pnpm test:smoke を含めて pnpm check・pnpm test が通る
<!-- AC:END -->
