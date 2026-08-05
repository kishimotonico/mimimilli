import type { WorkListItem } from "@mimimilli/shared";
import CoverImg from "../../../../entities/work/ui/CoverImg";
import { selectFixedCoverThumbnailWidth } from "../../../../entities/work/ui/coverThumbnailWidth";
import { I } from "../../../../shared/ui/Icon";
import { formatDuration } from "./format";

/** 作品カード。DiscoveryDashboard・PreviewPane のタグ絞り込み結果など、
 *  作品一覧をカード列で並べる箇所で共有する描画実装 */
export function WorkCard({
  work,
  onSelectWork,
}: {
  work: WorkListItem;
  onSelectWork: (id: string) => void;
}) {
  const statusLabel =
    work.status === "missing"
      ? "ファイル欠損"
      : work.status === "error"
        ? "メタ読み込みエラー"
        : null;
  const meta = [
    work.circleName,
    work.totalDurationSec !== null && work.totalDurationSec > 0
      ? formatDuration(work.totalDurationSec)
      : null,
  ].filter(Boolean);

  return (
    <button type="button" className="mll-related__card" onClick={() => onSelectWork(work.id)}>
      <div className="mll-related__cover">
        <CoverImg
          id={work.id}
          title={work.title}
          cover={work.cover}
          size={80}
          radius={6}
          requestWidth={selectFixedCoverThumbnailWidth(80, window.devicePixelRatio)}
        />
        {statusLabel && (
          <span className="mll-related__status" title={statusLabel}>
            <I.err size={12} />
            <span className="sr-only">{statusLabel}</span>
          </span>
        )}
      </div>
      <div className="mll-related__title">{work.title}</div>
      {meta.length > 0 && <div className="mll-related__meta">{meta.join(" · ")}</div>}
    </button>
  );
}

export function WorkCardGrid({
  works,
  onSelectWork,
}: {
  works: WorkListItem[];
  onSelectWork: (id: string) => void;
}) {
  return (
    <div className="mll-related">
      {works.map((w) => (
        <WorkCard key={w.id} work={w} onSelectWork={onSelectWork} />
      ))}
    </div>
  );
}
