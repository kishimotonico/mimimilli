import { useId, useMemo, useState } from "react";
import type { Work, WorkPatch, SmartFolder, WorkSummary } from "@mimikago/shared";
import type { AxisLandingPresentation } from "../model/axisLandingPresentation";
import CoverImg from "../../../entities/work/ui/CoverImg";
import Tag from "../../../entities/work/ui/Tag";
import { parseTag } from "../../../entities/work/model";
import {
  buildWorkPatchTags,
  getEditableFlatTags,
} from "../../../entities/work/editableTags";
import { I } from "../../../shared/ui/Icon";
import { formatDuration, formatTime } from "../../../shared/lib/format";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

// ── Work Detail ───────────────────────────────────────────────

interface WorkDetailProps {
  work: Work;
  onPlay: (trackIndex: number) => void;
  onResume: () => void;
  playingTrackIndex: number | null;
  tagSuggestions: string[];
  isPatching: boolean;
  onPatchWork: (body: WorkPatch) => Promise<Work>;
}

function WorkDetail({
  work,
  onPlay,
  onResume,
  playingTrackIndex,
  tagSuggestions,
  isPatching,
  onPatchWork,
}: WorkDetailProps) {
  const playlist = work.playlists.find((p) => p.name === (work.defaultPlaylist ?? "default")) ?? work.playlists[0];
  const tracks = playlist?.tracks ?? [];
  const isPlayable = work.status === "ok";
  const hasResume =
    work.resumePosition > 0
    && work.resumeTrackIndex >= 0
    && work.resumeTrackIndex < tracks.length;
  const resumeTrack = hasResume ? tracks[work.resumeTrackIndex] : null;
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(work.title);
  const [isTitleSaving, setIsTitleSaving] = useState(false);
  const [isTagEditing, setIsTagEditing] = useState(false);
  const [flatTagDraft, setFlatTagDraft] = useState(() => getEditableFlatTags(work.tags));
  const [tagInput, setTagInput] = useState("");
  const [isTagSaving, setIsTagSaving] = useState(false);
  const [isBookmarkSaving, setIsBookmarkSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const tagListId = useId();

  const structuredTags = useMemo(
    () => work.tags.filter((tag) => parseTag(tag).kind !== "flat"),
    [work.tags]
  );
  const flatTagSuggestions = useMemo(
    () => [
      ...new Set(
        tagSuggestions.filter(
          (tag) => parseTag(tag).kind === "flat" && !flatTagDraft.includes(tag)
        )
      ),
    ],
    [flatTagDraft, tagSuggestions]
  );

  const startTitleEditing = () => {
    setTitleDraft(work.title);
    setEditError(null);
    setIsTitleEditing(true);
  };

  const cancelTitleEditing = () => {
    setTitleDraft(work.title);
    setEditError(null);
    setIsTitleEditing(false);
  };

  const saveTitle = async () => {
    const title = titleDraft.trim();
    if (!title || isPatching) return;
    if (title === work.title) {
      setIsTitleEditing(false);
      return;
    }

    setIsTitleSaving(true);
    setEditError(null);
    try {
      await onPatchWork({ title });
      setIsTitleEditing(false);
    } catch {
      setEditError("タイトルを保存できませんでした。");
    } finally {
      setIsTitleSaving(false);
    }
  };

  const startTagEditing = () => {
    setFlatTagDraft(getEditableFlatTags(work.tags));
    setTagInput("");
    setEditError(null);
    setIsTagEditing(true);
  };

  const cancelTagEditing = () => {
    setFlatTagDraft(getEditableFlatTags(work.tags));
    setTagInput("");
    setEditError(null);
    setIsTagEditing(false);
  };

  const addFlatTag = () => {
    const tag = tagInput.trim();
    if (!tag || parseTag(tag).kind !== "flat" || flatTagDraft.includes(tag)) return;
    setFlatTagDraft((current) => [...current, tag]);
    setTagInput("");
  };

  const saveTags = async () => {
    if (isPatching) return;
    const tags = buildWorkPatchTags(work.tags, flatTagDraft);
    setIsTagSaving(true);
    setEditError(null);
    try {
      await onPatchWork({ tags });
      setIsTagEditing(false);
      setTagInput("");
    } catch {
      setEditError("タグを保存できませんでした。");
    } finally {
      setIsTagSaving(false);
    }
  };

  const toggleBookmark = async () => {
    if (isPatching) return;
    setIsBookmarkSaving(true);
    setEditError(null);
    try {
      await onPatchWork({ bookmarked: !work.bookmarked });
    } catch {
      setEditError("ブックマークを更新できませんでした。");
    } finally {
      setIsBookmarkSaving(false);
    }
  };

  return (
    <div className="mle-prv__body">
      <div className="mle-prv__hero">
        <div className="mle-prv__cover">
          <CoverImg id={work.id} title={work.title} hasCover={!!work.coverImage} size={140} radius={6} />
        </div>
        <div className="mle-prv__meta">
          <div className="mle-prv__kicker">
            {work.status === "ok" && <span className="reg">登録済</span>}
            {work.status === "missing" && <span className="warn"><I.err size={11} /> ファイル欠損</span>}
            {work.status === "error" && <span className="warn"><I.err size={11} /> メタ読み込みエラー</span>}
            <span>追加 {formatDate(work.addedAt)}</span>
            {work.lastPlayedAt && <span>· 最終再生 {formatDate(work.lastPlayedAt)}</span>}
          </div>
          {isTitleEditing ? (
            <form
              className="mle-prv__title-editor"
              onSubmit={(event) => {
                event.preventDefault();
                void saveTitle();
              }}
            >
              <input
                autoFocus
                className="mle-prv__title-input"
                value={titleDraft}
                aria-label="作品タイトル"
                aria-invalid={titleDraft.trim().length === 0}
                onChange={(event) => setTitleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") cancelTitleEditing();
                }}
              />
              <button className="mle-prv__edit-action" type="submit" disabled={!titleDraft.trim() || isTitleSaving || isPatching}>
                保存
              </button>
              <button className="mle-prv__edit-action" type="button" onClick={cancelTitleEditing} disabled={isTitleSaving}>
                キャンセル
              </button>
            </form>
          ) : (
            <div className="mle-prv__title-row">
              <h2 className="mle-prv__title">{work.title}</h2>
              <button className="mle-prv__edit-action" type="button" onClick={startTitleEditing} disabled={isPatching}>
                編集
              </button>
            </div>
          )}
          {(work.totalDurationSec > 0 || tracks.length > 0) && (
            <div className="mle-prv__row">
              {tracks.length > 0 && <span>{tracks.length} トラック</span>}
              {work.totalDurationSec > 0 && (
                <><span className="dot">·</span><span>{formatDuration(work.totalDurationSec)}</span></>
              )}
            </div>
          )}
          {isTagEditing ? (
            <div className="mle-prv__tag-editor">
              <div className="mle-prv__tags">
                {structuredTags.map((tag) => <Tag key={tag} tag={tag} />)}
                {flatTagDraft.map((tag) => (
                  <Tag
                    key={tag}
                    tag={tag}
                    onRemove={() => setFlatTagDraft((current) => current.filter((item) => item !== tag))}
                  />
                ))}
              </div>
              {structuredTags.length > 0 && (
                <p className="mle-prv__tag-note">分類タグはメタデータ保護のため編集対象外です。</p>
              )}
              <div className="mle-prv__tag-add">
                <input
                  className="mle-prv__tag-input"
                  list={tagListId}
                  value={tagInput}
                  aria-label="追加するタグ"
                  placeholder="フラットタグを追加"
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addFlatTag();
                    }
                    if (event.key === "Escape") cancelTagEditing();
                  }}
                />
                <datalist id={tagListId}>
                  {flatTagSuggestions.map((tag) => <option key={tag} value={tag} />)}
                </datalist>
                <button
                  className="mle-prv__edit-action"
                  type="button"
                  disabled={!tagInput.trim() || parseTag(tagInput.trim()).kind !== "flat" || flatTagDraft.includes(tagInput.trim())}
                  onClick={addFlatTag}
                >
                  追加
                </button>
                <button className="mle-prv__edit-action is-primary" type="button" disabled={isTagSaving || isPatching} onClick={() => void saveTags()}>
                  保存
                </button>
                <button className="mle-prv__edit-action" type="button" disabled={isTagSaving} onClick={cancelTagEditing}>
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="mle-prv__tag-row">
              <div className="mle-prv__tags">
                {work.tags.map((tag) => <Tag key={tag} tag={tag} />)}
              </div>
              <button className="mle-prv__edit-action" type="button" onClick={startTagEditing} disabled={isPatching}>
                タグを編集
              </button>
            </div>
          )}
          {editError && <p className="mle-prv__edit-error" role="alert">{editError}</p>}
          <div className="mle-prv__actions">
            {hasResume && isPlayable ? (
              <>
                <button className="mll-fab is-primary" onClick={onResume}>
                  <I.play size={12} /> 続きから再生
                </button>
                <span className="mle-prv__resume">
                  {resumeTrack?.title} · {formatTime(work.resumePosition)} から再開
                </span>
                <button className="mll-fab" onClick={() => onPlay(0)}>
                  最初から再生
                </button>
              </>
            ) : (
              <button
                className="mll-fab is-primary"
                disabled={!isPlayable}
                aria-disabled={!isPlayable}
                onClick={() => { if (isPlayable) onPlay(0); }}
              >
                <I.play size={12} /> 最初から再生
              </button>
            )}
            <button
              className={`mll-fab ${work.bookmarked ? "is-on" : ""}`}
              type="button"
              aria-label={work.bookmarked ? "ブックマークを解除" : "ブックマークに追加"}
              aria-pressed={work.bookmarked}
              disabled={isBookmarkSaving || isPatching}
              onClick={() => void toggleBookmark()}
            >
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

      {work.status === "missing" && (
        <div className="mle-prv__warn">
          <I.err size={16} />
          <div className="mle-prv__warn-body">
            <p className="mle-prv__warn-title">ファイルが見つかりません</p>
            <p className="mle-prv__warn-text">登録時のフォルダーが移動または削除された可能性があります。再生はできません。</p>
            <p className="mle-prv__warn-path">{work.physicalPath}</p>
          </div>
        </div>
      )}

      {work.status === "error" && (
        <div className="mle-prv__warn">
          <I.err size={16} />
          <div className="mle-prv__warn-body">
            <p className="mle-prv__warn-title">メタデータの読み込みに失敗しました</p>
            <p className="mle-prv__warn-text">{work.errorMessage ?? "詳細不明のエラーが発生しました。"}</p>
            <p className="mle-prv__warn-path">{work.physicalPath}</p>
          </div>
        </div>
      )}

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
                className={`mle-prv__trk ${playingTrackIndex === i ? "is-now" : ""} ${hasResume && work.resumeTrackIndex === i ? "is-resume" : ""} ${!isPlayable ? "is-disabled" : ""}`}
                onClick={() => { if (isPlayable) onPlay(i); }}
              >
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <span className="name">
                  <span className="title">{tr.title}</span>
                  {hasResume && work.resumeTrackIndex === i && (
                    <span className="resume">再開 {formatTime(work.resumePosition)}</span>
                  )}
                </span>
                {tr.end != null && tr.start != null && (
                  <span className="dur">{formatDuration(Math.round(tr.end - tr.start))}</span>
                )}
                <div className="src">
                  <button className="mle-icbtn" title="再生" disabled={!isPlayable} aria-disabled={!isPlayable}>
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

