import React from "react";
import type { WorkSummary, AxisFacetItem, AxisId } from "../../../types";
import WorkRow from "./WorkRow";
import DrillHeader from "./DrillHeader";
import { I } from "../../../components/Icon";

interface ContentColumnProps {
  axis: AxisId;
  drillValue: string | null;
  works: WorkSummary[];
  facetItems: AxisFacetItem[];
  selectedWorkId: string | null;
  selectedTags: string[];
  playingWorkId?: string;
  isLoading?: boolean;
  onWorkSelect: (id: string) => void;
  onDrillSelect: (value: string) => void;
  onDrillBack: () => void;
  onTagToggle: (tag: string) => void;
}

const FACET_AXES = new Set(["circle", "cv", "series", "cat", "year"]);

function isFacetAxis(a: AxisId): boolean { return FACET_AXES.has(a as string); }
function isSmartAxis(a: AxisId): boolean { return (a as string).startsWith("smart-"); }

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", color: "var(--ink-4)", fontSize: 12 }}>
      {message}
    </div>
  );
}

export default function ContentColumn({
  axis,
  drillValue,
  works,
  facetItems,
  selectedWorkId,
  selectedTags,
  playingWorkId,
  isLoading,
  onWorkSelect,
  onDrillSelect,
  onDrillBack,
  onTagToggle,
}: ContentColumnProps) {
  const hd = drillValue
    ? `${works.length} 件`
    : facetItems.length > 0
    ? `${facetItems.length} 件`
    : `${works.length} 件`;

  // ── Tag axis: show tag list with checkboxes ───────────────
  if (axis === "tag" && !drillValue) {
    return (
      <div className="mle-col is-content">
        <div className="mle-col__hd">
          <span>タグ</span>
          <span className="count">{facetItems.length} 件</span>
        </div>
        {selectedTags.length > 0 && (
          <div className="mll-tagband">
            <span className="mll-tagband__lbl">AND</span>
            {selectedTags.map((t, i) => (
              <React.Fragment key={t}>
                {i > 0 && <span className="mll-tagband__and">AND</span>}
                <span className="mll-tagband__chip">
                  {t}
                  <button className="x" onClick={() => onTagToggle(t)}>
                    <I.x size={9} />
                  </button>
                </span>
              </React.Fragment>
            ))}
            <span className="mll-tagband__count">{works.length} 件</span>
          </div>
        )}
        <div className="mle-col__list">
          {isLoading ? (
            <EmptyState message="読み込み中..." />
          ) : facetItems.length === 0 ? (
            <EmptyState message="タグがありません" />
          ) : (
            facetItems.map((item) => (
              <div
                key={item.value}
                className={`mll-tagrow ${selectedTags.includes(item.value) ? "is-checked" : ""}`}
                onClick={() => onTagToggle(item.value)}
              >
                <div className="check">
                  {selectedTags.includes(item.value) && <I.x size={9} style={{ transform: "rotate(45deg)" }} />}
                </div>
                <span className="nm">{item.value}</span>
                <span className="count">{item.count}</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Facet axis, no drill: show facet value list ──────────
  if (isFacetAxis(axis) && !drillValue) {
    const axisLabels: Record<string, string> = { circle: "サークル", cv: "CV", series: "シリーズ", cat: "カテゴリ", year: "追加日" };
    return (
      <div className="mle-col is-content">
        <div className="mle-col__hd">
          <span>{axisLabels[axis] ?? axis}</span>
          <span className="count">{facetItems.length} 件</span>
        </div>
        <div className="mle-col__list">
          {isLoading ? (
            <EmptyState message="読み込み中..." />
          ) : facetItems.length === 0 ? (
            <EmptyState message="項目がありません" />
          ) : (
            facetItems.map((item) => (
              <div
                key={item.value}
                className="mll-erow"
                onClick={() => onDrillSelect(item.value)}
              >
                <span className="ic">
                  {axis === "cv" ? (
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--paper-3)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 600 }}>
                      {item.value.slice(0, 1)}
                    </span>
                  ) : (
                    <I.folder size={13} />
                  )}
                </span>
                <span className="nm">{item.value}</span>
                <span className="count">{item.count}</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── View / drill / smart: show work list ─────────────────
  const showDrill = isFacetAxis(axis) && drillValue;

  return (
    <div className="mle-col is-content">
      {showDrill ? (
        <DrillHeader
          axisLabel={axis}
          value={drillValue!}
          count={works.length}
          onBack={onDrillBack}
        />
      ) : (
        <div className="mle-col__hd">
          <span>{isSmartAxis(axis) ? "スマートフォルダー" : "作品"}</span>
          <span className="count">{hd}</span>
        </div>
      )}
      <div className="mle-col__list">
        {isLoading ? (
          <EmptyState message="読み込み中..." />
        ) : works.length === 0 ? (
          <EmptyState message="作品が見つかりません" />
        ) : (
          works.map((w) => (
            <WorkRow
              key={w.id}
              work={w}
              isSelected={w.id === selectedWorkId}
              isPlaying={w.id === playingWorkId}
              onSelect={() => onWorkSelect(w.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
