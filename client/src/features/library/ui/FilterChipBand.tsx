import { Fragment } from "react";
import type { NormalizedTag, TagPrefix } from "@mimimilli/shared";
import { formatFilterChipLabel } from "../model/libraryPresentation";
import type { FacetScope } from "../model/useAxisFacetsQuery";
import FilterChipAddButton from "./FilterChipAddButton";
import { I } from "../../../shared/ui/Icon";

// 選択中フィルタのチップ列（ADR-0012 §2）。×で個別解除、1件以上あるとき「すべてクリア」を
// 表示する。「＋絞り込み」は常に表示し、フィルタが無い状態からでも最初の1件を追加できる。
// チップは常に AND で効く。グループの値はチップではなくパンくずで扱う（ADR-0041）。

interface FilterChipBandProps {
  tagPrefixes: TagPrefix[];
  selectedTags: NormalizedTag[];
  /** 「＋絞り込み」の候補を数える母集団。値一覧では絞り込みを持たないので undefined */
  facetScope?: FacetScope;
  onAddTag: (tag: NormalizedTag) => void;
  onRemoveTag: (tag: NormalizedTag) => void;
  onClearAll: () => void;
  /** 絞り込み後の作品件数。作品一覧を出さない結果面では undefined */
  worksTotal?: number;
  /** 値一覧ペインの分類数。指定時は作品件数の代わりに「ライブラリ全体」件数であることを
   *  明示するラベルを出し、「＋絞り込み」ボタンも隠す（値一覧は独立した全作品の入口。ADR-0026） */
  valueListItemCount?: number;
}

function FilterChip({ tag, onRemove }: { tag: NormalizedTag; onRemove: () => void }) {
  return (
    <span className="mll-tagband__chip relative">
      <span className="lbl">{formatFilterChipLabel(tag)}</span>
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
  facetScope,
  onAddTag,
  onRemoveTag,
  onClearAll,
  worksTotal,
  valueListItemCount,
}: FilterChipBandProps) {
  const isValueListPane = valueListItemCount !== undefined;
  return (
    <div className="mll-tagband">
      {selectedTags.length > 0 && <span className="mll-tagband__lbl">AND</span>}
      {selectedTags.map((tag, i) => (
        <Fragment key={tag}>
          {i > 0 && <span className="mll-tagband__and">AND</span>}
          <FilterChip tag={tag} onRemove={() => onRemoveTag(tag)} />
        </Fragment>
      ))}
      {!isValueListPane && facetScope && (
        <FilterChipAddButton
          tagPrefixes={tagPrefixes}
          selectedTags={selectedTags}
          scope={facetScope}
          onAddValue={onAddTag}
        />
      )}
      <div className="mll-tagband__tail">
        {selectedTags.length > 0 && (
          <button type="button" className="mll-tagband__clear" onClick={onClearAll}>
            すべてクリア
          </button>
        )}
        {isValueListPane ? (
          <span className="mll-tagband__count">
            {valueListItemCount}分類（件数はライブラリ全体）
          </span>
        ) : (
          worksTotal != null && <span className="mll-tagband__count">{worksTotal} 件</span>
        )}
      </div>
    </div>
  );
}
