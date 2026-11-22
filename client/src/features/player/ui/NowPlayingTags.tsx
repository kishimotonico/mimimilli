import type { NormalizedTag } from "@mimimilli/shared";
import { useQuery } from "@tanstack/react-query";
import { workDetailQueryOptions } from "../../../entities/work/workDetailQueryOptions";
import { sortTagsForDisplay } from "../../../entities/work/sortTagsForDisplay";
import { tagPrefixDefinition } from "../../../entities/tag/tagPrefixDefinition";
import { useTagPrefixes } from "../../../entities/tag/useTagPrefixes";
import Tag from "../../../entities/work/ui/Tag";

/** 再生中の作品のタグ。行き先はプレビュー・作品詳細のタグと同じ（ADR-0041） */
export type TagClickHandler = (
  tag: NormalizedTag,
  modifiers: { ctrlKey: boolean; metaKey: boolean },
) => void;

export default function NowPlayingTags({
  workId,
  onTagClick,
}: {
  workId: string;
  onTagClick: TagClickHandler;
}) {
  const tags = useQuery(workDetailQueryOptions(workId)).data?.tags ?? [];
  const { tagPrefixes } = useTagPrefixes();
  if (tags.length === 0) return null;

  return (
    <div className="flex w-full min-w-0 flex-wrap justify-center gap-[5px]">
      {sortTagsForDisplay(tags, tagPrefixes).map((tag) => (
        <Tag
          key={tag}
          tag={tag}
          definition={tagPrefixDefinition(tag, tagPrefixes)}
          onClick={(modifiers) => onTagClick(tag, modifiers)}
          ariaLabel={`タグ「${tag}」で絞り込む`}
        />
      ))}
    </div>
  );
}
