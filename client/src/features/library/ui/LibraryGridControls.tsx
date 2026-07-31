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
  const gridControlsVisible = viewMode === "grid";
  // ファセット一覧表示中（canShowWorksGrid=false）は WorkGrid 自体が描画されないため、
  // グリッド系コントロールはすべて disabled にする（死にコントロール防止）。
  const { canShowWorksGrid } = computeWorksListVisibility(activeAxis, drillValue, viewMode);
  const gridControlsEnabled = gridControlsVisible && canShowWorksGrid;
  const safeTileSize = clampTileSize(tileSize);

  return (
    <div
      className={`mle-grid-controls ${gridControlsVisible ? "is-visible" : ""}`}
      aria-hidden={!gridControlsVisible}
    >
      <div className="mle-grid-controls__inner">
        <div className="inline-flex items-center gap-[1px] rounded-2 bg-paper-2 p-[2px]">
          <IconButton
            size="sm"
            icon={I.ratio11}
            label="カバーを1対1に切り抜き、等幅で並べる"
            title="1:1タイル：正方形に切り抜いて等幅で並べる"
            active={gridLayoutMode === "square"}
            onClick={() => setGridLayoutMode("square")}
            disabled={!gridControlsEnabled}
          />
          <IconButton
            size="sm"
            icon={I.gridJustified}
            label="カバーの縦横比を保ち、行の右端を揃えて並べる"
            title="元の縦横比：比率を保って行の右端を揃える"
            active={gridLayoutMode === "justified"}
            onClick={() => setGridLayoutMode("justified")}
            disabled={!gridControlsEnabled}
          />
        </div>

        <label className="mll-grid-size">
          <span>サイズ</span>
          <input
            type="range"
            min={MIN_TILE_SIZE}
            max={MAX_TILE_SIZE}
            step={1}
            value={safeTileSize}
            disabled={!gridControlsEnabled}
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
          disabled={!gridControlsEnabled}
        />
      </div>
    </div>
  );
}
