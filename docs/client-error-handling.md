# client エラー処理

client のエラー所有権・Promise 契約・best-effort 失敗の基準。設計判断の経緯は [ADR-0015](adr/0015-client-error-contracts.md)。

## ユーザーに見せる操作失敗

- **スキャン start / cancel**: 所有者は `ScanRuntime` → `scanErrorAtom`。`GlobalToast` で表示。Promise は reject しない
- **DLsite 一括 start / cancel**: 所有者は `DlsiteBulkRuntime` → `dlsiteBulkErrorAtom`。`GlobalToast` で表示。Promise は reject しない
- **その他の mutation**（再生・エクスポート等）: 呼び出し側が `errorToastAtom` 等へ保存し、呼び出し側で catch して toast

scan / DLsite の SSE 由来の失敗（イベント解析エラー・接続切断等）も runtime が同じ error atom へ保存する。

初回セットアップ（`App.handleSetupComplete`）だけは例外。`scanActions.start()` の戻り値が `{ ok: false, error }` のときは `error` を throw し `rootFolder` をキャッシュへ確定しない。SetupScreen には `GlobalToast` が無いため、失敗理由は戻り値の `error` 文字列で渡す。runtime の操作 Promise は reject しない契約は変えない。

## HTTP 層

`shared/api/http.ts` の `readResponseBody` は失敗応答の本文を `text()` で読む。JSON 解析に失敗した場合、本文の先頭 200 文字をエラーメッセージに含める。契約形式の `{ error: { code, message } }` は `ApiRequestError` としてパースする。

## best-effort 失敗（ユーザー通知しない）

**基準**

- **完全に無視**: 失敗しても再生・表示が継続し、自動回復または破棄時のクリーンアップである。ログも出さない
- **ローカル UI で扱う**: その画面の局所エラーとして表示する（toast ではない）

**完全に無視する箇所**

- `useResumePersistence` のレジューム位置保存 — 再生は継続。次回起動時に古い位置が残るだけ
- `useAudioEngineLifecycle` の `updateLastPlayed` — 同上。サイドバーの「最終再生」表示が更新されないだけ
- `audioEngine` の `AudioContext.resume()` — ブラウザの自動再生ポリシーでよく失敗する。次の `play()` で再試行
- `audioEngine` の `AudioContext.close()`（`destroy` 時）— 破棄時のクリーンアップ。既に再生は止まっている
- `useScanJob` の SSE 切断後 `getScanJob` 一時失敗 — EventSource の標準再接続に任せる。404/410 とスキーマ不一致だけ error atom へ

**ローカル UI で扱う箇所**

- `ScanModal` の新規作品一覧 `getWork` — モーダル内に「新規作品の読み込みに失敗しました」を表示

client にはサーバー側の logtape 相当のロガーはない。best-effort は debug ログを出さず完全無視とする。将来ロガーを導入する場合は、「完全に無視」箇所だけ `debug` レベルでの記録を検討する。
