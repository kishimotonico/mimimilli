import { resolveTagPrefix, type NormalizedTag, type TagPrefix } from "@mimimilli/shared";
import { tagPrefixColorToCss } from "../../../entities/work/tagPrefixColor";
import { formatFilterChipLabel } from "../model/libraryPresentation";
import type { GroupValueScope } from "../model/useGroupValuesQuery";
import FilterChipAddButton from "./FilterChipAddButton";
import type { SaveOffer } from "../model/saveSearch";
import { I } from "../../../shared/ui/Icon";

// 選択中フィルタのチップ列（ADR-0012 §2）。×で個別解除する。
// 「＋絞り込み」は常に表示し、フィルタが無い状態からでも最初の1件を追加できる。
// チップは常に AND で効く。グループの値はチップではなくパンくずで扱う（ADR-0041）。

interface FilterChipBandProps {
  tagPrefixes: TagPrefix[];
  selectedTags: NormalizedTag[];
  /** 「＋絞り込み」の候補を数える母集団。値一覧では絞り込みを持たないので undefined */
  groupValueScope?: GroupValueScope;
  onAddTag: (tag: NormalizedTag) => void;
  onRemoveTag: (tag: NormalizedTag) => void;
  /** 絞り込み後の作品件数。作品一覧を出さない結果面では undefined */
  worksTotal?: number;
  /** 値一覧ペインの分類数。指定時は作品件数の代わりに分類数を出し、「＋絞り込み」ボタンも隠す */
  valueListItemCount?: number;
  /** 保存の操作。出すものは状態で決まる（ADR-0041） */
  save?: {
    offer: SaveOffer;
    folderName: string;
    onSave: () => void;
    onOverwrite: () => void;
  };
}

function FilterChip({
  tag,
  tagPrefixes,
  onRemove,
}: {
  tag: NormalizedTag;
  tagPrefixes: TagPrefix[];
  onRemove: () => void;
}) {
  const label = formatFilterChipLabel(tag);
  const slash = label === tag ? tag.indexOf("/") : -1;
  const prefixColor =
    slash > 0
      ? tagPrefixColorToCss(resolveTagPrefix(tag.slice(0, slash), tagPrefixes).color)
      : undefined;
  return (
    <span className="mll-tagband__chip relative">
      <span className="lbl">
        {slash > 0 ? (
          <>
            <b style={{ color: prefixColor }}>{label.slice(0, slash + 1)}</b>
            {label.slice(slash + 1)}
          </>
        ) : (
          label
        )}
      </span>
      <button
        type="button"
        className="x"
        aria-label={`${formatFilterChipLabel(tag)}を解除`}
        onClick={onRemove}
      >
        <I.x size={9} />
      </button>
    </span>
  );
}

export default function FilterChipBand({
  tagPrefixes,
  selectedTags,
  groupValueScope,
  onAddTag,
  onRemoveTag,
  worksTotal,
  valueListItemCount,
  save,
}: FilterChipBandProps) {
  const isValueListPane = valueListItemCount !== undefined;
  return (
    <div className="mll-tagband">
      {selectedTags.map((tag) => (
        <FilterChip
          key={tag}
          tag={tag}
          tagPrefixes={tagPrefixes}
          onRemove={() => onRemoveTag(tag)}
        />
      ))}
      {!isValueListPane && groupValueScope && (
        <FilterChipAddButton
          tagPrefixes={tagPrefixes}
          selectedTags={selectedTags}
          scope={groupValueScope}
          onAddValue={onAddTag}
        />
      )}
      <div className="mll-tagband__tail">
        {save?.offer === "overwrite" && (
          <button type="button" className="mll-tagband__save" onClick={save.onOverwrite}>
            {`「${save.folderName}」を上書き`}
          </button>
        )}
        {save?.offer === "overwrite" && (
          <button type="button" className="mll-tagband__save" onClick={save.onSave}>
            別名で保存
          </button>
        )}
        {save?.offer === "save" && (
          <button type="button" className="mll-tagband__save" onClick={save.onSave}>
            <I.bookmark size={12} />
            検索を保存
          </button>
        )}
        {isValueListPane ? (
          <span className="mll-tagband__count">{valueListItemCount} 分類</span>
        ) : (
          worksTotal != null && <span className="mll-tagband__count">{worksTotal} 件</span>
        )}
      </div>
    </div>
  );
}
