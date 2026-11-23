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

const textEncoder = new TextEncoder();

/** SQLiteのBINARY照合と同じUTF-8バイト順でキーを比較する。 */
export function compareJapaneseSortKeys(a: string, b: string): number {
  return compareUtf8Bytes(japaneseSortKey(a), japaneseSortKey(b));
}

/** seed と作品 ID から決まる 32bit のランダム順キー（FNV-1a に seed を混ぜ murmur3 の fmix32 で拡散）。 */
export function randomOrderKey(seed: number, workId: string): number {
  let h = (0x811c9dc5 ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
  for (const byte of textEncoder.encode(workId)) {
    h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** randomOrderKey 昇順、同値は ID のバイト順。キーは1件につき1回だけ計算する。 */
export function sortByRandomOrder<T>(items: T[], seed: number, idOf: (item: T) => string): T[] {
  const keyed = items.map((item) => {
    const id = idOf(item);
    return { item, id, key: randomOrderKey(seed, id) };
  });
  keyed.sort((a, b) => a.key - b.key || compareUtf8Bytes(a.id, b.id));
  return keyed.map((entry) => entry.item);
}
