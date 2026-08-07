import { Fragment, useState } from "react";
import type { NormalizedTag, TagPrefix } from "@mimimilli/shared";
import { getAxisLabel } from "../model/axisDefinitions";
import { axisOfFilterTag } from "../model/libraryPresentation";
import { useAnchoredPopover } from "./preview/useAnchoredPopover";
import AxisValuePopoverPanel from "./AxisValuePopoverPanel";
import FilterChipAddButton from "./FilterChipAddButton";
import { I } from "../../../shared/ui/Icon";
import {
  deriveValueSelectionHandlers,
  type ValueSelectionIntent,
} from "../model/valueSelectionContract";

// 選択中フィルタのチップ列（ADR-0012 §2）。facet 軸・タグ軸を問わず同じ見た目で並べ、
// ×で個別解除、1件以上あるとき「すべてクリア」を表示する。旧 ContentColumn の
// .mll-tagband（タグ軸専用だった）を軸共通へ昇格させたもの。
// チップ本体クリックは同じ軸の兄弟値ドロップダウン（ADR-0012 §7）。既定は
// 置き換え、Ctrl/Cmd+クリックで AND 追加へ反転する。「＋絞り込み」は常に表示し、
// フィルタが無い状態からでも最初の1件を追加できる。
// 置き換え選択は結果面を作品一覧へ遷移させ、AND追加は現在の結果面に留まる（ADR-0012 §8）。
// onReplace には遷移込みのアクション（replaceTag、ADR-0012 §8）を渡す。

interface FilterChipBandProps {
  tagPrefixes: TagPrefix[];
  selectedTags: NormalizedTag[];
  /** 置き換え選択（結果面を作品一覧へ遷移させる。ADR-0012 §8） */
  onReplace: (tag: NormalizedTag) => void;
  /** Ctrl/Cmd+クリックによる反転先・チップの解除に使うトグル（結果面はそのまま） */
  onToggle: (tag: NormalizedTag) => void;
  /** 追加ボタン用の冪等なAND追加（ADR-0013） */
  onAddTag: (tag: NormalizedTag) => void;
  onClearAll: () => void;
}

function FilterChip({
  tag,
  tagPrefixes,
  selectedTags,
  onSelect,
  onAdd,
  onRemove,
}: {
  tag: NormalizedTag;
  tagPrefixes: TagPrefix[];
  /** 現在選択中の全タグ（自軸以外のフィルタを兄弟値の集計へ引き継ぐため。TASK-187） */
  selectedTags: NormalizedTag[];
  onSelect: (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
  onAdd: (tag: NormalizedTag) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { anchorRef, layout, close } = useAnchoredPopover({
    isOpen: open,
    preferredWidth: 220,
    onClose: () => setOpen(false),
  });
  const axis = axisOfFilterTag(tag);

  return (
    <span ref={anchorRef} className="mll-tagband__chip relative">
      <button type="button" className="lbl" onClick={() => (open ? close() : setOpen(true))}>
        {tag}
      </button>
      <button
        type="button"
        className="x"
        aria-label={`${tag}を解除`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <I.x size={9} />
      </button>
      <AxisValuePopoverPanel
        axis={axis}
        axisLabel={getAxisLabel(axis, tagPrefixes)}
        layout={layout}
        isOpen={open}
        selectedTags={selectedTags}
        onSelect={(nextTag, opts) => {
          onSelect(nextTag, opts);
          close();
        }}
        onAdd={onAdd}
        close={close}
      />
    </span>
  );
}

export default function FilterChipBand({
  tagPrefixes,
  selectedTags,
  onReplace,
  onToggle,
  onAddTag,
  onClearAll,
}: FilterChipBandProps) {
  // チップの兄弟値ドロップダウンは既定=置き換えの入口、「＋絞り込み」は既定=AND追加の入口
  // （値選択の契約。design-system.md）。
  const siblingDropdownIntent: ValueSelectionIntent<NormalizedTag> = {
    default: "replace",
    onReplace,
    onToggle,
    onAdd: onAddTag,
  };
  const { onSelect: handleSelectSibling, onAddButton: handleAddSibling } =
    deriveValueSelectionHandlers(siblingDropdownIntent);

  const addFilterIntent: ValueSelectionIntent<NormalizedTag> = {
    default: "add",
    onAdd: onAddTag,
    onReplace,
  };
  const { onSelect: handleAddFilterSelect } = deriveValueSelectionHandlers(addFilterIntent);

  return (
    <div className="mll-tagband">
      {selectedTags.length > 0 && <span className="mll-tagband__lbl">AND</span>}
      {selectedTags.map((tag, i) => (
        <Fragment key={tag}>
          {i > 0 && <span className="mll-tagband__and">AND</span>}
          <FilterChip
            tag={tag}
            tagPrefixes={tagPrefixes}
            selectedTags={selectedTags}
            onSelect={handleSelectSibling}
            onAdd={handleAddSibling}
            onRemove={() => onToggle(tag)}
          />
        </Fragment>
      ))}
      <FilterChipAddButton
        tagPrefixes={tagPrefixes}
        selectedTags={selectedTags}
        onAddValue={handleAddFilterSelect}
      />
      {selectedTags.length > 0 && (
        <button type="button" className="mll-tagband__clear" onClick={onClearAll}>
          すべてクリア
        </button>
      )}
    </div>
  );
}
