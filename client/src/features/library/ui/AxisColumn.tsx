import type { SmartFolder } from "@mimimilli/shared";
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
  { id: "all",      name: "すべての作品", icon: "gridS" },
  { id: "recent",   name: "最近再生",     icon: "refresh" },
  { id: "added",    name: "最近追加",     icon: "add" },
  { id: "fav",      name: "お気に入り",   icon: "star" },
  { id: "unplayed", name: "未再生",       icon: "audio" },
  { id: "missing",  name: "ファイル欠損", icon: "err" },
];

const FACET_AXES: AxisRow[] = [
  { id: "circle", name: "サークル", icon: "folder" },
  { id: "cv",     name: "CV",       icon: "user" },
  { id: "series", name: "シリーズ", icon: "bookmark" },
  { id: "cat",    name: "カテゴリ", icon: "list" },
  { id: "tag",    name: "タグ",     icon: "filter" },
  { id: "year",   name: "追加日",   icon: "refresh" },
];

interface AxisColumnProps {
  activeAxis: AxisId;
  viewCounts?: Partial<Record<string, number>>;
  facetCounts?: Partial<Record<string, number>>;
  smartFolders: SmartFolder[];
  totalCount?: number;
  onSelectAxis: (axis: AxisId) => void;
  onNewSmartFolder?: () => void;
}

function AxisRowItem({ ax, isActive, onSelect }: { ax: AxisRow; isActive: boolean; onSelect: () => void }) {
  const Ic = (I as Record<string, (p: { size?: number }) => React.ReactElement>)[ax.icon] ?? I.folder;
  return (
    <div
      className={`mll-axis ${isActive ? "is-on" : ""}`}
      onClick={onSelect}
    >
      <span className="ic"><Ic size={14} /></span>
      <span className="nm">{ax.name}</span>
      {ax.badge != null && <span className="badge">{ax.badge}</span>}
      {ax.count != null && <span className="count">{ax.count}</span>}
      {!ax.isAction && <span className="chev"><I.chev size={11} /></span>}
    </div>
  );
}

export default function AxisColumn({
  activeAxis,
  viewCounts = {},
  facetCounts = {},
  smartFolders,
  totalCount,
  onSelectAxis,
  onNewSmartFolder,
}: AxisColumnProps) {
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
          {FACET_AXES.map((ax) => (
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
          <div className="mll-axis is-action" onClick={onNewSmartFolder}>
            <span className="ic"><I.add size={14} /></span>
            <span className="nm">+ 新規スマートフォルダー</span>
          </div>
        </div>
      </div>
    </div>
  );
}
