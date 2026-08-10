# ADR-0015: client のエラー処理契約

- ステータス: 承認
- 日付: 2026-08-09
- 関連: [client-error-handling.md](../client-error-handling.md)

## 文脈

scan / DLsite 一括取得の操作失敗は、runtime が error atom へ保存したうえで Promise を再 throw し、UI 側が空の `.catch(() => {})` で握りつぶす二重構造になっていた。HTTP 層では非 JSON エラー応答の本文が失われ、best-effort として握りつぶす失敗の基準もコードに散在していた。

## 決定

### ユーザー操作の失敗（scan / DLsite 一括）

`ScanRuntime` / `DlsiteBulkRuntime` がエラーの唯一の所有者とする。失敗時は対応する error atom（`scanErrorAtom` / `dlsiteBulkErrorAtom`）へメッセージを保存し、`GlobalToast` が表示する。`start` / `cancel` 等の操作 Promise は reject しない。戻り値は `ScanActionResult`（`{ ok: true, job }` または `{ ok: false, error }`）で、主画面の fire-and-forget 呼び出しは戻り値を無視してよい。初回セットアップ完了だけは `start()` の `{ ok: false, error }` で後続の状態遷移を止める（詳細は client-error-handling.md）。

### HTTP エラー応答の本文

`readResponseBody` は `res.text()` で本文を読み、JSON 解析に失敗した場合は本文を保持したままエラーメッセージへ含める。契約形式（`{ error: { code, message } }`）の解析は従来どおり `ApiRequestError` とする。

### best-effort 失敗

再生継続や UI クリーンアップに支障がない失敗は、ユーザー通知せず握りつぶす。一覧と扱いの基準は [client-error-handling.md](../client-error-handling.md) に置く。

## 帰結

- 儀式的な空 catch が不要になり、エラー表示経路が atom → toast に一本化される
- 非 JSON の API エラーでも原因の手がかりが残る
- best-effort の境界が文書化され、新規の握りつぶしを安易に追加しにくくなる
