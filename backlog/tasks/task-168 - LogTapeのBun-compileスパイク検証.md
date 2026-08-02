---
id: TASK-168
title: LogTapeのBun compileスパイク検証
status: In Progress
assignee: []
created_date: '2026-08-02 06:58'
updated_date: '2026-08-02 07:05'
labels: []
dependencies: []
priority: high
ordinal: 178000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ロギングライブラリ選定（2026-08-02、LogTape採用をスパイク条件付きで決定）の検証工程。数十行の使い捨てスクリプトをbun build --compileし、単一バイナリでLogTapeのfile sink（JSON Linesフォーマッタ）が動くかを確認する。不合格の場合はpinoのtransportなし・pino.destination()構成に切り替える。設計方針はアーティファクト「ログ・トレーサビリティ設計方針」参照。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 compileした単一バイナリでfile sinkがJSONLファイルに書き込める
- [x] #2 正常終了およびCtrl+C時にバッファがflushされログが失われない
- [ ] #3 Windowsネイティブでも同スパイクが動作する（WSLと両方で確認）
- [ ] #4 結果（合否と根拠）をタスクノートに記録し、不合格時はpino切替の方針を明記する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. scratchpad内の使い捨てディレクトリでLogTape+file sink(JSONL)の最小スクリプトを作成(Cursorに委譲)
2. bun run→bun build --compileの順で動作確認、flush(正常終了/SIGINT)とパス挙動も検証
3. WSL側の結果をノートに記録
4. Windowsネイティブ検証はユーザーが実施(AC#3)
5. 合否判定し、不合格ならpino(transportなし構成)へ切替方針を記録
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
WSL側検証完了(Cursor委譲、Bun 1.3.14 / LogTape 2.3.0)。結果: 条件付き合格。
- bun run / compile単一バイナリともfile sink+JSONLフォーマッタ動作、日本語・文脈フィールド正常(30/30行)
- 注意1: compile後は import.meta.dir が /$bunfs になる。ログパスは絶対パス or process.argv[0]基準で解決すること
- 注意2: デフォルトbufferSize(8192)のままprocess.exit(0)すると末尾ログ欠落(23-24/30)。disposeSync() or bufferSize:0 or 正常終了時await dispose()が必須
- 注意3: SIGINTはハンドラ内でdispose()を呼べば欠落なし。デフォルトexitフック頼みは不可
- 注意4: 初回configure()でmeta loggerのinfo案内が出る。本番はレベル調整
- 別cwd実行は絶対パス指定なら問題なし
成果物: scratchpad/logtape-spike/(src/spike.ts, run-tests.sh, results.txt)。Windowsネイティブ検証(AC#3)は未実施、ユーザーに依頼中
<!-- SECTION:NOTES:END -->
