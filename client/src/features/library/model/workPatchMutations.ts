import type { UseMutationResult } from "@tanstack/react-query";
import type { NormalizedTag, Work } from "@mimimilli/shared";

export type LibraryTitlePatchMutation = UseMutationResult<
  Work,
  Error,
  { workId: string; title: string }
>;

export type LibraryBookmarkPatchMutation = UseMutationResult<
  Work,
  Error,
  { workId: string; bookmarked: boolean }
>;

export type LibraryTagsPatchMutation = UseMutationResult<
  Work,
  Error,
  { workId: string; tags: NormalizedTag[] }
>;
