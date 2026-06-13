import { parseTag } from "./model";

export function getEditableFlatTags(tags: string[]): string[] {
  return [...new Set(tags.filter((tag) => parseTag(tag).kind === "flat"))];
}

export function buildWorkPatchTags(
  originalTags: string[],
  editedFlatTags: string[]
): string[] {
  // PATCH は全置換なので、編集対象外の構造化タグを元データから必ず保持する。
  const structuredTags = originalTags.filter(
    (tag) => parseTag(tag).kind !== "flat"
  );
  const flatTags = editedFlatTags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0 && parseTag(tag).kind === "flat");

  return [...new Set([...structuredTags, ...flatTags])];
}
