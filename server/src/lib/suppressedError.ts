/** 二次例外を一次例外のsuppressedへ追加する。一次例外を投げたまま二次例外も観測可能にする。 */
export function appendSuppressedError(primaryError: unknown, secondaryError: unknown): void {
  if (primaryError === null || typeof primaryError !== "object") return;
  try {
    const error = primaryError as { suppressed?: unknown };
    const suppressed = Array.isArray(error.suppressed) ? error.suppressed : [];
    Object.defineProperty(error, "suppressed", {
      configurable: true,
      value: [...suppressed, secondaryError],
    });
  } catch {
    // 一次例外の保持を優先する。
  }
}
