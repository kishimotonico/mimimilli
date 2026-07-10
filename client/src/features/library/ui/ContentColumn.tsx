import React from "react";
import type { WorkSummary, AxisFacetItem } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import WorkRow from "./WorkRow";
import DrillHeader from "./DrillHeader";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";

interface ContentColumnProps {
  axis: AxisId;
  drillValue: string | null;
  works: WorkSummary[];
  facetItems: AxisFacetItem[];
  selectedWorkId: string | null;
  selectedTags: string[];
  searchQuery: string;
  playingWorkId?: string;
  isPlaybackActive?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onWorkSelect: (id: string) => void;
  onDrillSelect: (value: string) => void;
  onDrillBack: () => void;
  onTagToggle: (tag: string) => void;
  onClearSearch: () => void;
}

const FACET_AXES = new Set(["circle", "cv", "series", "cat", "year"]);

const AXIS_LABELS: Record<string, string> = {
  circle: "サークル",
  cv: "CV",
  series: "シリーズ",
  cat: "カテゴリ",
  year: "追加日",
};

function isFacetAxis(a: AxisId): boolean {
  return FACET_AXES.has(a as string);
}
function isSmartAxis(a: AxisId): boolean {
  return (a as string).startsWith("smart-");
}

// 0件の原因（検索語・軸ドリル絞り込み）を明示するメッセージを組み立てる。
// どちらも効いていない場合は「そもそもこの軸に作品がない」ケースなので原因表示はしない。
function buildEmptyWorksMessage(
  searchQuery: string,
  drillAxis: AxisId | null,
  drillValue: string | null,
): string {
  const drillLabel =
    drillAxis && drillValue
      ? `${AXIS_LABELS[drillAxis as string] ?? drillAxis}「${drillValue}」`
      : null;
  if (searchQuery && drillLabel) {
    return `「${searchQuery}」・${drillLabel} に一致する作品はありません`;
  }
  if (searchQuery) {
    return `「${searchQuery}」に一致する作品はありません`;
  }
  if (drillLabel) {
    return `${drillLabel} に一致する作品はありません`;
  }
  return "作品が見つかりません";
}

function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "24px 16px",
        color: "var(--ink-4)",
        fontSize: 12,
        textAlign: "center",
      }}
    >
      <span>{message}</span>
      {action}
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
  searchQuery,
  playingWorkId,
  isPlaybackActive,
  isLoading,
  isError,
  onWorkSelect,
  onDrillSelect,
  onDrillBack,
  onTagToggle,
  onClearSearch,
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
          ) : isError ? (
            <EmptyState message="読み込みに失敗しました" />
          ) : facetItems.length === 0 ? (
            <EmptyState message="タグがありません" />
          ) : (
            facetItems.map((item) => (
              <button
                type="button"
                key={item.value}
                className={`mll-tagrow ${selectedTags.includes(item.value) ? "is-checked" : ""}`}
                onClick={() => onTagToggle(item.value)}
              >
                <div className="check">
                  {selectedTags.includes(item.value) && (
                    <I.x size={9} style={{ transform: "rotate(45deg)" }} />
                  )}
                </div>
                <span className="nm">{item.value}</span>
                <span className="count">{item.count}</span>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Facet axis, no drill: show facet value list ──────────
  if (isFacetAxis(axis) && !drillValue) {
    return (
      <div className="mle-col is-content">
        <div className="mle-col__hd">
          <span>{AXIS_LABELS[axis] ?? axis}</span>
          <span className="count">{facetItems.length} 件</span>
        </div>
        <div className="mle-col__list">
          {isLoading ? (
            <EmptyState message="読み込み中..." />
          ) : isError ? (
            <EmptyState message="読み込みに失敗しました" />
          ) : facetItems.length === 0 ? (
            <EmptyState message="項目がありません" />
          ) : (
            facetItems.map((item) => (
              <button
                type="button"
                key={item.value}
                className="mll-erow"
                onClick={() => onDrillSelect(item.value)}
              >
                <span className="ic">
                  {axis === "cv" ? (
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: "var(--paper-3)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {item.value.slice(0, 1)}
                    </span>
                  ) : (
                    <I.folder size={13} />
                  )}
                </span>
                <span className="nm">{item.value}</span>
                <span className="count">{item.count}</span>
              </button>
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
        ) : isError ? (
          <EmptyState message="読み込みに失敗しました" />
        ) : works.length === 0 ? (
          <EmptyState
            message={buildEmptyWorksMessage(searchQuery, showDrill ? axis : null, drillValue)}
            action={
              searchQuery ? (
                <Button variant="ghost" icon={I.x} onClick={onClearSearch}>
                  検索をクリア
                </Button>
              ) : undefined
            }
          />
        ) : (
          works.map((w) => (
            <WorkRow
              key={w.id}
              work={w}
              isSelected={w.id === selectedWorkId}
              isPlaying={w.id === playingWorkId}
              isPlaybackActive={isPlaybackActive}
              onSelect={() => onWorkSelect(w.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