function AxisLanding({
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
            w.status === "missing" ? "ファイル欠損"
            : w.status === "error" ? "メタ読み込みエラー"
            : null;
          return (
            <div
              key={w.id}
              className="mll-related__card"
              role="button"
              tabIndex={0}
              onClick={() => onSelectWork(w.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelectWork(w.id);
              }}
            >
              <div className="mll-related__cover">
                <CoverImg id={w.id} title={w.title} hasCover={!!w.coverImage} size={80} radius={6} />
                {statusLabel && (
                  <span className="mll-related__status" title={statusLabel}>
                    <I.err size={12} />
                  </span>
                )}
              </div>
              <div className="mll-related__title">{w.title}</div>
            </div>
          );
        })}
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
  axisLandingPresentation: AxisLandingPresentation;
  selectedWork: Work | null;
  smartFolder: SmartFolder | null;
  axisWorks: WorkSummary[];
  smartFolderWorks: WorkSummary[];
  playingTrackIndex: number | null;
  onPlay: (trackIndex: number) => void;
  onResume: () => void;
  onSelectWork: (id: string) => void;
  tagSuggestions: string[];
  isPatching: boolean;
  onPatchWork: (body: WorkPatch) => Promise<Work>;
}

export default function PreviewPane({
  mode,
  axisLandingPresentation,
  selectedWork,
  smartFolder,
  axisWorks,
  smartFolderWorks,
  playingTrackIndex,
  onPlay,
  onResume,
  onSelectWork,
  tagSuggestions,
  isPatching,
  onPatchWork,
}: PreviewPaneProps) {
  const title =
    mode === "work" ? "詳細"
    : mode === "smart-folder" ? "スマートフォルダー"
    : mode === "axis-landing" ? axisLandingPresentation.panelTitle
    : "プレビュー";

  return (
    <div className="mle-prv">
      <div className="mle-prv__hd">
        <span className="label">{title}</span>
      </div>
      {mode === "work" && selectedWork && (
        <WorkDetail
          key={selectedWork.id}
          work={selectedWork}
          onPlay={onPlay}
          onResume={onResume}
          playingTrackIndex={playingTrackIndex}
          tagSuggestions={tagSuggestions}
          isPatching={isPatching}
          onPatchWork={onPatchWork}
        />
      )}
      {mode === "axis-landing" && (
        <AxisLanding
          presentation={axisLandingPresentation}
          works={axisWorks}
          onSelectWork={onSelectWork}
        />
      )}
      {mode === "smart-folder" && smartFolder && (
        <SmartFolderView sf={smartFolder} works={smartFolderWorks} />
      )}
      {mode === "empty" && <EmptyPreview />}
    </div>
  );
}
