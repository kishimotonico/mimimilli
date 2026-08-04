import { Fragment } from "react";
import { I } from "../../../shared/ui/Icon";

// 選択中フィルタのチップ列（ADR-0012 §2）。facet 軸・タグ軸を問わず同じ見た目で並べ、
// ×で個別解除、1件以上あるとき「すべてクリア」を表示する。旧 ContentColumn の
// .mll-tagband（タグ軸専用だった）を軸共通へ昇格させたもの。

interface FilterChipBandProps {
  selectedTags: string[];
  onToggle: (tag: string) => void;
  onClearAll: () => void;
}

export default function FilterChipBand({
  selectedTags,
  onToggle,
  onClearAll,
}: FilterChipBandProps) {
  if (selectedTags.length === 0) return null;

  return (
    <div className="mll-tagband">
      <span className="mll-tagband__lbl">AND</span>
      {selectedTags.map((tag, i) => (
        <Fragment key={tag}>
          {i > 0 && <span className="mll-tagband__and">AND</span>}
          <span className="mll-tagband__chip">
            {tag}
            <button
              type="button"
              className="x"
              aria-label={`${tag}を解除`}
              onClick={() => onToggle(tag)}
            >
              <I.x size={9} />
            </button>
          </span>
        </Fragment>
      ))}
      <button type="button" className="mll-tagband__clear" onClick={onClearAll}>
        すべてクリア
      </button>
    </div>
  );
}
