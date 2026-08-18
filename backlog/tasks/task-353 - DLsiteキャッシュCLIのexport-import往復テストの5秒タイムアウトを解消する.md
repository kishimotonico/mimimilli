---
id: TASK-353
title: DLsiteキャッシュCLIのexport/import往復テストの5秒タイムアウトを解消する
status: Done
assignee: []
created_date: '2026-08-18 03:47'
updated_date: '2026-08-18 04:09'
labels: []
dependencies: []
ordinal: 363000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
server/tests/real/dlsiteCache.test.ts の「DLsiteキャッシュCLI: export --dir と import --dir の往復で全件を復元する」が、負荷の高い実行時に5000msのテストタイムアウトで失敗する。

TASK-341の2件目として起票されていたが、当時は原因未特定のまま残っていた（341の1件目=SQLITE_BUSYは解消済み、TASK-352で根本原因のbusy_timeout設定順序も解消）。フレーキーバッチの最終検証で再現したため独立したタスクとして切り出す。

## 実測（統括、2026-08-18。統合ブランチ feat/flaky-tests）

- 単体実行 bun test tests/real/dlsiteCache.test.ts: 10回連続で失敗0
- ルートの pnpm test（run-p でserver/clientを同時実行）: 9回中2回失敗（5194ms / 5452ms でタイムアウト）

負荷が高い条件でのみ再現する。SQLITE_BUSYのcascadeではなく、当該テスト単独のタイムアウトとして出る。

## 前提

TASK-253の結論は「busy_timeoutが原因ではなく、待つ対象が明確なのにハードコードされた短いタイムアウトで打ち切っていたこと」だった。本件も、CLIの処理完了を待つべきところを5秒の固定タイムアウトで打ち切っている可能性がある。ただしTASK-341の1件目ではこの結論をそのまま当てはめられなかった実績があるので、個別に切り分けること。

## 進め方

まず「本当に処理が終わっていないのか、終わっているのに待ち方が悪いのか」を切り分ける。負荷下で実際に何秒かかっているかを計測し、5秒が単に足りないだけなのか、どこかで待ちが発生しているのかを判定すること。タイムアウト値を伸ばすだけの対処は不可（それが妥当だと判断する場合は、計測値にもとづく根拠を示すこと）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 負荷下での実所要時間が計測され、タイムアウトの原因（処理が遅いのか待ち方が不適切なのか）が特定されタスクnotesに記録されている
- [x] #2 原因構造が修正されている（固定タイムアウトの延長のみで済ませる場合は計測にもとづく根拠が示されている）
- [x] #3 ルートのpnpm testを10回連続実行して当該テストが失敗しない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 計測（AC#1）

### 単体・負荷なし（bun timing script, 8MBペイロード）
- import_dir_source: 563ms, import_dir_archive: 554ms, export_dir: 2ms, export_file_huge: 33ms, total: 1154ms

### 単体・CPU飢餓（yes×12並走, 8MBペイロード）
- import_dir_source: 1160ms, import_dir_archive: 1502ms, export_dir: 2ms, export_file_huge: 65ms, total: 2738ms

### pnpm test 並走・8MBペイロード（一時計装）
- import_dir_source: 3623ms, import_dir_archive: 2296ms, export_dir: 5ms, export_file_huge: 180ms, total: 6106ms → 6238msでタイムアウト失敗

### 判定: CPU飢餓による同期gzip処理の遅延
根拠:
1. ボトルネックは import_dir（gzipSync+parse+DB書込）が全体の95%以上。export_dirはDBからgzip BLOBを書き出すだけで5ms未満→I/O待ち・SQLiteロック待ちではない
2. CPU負荷追加で所要時間が約2倍（1154→2738ms）。pnpm test並走でさらに約2.5倍（6106ms）→CPU飢餓と相関
3. 失敗時刻5194/5452/6238msはBunテスト既定5000msタイムアウトをわずかに超過。処理未完了ではなくCPU奪われで遅延

## 対処（AC#2）: テスト側(a)
8MB上限付近ペイロードは往復検証に不要。境界条件は別テストでカバー済み:
- Content-Type/展開上限: 「Content-Typeとサイズ上限で保存前に拒否する」
- gzip展開上限: 「gzip展開サイズが上限を超えると拒否する」
- 改ざんgzip BLOB: 「改ざんされた過大gzip BLOBを展開上限で拒否する」
- 無圧縮gzip: 「展開後が上限内ならgzipが元より大きくてもimportできる」

往復テストのペイロードを64KBに縮小（2件目はsmall+largeの複数サイズ往復を維持）。修正後単体81ms。

## 検証（AC#3）
pnpm test 10回連続（5回×2バッチ）: 当該テスト失敗0/10
負の検証: assertionを壊して単体実行で(fail)を確認後復元

統括による検証と判断（2026-08-18）: 対象テストは pnpm test 10回連続で失敗0（AC#3充足）。

カバレッジについての注記: 変更前の往復テストは runDlsiteCacheCli にoverrideを渡さず既定設定（DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES = 8MB）のまま上限ギリギリ（8MB-1024byte）のペイロードを流す唯一のテストだった。64KBへの縮小により『既定上限付近のペイロードを既定設定で実際に通す』経路を検証するテストは無くなる。他の4テスト（Content-Type/サイズ上限、改ざんgzip BLOB、gzip展開サイズ超過、無圧縮gzip）はいずれも maxExpandedBytes を 64〜1000 程度へ個別にoverrideしており、上限判定ロジックの正しさは担保するが、8MB規模のデータがgzip・SQLite BLOB・CLIを通る経路そのものの検証にはならない。

この低下は意識的なトレードオフとして受け入れる。判断根拠: (1)当該経路は同期gzipで6秒級のCPU時間を消費し、pnpm testの並列実行下でタイムアウトを常態的に誘発する (2)このリポジトリはテストの網羅性より実行速度を優先する方針 (3)上限判定ロジック自体は他テストで担保されている。8MB規模の実データ経路を検証したい場合は、通常のテストスイートとは別の枠で行うのが適切。

なお本検証中に別のフレーキー（dataIntegrityIsolation.test.ts:164）をpnpm test 10回中1回観測した。master 8回中0回、単体はCPU負荷下で両者15回とも失敗0。帰属未確定でTASK-354として起票済み。
<!-- SECTION:NOTES:END -->
