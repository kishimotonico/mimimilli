import { parseTag, type TagPrefix } from "@mimimilli/shared";

export function tagPrefixDefinition(tag: string, tagPrefixes: TagPrefix[]): TagPrefix | null {
  const parsed = parseTag(tag);
  if (parsed.kind !== "annotated") return null;
  return tagPrefixes.find((p) => p.prefix === parsed.prefix) ?? null;
}
