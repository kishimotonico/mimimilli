// tag entity の API。タグ一覧と prefix 定義（ADR-0005）を扱う。
// 依存方向: shared/api/http のみを参照する。

import { deleteVoid, getParsed, patchParsed, postParsed } from "../../shared/api/http";
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

export async function getAllTags(): Promise<string[]> {
  return getParsed(tagListSchema, "/tags");
}

export async function listTagPrefixes(): Promise<TagPrefix[]> {
  return getParsed(tagPrefixListSchema, "/tag-prefixes");
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

export async function listTagPrefixCandidates(): Promise<TagPrefixCandidate[]> {
  return getParsed(tagPrefixCandidateListSchema, "/tag-prefixes/candidates");
}
