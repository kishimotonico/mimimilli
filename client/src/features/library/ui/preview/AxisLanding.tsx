import type { WorkSummary } from "@mimimilli/shared";
import type { AxisLandingPresentation } from "../../model/axisLandingPresentation";
import CoverImg from "../../../../entities/work/ui/CoverImg";
import { I } from "../../../../shared/ui/Icon";
import { formatDuration } from "./format";

function getCircleName(work: WorkSummary): string | null {
  const tag = work.tags.find((t) => t.startsWith("サークル/") || t.startsWith("circle/"));
  if (!tag) return null;
  return tag.slice(tag.indexOf("/") + 1);
}

export function AxisLanding({
  presentation,
  works,
  onSelectWork,
}: {
  presentation: AxisLandingPresentation;
  works: WorkSummary[];
  onSelectWork: (id: string) => void;
}) {
  return (
    <div className="mle-prv__body">
      <div className="mle-sect">
        <span>{presentation.sectionTitle}</span>
        <div className="mle-sect__rule" />
        <span className="count">{works.length} 件</span>
      </div>
      {presentation.instruction && (
        <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 16 }}>
          {presentation.instruction}
        </p>
      )}
      <div className="mll-related">
        {works.map((w) => {
          const statusLabel =
            w.status === "missing"
              ? "ファイル欠損"
              : w.status === "error"
                ? "メタ読み込みエラー"
                : null;
          const meta = [
            getCircleName(w),
            w.totalDurationSec > 0 ? formatDuration(w.totalDurationSec) : null,
          ].filter(Boolean);

          return (
            <button
              type="button"
              key={w.id}
              className="mll-related__card"
              onClick={() => onSelectWork(w.id)}
            >
              <div className="mll-related__cover">
                <CoverImg
                  id={w.id}
                  title={w.title}
                  hasCover={!!w.coverImage}
                  size={80}
                  radius={6}
                />
                {statusLabel && (
                  <span className="mll-related__status" title={statusLabel}>
                    <I.err size={12} />
                  </span>
                )}
              </div>
              <div className="mll-related__title">{w.title}</div>
              {meta.length > 0 && <div className="mll-related__meta">{meta.join(" · ")}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
