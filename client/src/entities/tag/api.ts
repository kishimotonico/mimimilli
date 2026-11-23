// tag entity の API。タグ一覧と prefix 定義（ADR-0005）を扱う。
// 依存方向: shared/api/http のみを参照する。

import { deleteVoid, getParsed, patchParsed, postParsed, putParsed } from "../../shared/api/http";
import {
  tagListSchema,
  tagPrefixSchema,
  tagPrefixListSchema,
  tagPrefixCandidateListSchema,
  type TagPrefix,
  type TagPrefixCandidate,
  type TagPrefixCreate,
  type TagPrefixUpdate,
} from "@mimimilli/shared";

export async function getAllTags(options?: { signal?: AbortSignal }): Promise<string[]> {
  return getParsed(tagListSchema, "/tags", options);
}

export async function listTagPrefixes(options?: { signal?: AbortSignal }): Promise<TagPrefix[]> {
  return getParsed(tagPrefixListSchema, "/tag-prefixes", options);
}

export async function createTagPrefix(data: TagPrefixCreate): Promise<TagPrefix> {
  return postParsed(tagPrefixSchema, "/tag-prefixes", data);
}

export async function updateTagPrefix(prefix: string, data: TagPrefixUpdate): Promise<TagPrefix> {
  return patchParsed(tagPrefixSchema, `/tag-prefixes/${encodeURIComponent(prefix)}`, data);
}

export async function deleteTagPrefix(prefix: string): Promise<void> {
  await deleteVoid(`/tag-prefixes/${encodeURIComponent(prefix)}`);
}

/** 登録済み全 prefix を渡された順序でアトミックに並び替える */
export async function reorderTagPrefixes(prefixes: string[]): Promise<TagPrefix[]> {
  return putParsed(tagPrefixListSchema, "/tag-prefixes/order", { prefixes });
}

export async function listTagPrefixCandidates(options?: {
  signal?: AbortSignal;
}): Promise<TagPrefixCandidate[]> {
  return getParsed(tagPrefixCandidateListSchema, "/tag-prefixes/candidates", options);
}
