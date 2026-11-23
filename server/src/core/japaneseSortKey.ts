import { compareUtf8Bytes } from "@mimimilli/shared";

/** ADR-0008で定義した、日本語検索・ソート用の共通キー。 */
export function japaneseSortKey(value: string): string {
  const normalized = value.normalize("NFKC");
  let folded = "";
  for (const character of normalized) {
    const codePoint = character.codePointAt(0)!;
    folded +=
      codePoint >= 0x30a1 && codePoint <= 0x30f6
        ? String.fromCodePoint(codePoint - 0x60)
        : character;
  }
  return folded.toLowerCase();
}

export { compareUtf8Bytes };

/** SQLiteのBINARY照合と同じUTF-8バイト順でキーを比較する。 */
export function compareJapaneseSortKeys(a: string, b: string): number {
  return compareUtf8Bytes(japaneseSortKey(a), japaneseSortKey(b));
}
