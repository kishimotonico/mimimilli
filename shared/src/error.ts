/** unknown な例外値からメッセージ文字列を取り出す。 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
