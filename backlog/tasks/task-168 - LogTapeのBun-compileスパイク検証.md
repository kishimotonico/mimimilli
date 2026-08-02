---
id: TASK-168
title: LogTapeのBun compileスパイク検証
status: Done
assignee: []
created_date: '2026-08-02 06:58'
updated_date: '2026-08-02 13:54'
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
- [x] #3 Windowsネイティブでも同スパイクが動作する（WSLと両方で確認）
- [x] #4 結果（合否と根拠）をタスクノートに記録し、不合格時はpino切替の方針を明記する
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

Windowsネイティブ検証(AC#3)の自己完結手順(別PC用。この開発環境はSSH越しのため実機検証は別PCで行う):
1. 任意の作業フォルダで: mkdir logtape-spike && cd logtape-spike && bun init -y && bun add @logtape/logtape @logtape/file
2. spike.ts を作成:
---
import { join } from "node:path";
import { configure, getLogger, dispose } from "@logtape/logtape";
import { getFileSink, jsonLinesFormatter } from "@logtape/file";
const root = process.argv[0].includes("bun") ? import.meta.dir : join(process.argv[0], "..");
const logPath = join(root, "logs", "test.jsonl");
await configure({
  sinks: { file: getFileSink(logPath, { formatter: jsonLinesFormatter }) },
  loggers: [{ category: "spike", sinks: ["file"], lowestLevel: "debug" }],
});
const log = getLogger("spike");
for (let i = 0; i < 30; i++) log.info(`[${i}] 日本語ログの書き込みテスト`, { workId: `RJ${100000 + i}`, seq: i });
await dispose();
console.log("done: " + logPath);
---
3. mkdir logs して bun run spike.ts → logs/test.jsonl に30行(1行1JSON・日本語が化けない)ならOK
4. bun build --compile --outfile spike-bin.exe spike.ts && .\spike-bin.exe → 同様に30行ならOK(logsフォルダはexeと同じ場所に必要)
5. 結果をこのタスクに報告してAC#3をチェック
WSL検証時の注意: compile後はimport.meta.dirが/$bunfsになるためexe基準のパス解決が必要(上記スクリプトは対応済み)。バッファ既定のままprocess.exitすると欠落するためawait dispose()必須

Windows検証用スパイクをリポジトリに追加: scripts/spike/logtape-file-sink/（手順はWINDOWS-SMOKE.md。別PCでpull→bun install→手順どおり。WSLでは通常実行・compile・Windowsクロスコンパイルまで動作確認済み）。前のノートの手作業手順はこれで置き換え。
後始末の手はず（AC#3合格の確認後に実施）: ①scripts/spike/logtape-file-sink/ を削除 ②役目を終えているscripts/spike/bun-distribution/（TASK-70実証、結論はADR-0007記録済み）も同時に削除し、ADR-0007のスパイク参照2箇所（5行目・40行目）をGit履歴ポインタ（cad3f6c→正: cad3c6f）へ差し替える

Windowsネイティブ検証結果(別PC、C:\projects\mimimilli): bun runでの通常実行は合格(30行・1行1JSON・日本語無化け・文脈フィールド正常)。compile exeはスパイク自身のパス解決バグ(argv[0]がWindowsでは仮想FS B:/~BUN側になる)で起動時にEPERMとなったが、これはLogTape/file sinkの問題ではなく、LogTape到達前の失敗。ユーザー判断により『LogTapeがWindowsでJSONLを書ける』という検証目的は達成とし、スパイク修正は不要で終了。compile版のexe相対パス解決が将来必要になったらprocess.execPath基準にすること(本体はLOCALAPPDATA由来の絶対パスでexe相対解決を使わないため影響なし)
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LogTapeのBun compile検証: WSLで単一バイナリのJSONL書き込み・flush・パス挙動を実証(条件付き合格)、Windowsネイティブはbun run実行で書き込みを実証し目的達成。採用条件クリア
<!-- SECTION:FINAL_SUMMARY:END -->
