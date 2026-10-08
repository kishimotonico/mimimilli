# client エラー処理

client のエラー所有権・Promise 契約・best-effort 失敗の基準。設計判断の経緯は [ADR-0015](adr/0015-client-error-contracts.md)。

## ユーザーに見せる操作失敗

- **スキャン start / cancel**: 所有者は `scanJobStore`（`entities/scan`）。失敗は `state.error` に持ち、`ScanRuntime` が `useToast().show({ variant: "error", ... })` で表示する。Promise は reject しない
- **DLsite 一括 start / cancel**: 所有者は `dlsiteBulkStore`（`entities/dlsite`）。失敗は `error` イベントで通知し、`DlsiteBulkRuntime` が `useToast().error(...)` で表示する。Promise は reject しない
- **その他の mutation**（再生・エクスポート等）: 呼び出し側が catch し `useToast().error(...)` で表示する

表示は単一ホストの `GlobalToast`（`toastRequestsAtom` の要求を受けて描画）に集約される。variant="error" は発行元の priority に関わらず最優先で表示される。scan / DLsite の SSE 由来の失敗（イベント解析エラー・接続切断等）も、それぞれの runtime が上記と同じ `useToast` 経路で扱う。

初回セットアップ・root再設定（`RootConfigurationScreen`、ADR-0029）だけは例外。`GlobalToast` を使わず、送信（`onSubmit`）が reject したエラーを `formatUserError` で整形して画面内にインライン表示する。

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
- `refreshScanCandidates` の呼び出し（`ScanRuntime` のスキャン完了時・起動時、root再設定の離脱時、`UnregisteredTab` の候補更新エラー後）— 失敗しても直前の候補キャッシュが残るだけ。ユーザーの明示操作（再スキャン・候補タブの再取得）で取り直せる
- `dlsiteBulkStore.attach` の `getDlsiteBulkStatus` — 起動・スキャン完了後の再接続の試行。失敗しても一括取得は手動で開始でき、状態は次の `attach` で揃う
- root再設定の離脱時（`rootReconfigurationController`）の直近スキャン結果取得 — 失敗すると DLsite 一括の自動再接続が行われないだけ。手動の一括取得は使える
- `Toast` の `showPopover` / `hidePopover` — 既に同じ状態のときの `DOMException`。状態は目的どおりになっている
- `useMediaSession` の `setActionHandler` — 個別 action に未対応のブラウザでは、その action だけ無効になる
- `scanJobStore` の SSE 切断後 `getScanJob` 一時失敗 — EventSource の標準再接続に任せる。404/410 とスキーマ不一致だけ `state.error`（ScanRuntimeが読みuseToastへ渡す）へ

**ローカル UI で扱う箇所**

- `useWorkTagEditor` のタグ追加・削除 / `RegisterWorkDialog` の登録 — 失敗は mutation の `error` からフォーム内に表示する。`catch` は再 throw を止めるだけ
- `ScanModal` の「新規登録」「更新」タブの作品取得（`useScanResultWorks`）— タブ内の表に「新規作品の読み込みに失敗しました」「更新された作品の読み込みに失敗しました」を表示

client にはサーバー側の logtape 相当のロガーはない。best-effort は debug ログを出さず完全無視とする。将来ロガーを導入する場合は、「完全に無視」箇所だけ `debug` レベルでの記録を検討する。
