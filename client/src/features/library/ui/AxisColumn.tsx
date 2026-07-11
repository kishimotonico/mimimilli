import type { SmartFolder, TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { I } from "../../../shared/ui/Icon";

interface AxisRow {
  id: AxisId;
  name: string;
  icon: string;
  count?: number | string;
  badge?: number;
  isAction?: boolean;
}

const VIEW_AXES: AxisRow[] = [
  { id: "all", name: "すべての作品", icon: "gridS" },
  { id: "recent", name: "最近再生", icon: "refresh" },
  { id: "added", name: "最近追加", icon: "add" },
  { id: "fav", name: "お気に入り", icon: "star" },
  { id: "unplayed", name: "未再生", icon: "audio" },
  { id: "missing", name: "ファイル欠損", icon: "err" },
];

// 初期 seed の prefix に対する見慣れたアイコン。未知の prefix は folder に落ちる
// （アイコンは prefix 定義に持たせていない表示上の便宜）
const PREFIX_ICONS: Record<string, string> = {
  cv: "user",
  サークル: "folder",
  シリーズ: "bookmark",
  カテゴリ: "list",
  genre: "list",
};

/** 分類軸の行 = 軸表示ONの prefix 定義（定義順）＋ 組み込みの tag / year（ADR-0005） */
function buildFacetAxisRows(tagPrefixes: TagPrefix[]): AxisRow[] {
  const prefixRows = tagPrefixes
    .filter((p) => p.showAsAxis)
    .map((p) => ({ id: p.prefix, name: p.label, icon: PREFIX_ICONS[p.prefix] ?? "folder" }));
  return [
    ...prefixRows,
    { id: "tag", name: "タグ", icon: "filter" },
    { id: "year", name: "追加日", icon: "refresh" },
  ];
}

interface AxisColumnProps {
  activeAxis: AxisId;
  viewCounts?: Partial<Record<string, number>>;
  facetCounts?: Partial<Record<string, number>>;
  tagPrefixes: TagPrefix[];
  smartFolders: SmartFolder[];
  totalCount?: number;
  onSelectAxis: (axis: AxisId) => void;
  onNewSmartFolder?: () => void;
}

function AxisRowItem({
  ax,
  isActive,
  onSelect,
}: {
  ax: AxisRow;
  isActive: boolean;
  onSelect: () => void;
}) {
  const Ic =
    (I as Record<string, (p: { size?: number }) => React.ReactElement>)[ax.icon] ?? I.folder;
  return (
    <button type="button" className={`mll-axis ${isActive ? "is-on" : ""}`} onClick={onSelect}>
      <span className="ic">
        <Ic size={14} />
      </span>
      <span className="nm">{ax.name}</span>
      {ax.badge != null && <span className="badge">{ax.badge}</span>}
      {ax.count != null && <span className="count">{ax.count}</span>}
      {!ax.isAction && (
        <span className="chev">
          <I.chev size={11} />
        </span>
      )}
    </button>
  );
}

export default function AxisColumn({
  activeAxis,
  viewCounts = {},
  facetCounts = {},
  tagPrefixes,
  smartFolders,
  totalCount,
  onSelectAxis,
  onNewSmartFolder,
}: AxisColumnProps) {
  const facetAxisRows = buildFacetAxisRows(tagPrefixes);
  return (
    <div className="mle-col is-axis">
      <div className="mle-col__hd">
        <span>ライブラリ</span>
        {totalCount != null && <span className="count">{totalCount} 件</span>}
      </div>
      <div className="mle-col__list">
        <div className="mll-axisgroup">
          <div className="mll-axisgroup__hd">ビュー</div>
          {VIEW_AXES.map((ax) => (
            <AxisRowItem
              key={ax.id}
              ax={{ ...ax, count: viewCounts[ax.id] }}
              isActive={activeAxis === ax.id}
              onSelect={() => onSelectAxis(ax.id)}
            />
          ))}
        </div>

        <div className="mll-axisgroup">
          <div className="mll-axisgroup__hd">分類軸</div>
          {facetAxisRows.map((ax) => (
            <AxisRowItem
              key={ax.id}
              ax={{ ...ax, count: facetCounts[ax.id] }}
              isActive={activeAxis === ax.id}
              onSelect={() => onSelectAxis(ax.id)}
            />
          ))}
        </div>

        <div className="mll-axisgroup">
          <div className="mll-axisgroup__hd">スマートフォルダー</div>
          {smartFolders.map((sf) => (
            <AxisRowItem
              key={sf.id}
              ax={{ id: `smart-${sf.id}` as AxisId, name: sf.name, icon: "gridS" }}
              isActive={activeAxis === `smart-${sf.id}`}
              onSelect={() => onSelectAxis(`smart-${sf.id}` as AxisId)}
            />
          ))}
          <button type="button" className="mll-axis is-action" onClick={onNewSmartFolder}>
            <span className="ic">
              <I.add size={14} />
            </span>
            <span className="nm">+ 新規スマートフォルダー</span>
          </button>
        </div>
      </div>
    </div>
  );
}
