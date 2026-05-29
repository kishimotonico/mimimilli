import type { Work, SmartFolder, WorkSummary, AxisId } from "../../../types";
import CoverImg from "../../../components/CoverImg";
import Tag from "../../../components/Tag";
import { I } from "../../../components/Icon";
import { formatDuration } from "../../../shared/lib/format";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

// ── Work Detail ───────────────────────────────────────────────

interface WorkDetailProps {
  work: Work;
  onPlay: (trackIndex: number) => void;
  playingTrackIndex: number | null;
}

function WorkDetail({ work, onPlay, playingTrackIndex }: WorkDetailProps) {
  const playlist = work.playlists.find((p) => p.name === (work.defaultPlaylist ?? "default")) ?? work.playlists[0];
  const tracks = playlist?.tracks ?? [];


  return (
    <div className="mle-prv__body">
      <div className="mle-prv__hero">
        <div className="mle-prv__cover">
          <CoverImg id={work.id} title={work.title} hasCover={!!work.coverImage} size={140} radius={6} />
        </div>
        <div className="mle-prv__meta">
          <div className="mle-prv__kicker">
            <span className="reg">登録済</span>
            <span>追加 {formatDate(work.addedAt)}</span>
            {work.lastPlayedAt && <span>· 最終再生 {formatDate(work.lastPlayedAt)}</span>}
          </div>
          <h2 className="mle-prv__title">{work.title}</h2>
          {(work.totalDurationSec > 0 || tracks.length > 0) && (
            <div className="mle-prv__row">
              {tracks.length > 0 && <span>{tracks.length} トラック</span>}
              {work.totalDurationSec > 0 && (
                <><span className="dot">·</span><span>{formatDuration(work.totalDurationSec)}</span></>
              )}
            </div>
          )}
          <div className="mle-prv__tags">
            {work.tags.map((t) => <Tag key={t} tag={t} />)}
          </div>
          <div className="mle-prv__actions">
            <button className="mll-fab is-primary" onClick={() => onPlay(0)}>
              <I.play size={12} /> 最初から再生
            </button>
            <button className="mll-fab">
              <I.heart size={12} />
            </button>
            {work.urls.map((u) => (
              <a key={u.url} className="mll-fab" href={u.url} target="_blank" rel="noreferrer">
                <I.ext size={11} /> {u.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {tracks.length > 0 && (
        <>
          <div className="mle-sect">
            <span>トラック</span>
            <div className="mle-sect__rule" />
          </div>
          <div className="mle-prv__tracks">
            {tracks.map((tr, i) => (
              <div
                key={i}
                className={`mle-prv__trk ${playingTrackIndex === i ? "is-now" : ""}`}
                onClick={() => onPlay(i)}
              >
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <span className="name">{tr.title}</span>
                {tr.end != null && tr.start != null && (
                  <span className="dur">{formatDuration(Math.round(tr.end - tr.start))}</span>
                )}
                <div className="src">
                  <button className="mle-icbtn" title="再生">
                    <I.play size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Axis Landing ──────────────────────────────────────────────

function AxisLanding({ axis, works }: { axis: AxisId; works: WorkSummary[] }) {
  const axisLabels: Record<string, string> = {
    circle: "サークル", cv: "CV", series: "シリーズ", cat: "カテゴリ",
    tag: "タグ", year: "追加日",
  };
  return (
    <div className="mle-prv__body">
      <div className="mle-sect">
        <span>{axisLabels[axis] ?? axis}</span>
        <div className="mle-sect__rule" />
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 16 }}>
        左の列から絞り込みを選択してください
      </p>
      <div className="mll-related">
        {works.slice(0, 8).map((w) => (
          <div key={w.id} className="mll-related__card">
            <div className="mll-related__cover">
              <CoverImg id={w.id} title={w.title} hasCover={!!w.coverImage} size={80} radius={6} />
            </div>
            <div className="mll-related__title">{w.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Smart Folder Builder ──────────────────────────────────────

function SmartFolderView({ sf, works }: { sf: SmartFolder; works: WorkSummary[] }) {
  return (
    <div className="mle-prv__body">
      <div className="mll-smart">
        <div className="mll-smart__hd">
          <span className="pill">SMART</span>
          <span className="name">{sf.name}</span>
        </div>
        <div className="mll-smart__rules">
          {sf.rules.length === 0 ? (
            <div style={{ padding: "12px 8px", fontSize: 12, color: "var(--ink-3)" }}>ルールなし（すべての作品）</div>
          ) : sf.rules.map((rule, i) => (
            <div key={i} className="mll-smart__rule">
              <span className={`conj ${i === 0 ? "first" : ""}`}>{i === 0 ? "WHERE" : rule.conjunction}</span>
              <span className="field"><I.filter size={10} /> {rule.field}</span>
              <span className="op">{rule.operator}</span>
              <span className="val">{rule.values.join(" OR ")}</span>
            </div>
          ))}
        </div>
        <button className="mll-smart__add"><I.add size={11} /> 条件を追加</button>
        <div className="mll-smart__ft">
          <span className="hits"><b>{works.length}</b> 件マッチ</span>
        </div>
      </div>
    </div>
  );
}

// ── Empty ─────────────────────────────────────────────────────

function EmptyPreview() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--ink-4)" }}>
      <I.gridS size={28} />
      <span style={{ fontSize: 12 }}>作品を選択してください</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────

type PreviewMode = "work" | "axis-landing" | "smart-folder" | "empty";

interface PreviewPaneProps {
  mode: PreviewMode;
  axis: AxisId;
  selectedWork: Work | null;
  smartFolder: SmartFolder | null;
  axisWorks: WorkSummary[];
  smartFolderWorks: WorkSummary[];
  playingTrackIndex: number | null;
  onPlay: (trackIndex: number) => void;
}

export default function PreviewPane({
  mode,
  axis,
  selectedWork,
  smartFolder,
  axisWorks,
  smartFolderWorks,
  playingTrackIndex,
  onPlay,
}: PreviewPaneProps) {
  const title =
    mode === "work" ? "詳細"
    : mode === "smart-folder" ? "スマートフォルダー"
    : mode === "axis-landing" ? "概要"
    : "プレビュー";

  return (
    <div className="mle-prv">
      <div className="mle-prv__hd">
        <span className="label">{title}</span>
      </div>
      {mode === "work" && selectedWork && (
        <WorkDetail work={selectedWork} onPlay={onPlay} playingTrackIndex={playingTrackIndex} />
      )}
      {mode === "axis-landing" && (
        <AxisLanding axis={axis} works={axisWorks} />
      )}
      {mode === "smart-folder" && smartFolder && (
        <SmartFolderView sf={smartFolder} works={smartFolderWorks} />
      )}
      {mode === "empty" && <EmptyPreview />}
    </div>
  );
}
