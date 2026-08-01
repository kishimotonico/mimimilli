import { useAtom, useAtomValue } from "jotai";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import {
  activeAxisAtom,
  drillValueAtom,
  gridInspectorOpenAtom,
  libraryGridLayoutModeAtom,
  libraryTileSizeAtom,
  libraryViewModeAtom,
} from "../model/atoms";
import { clampTileSize, MAX_TILE_SIZE, MIN_TILE_SIZE } from "../model/gridSizing";
import { computeWorksListVisibility } from "../model/libraryPresentation";

export default function LibraryGridControls() {
  const viewMode = useAtomValue(libraryViewModeAtom);
  const activeAxis = useAtomValue(activeAxisAtom);
  const drillValue = useAtomValue(drillValueAtom);
  const [gridLayoutMode, setGridLayoutMode] = useAtom(libraryGridLayoutModeAtom);
  const [tileSize, setTileSize] = useAtom(libraryTileSizeAtom);
  const [gridInspectorOpen, setGridInspectorOpen] = useAtom(gridInspectorOpenAtom);
  // WorkGrid が実際に描画されているか（ドリル済みファセット軸は viewMode に
  // かかわらず全幅グリッドへ合流するため、viewMode 単体では判定できない）。
  const { showGrid } = computeWorksListVisibility(activeAxis, drillValue, viewMode);
  const safeTileSize = clampTileSize(tileSize);

  return (
    <div className={`mle-grid-controls ${showGrid ? "is-visible" : ""}`} aria-hidden={!showGrid}>
      <div className="mle-grid-controls__inner">
        <div className="inline-flex items-center gap-[1px] rounded-2 bg-paper-2 p-[2px]">
          <IconButton
            size="sm"
            icon={I.ratio11}
            label="カバーを1対1に切り抜き、等幅で並べる"
            title="1:1タイル：正方形に切り抜いて等幅で並べる"
            active={gridLayoutMode === "square"}
            onClick={() => setGridLayoutMode("square")}
            disabled={!showGrid}
          />
          <IconButton
            size="sm"
            icon={I.gridJustified}
            label="カバーの縦横比を保ち、行の右端を揃えて並べる"
            title="元の縦横比：比率を保って行の右端を揃える"
            active={gridLayoutMode === "justified"}
            onClick={() => setGridLayoutMode("justified")}
            disabled={!showGrid}
          />
        </div>

        <label className="mll-grid-size">
          <span>サイズ</span>
          <input
            type="range"
            min={MIN_TILE_SIZE}
            max={MAX_TILE_SIZE}
            step={8}
            value={safeTileSize}
            disabled={!showGrid}
            aria-label="グリッドのサイズ"
            onChange={(event) => setTileSize(Number(event.currentTarget.value))}
          />
          <output>{safeTileSize}px</output>
        </label>

        <IconButton
          size="sm"
          icon={I.panelR}
          label="詳細パネルの表示切り替え"
          title="詳細パネル"
          active={gridInspectorOpen}
          onClick={() => setGridInspectorOpen((open) => !open)}
          disabled={!showGrid}
        />
      </div>
    </div>
  );
}
