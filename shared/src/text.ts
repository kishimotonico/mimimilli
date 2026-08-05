// 文字列比較の共通ユーティリティ。work.ts と library.ts の両方が使うため、
// どちらの下にも属さない独立モジュールに置く（work.ts ⇄ library.ts の循環import回避）。

const utf8Encoder = new TextEncoder();

/** SQLiteのBINARY照合と同じUTF-8バイト順で文字列を比較する。 */
export function compareUtf8Bytes(a: string, b: string): number {
  const aBytes = utf8Encoder.encode(a);
  const bBytes = utf8Encoder.encode(b);
  const length = Math.min(aBytes.length, bBytes.length);
  for (let index = 0; index < length; index++) {
    const difference = aBytes[index]! - bBytes[index]!;
    if (difference !== 0) return difference;
  }
  return aBytes.length - bBytes.length;
}
