import { useAtom, useAtomValue } from "jotai";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import {
  libraryGridLayoutModeAtom,
  libraryTileSizeAtom,
  libraryViewModeAtom,
} from "../model/atoms";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import { clampTileSize, MAX_TILE_SIZE, MIN_TILE_SIZE } from "../../../shared/lib/gridSizing";

export default function LibraryGridControls() {
  const viewMode = useAtomValue(libraryViewModeAtom);
  const nav = useLibraryNavigation();
  const [gridLayoutMode, setGridLayoutMode] = useAtom(libraryGridLayoutModeAtom);
  const [tileSize, setTileSize] = useAtom(libraryTileSizeAtom);
  // 作品グリッド・値グリッドのどちらかが実際に描画されているか。list/grid の決定は
  // libraryViewModeAtom のみに依存する（ADR-0012 §3・§5）。
  // タイルサイズは両方が共有するが、敷き詰め形式（1:1/縦横比）は作品グリッド専用
  // （値グリッドのコラージュは常に正方形で、この設定を読まない）。
  const showGrid = viewMode === "grid";
  const isWorksGrid = nav.foldersStatus === "ready" && nav.view.kind === "works" && showGrid;
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
            disabled={!isWorksGrid}
          />
          <IconButton
            size="sm"
            icon={I.gridJustified}
            label="カバーの縦横比を保ち、行の右端を揃えて並べる"
            title="元の縦横比：比率を保って行の右端を揃える"
            active={gridLayoutMode === "justified"}
            onClick={() => setGridLayoutMode("justified")}
            disabled={!isWorksGrid}
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
      </div>
    </div>
  );
}
