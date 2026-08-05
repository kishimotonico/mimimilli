import { Fragment, useState } from "react";
import type { NormalizedTag, TagPrefix } from "@mimimilli/shared";
import { axisOfFilterTag } from "../model/libraryPresentation";
import { useAnchoredPopover } from "./preview/useAnchoredPopover";
import AxisValuePopoverPanel from "./AxisValuePopoverPanel";
import FilterChipAddButton from "./FilterChipAddButton";
import { I } from "../../../shared/ui/Icon";

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
  /** AND追加（結果面はそのまま） */
  onToggle: (tag: NormalizedTag) => void;
  onClearAll: () => void;
}

function FilterChip({
  tag,
  selectedTags,
  onReplace,
  onToggle,
  onRemove,
}: {
  tag: NormalizedTag;
  /** 現在選択中の全タグ（自軸以外のフィルタを兄弟値の集計へ引き継ぐため。TASK-187） */
  selectedTags: NormalizedTag[];
  onReplace: (tag: NormalizedTag) => void;
  onToggle: (tag: NormalizedTag) => void;
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
      {open && (
        <AxisValuePopoverPanel
          axis={axis}
          layout={layout}
          selectedTags={selectedTags}
          onSelect={(nextTag, opts) => {
            if (opts.ctrlKey || opts.metaKey) onToggle(nextTag);
            else onReplace(nextTag);
            close();
          }}
          close={close}
        />
      )}
    </span>
  );
}

export default function FilterChipBand({
  tagPrefixes,
  selectedTags,
  onReplace,
  onToggle,
  onClearAll,
}: FilterChipBandProps) {
  return (
    <div className="mll-tagband">
      {selectedTags.length > 0 && <span className="mll-tagband__lbl">AND</span>}
      {selectedTags.map((tag, i) => (
        <Fragment key={tag}>
          {i > 0 && <span className="mll-tagband__and">AND</span>}
          <FilterChip
            tag={tag}
            selectedTags={selectedTags}
            onReplace={onReplace}
            onToggle={onToggle}
            onRemove={() => onToggle(tag)}
          />
        </Fragment>
      ))}
      <FilterChipAddButton
        tagPrefixes={tagPrefixes}
        selectedTags={selectedTags}
        onAddValue={(tag, opts) => {
          if (opts.ctrlKey || opts.metaKey) onReplace(tag);
          else onToggle(tag);
        }}
      />
      {selectedTags.length > 0 && (
        <button type="button" className="mll-tagband__clear" onClick={onClearAll}>
          すべてクリア
        </button>
      )}
    </div>
  );
}
