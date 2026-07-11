import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DlsiteWorkInfo, Work } from "@mimimilli/shared";
import { applyDlsiteInfo, fetchDlsiteInfo, updateDlsiteState } from "../../../../entities/work/api";
import { ApiRequestError } from "../../../../shared/api/http";
import { LIBRARY_KEYS } from "../../model/queryKeys";
import { getDlsiteInvalidationKeys } from "../../model/dlsiteInvalidation";
import {
  buildDlsiteApplyBody,
  dlsiteInfoTags,
  unappliedDlsiteTags,
} from "../../model/dlsitePreview";

const STATUS_LABEL = {
  none: "未連携",
  applied: "連携済み",
  not_found: "見つかりません",
  error: "取得エラー",
  skipped: "連携しない",
} as const;

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) return "DLsite情報の取得に失敗しました";
  if (error.code === "not_found") return "作品が見つかりません。RJコードが違うかもしれません。";
  if (error.code === "parse_error") return "DLsiteのページ構造が変わった可能性があります。";
  return "DLsiteとの通信に失敗しました。時間をおいて再試行してください。";
}

export function DlsitePanel({ work }: { work: Work }) {
  const queryClient = useQueryClient();
  const [rjCode, setRjCode] = useState(work.dlsite.rjCode ?? "");
  const [info, setInfo] = useState<DlsiteWorkInfo | null>(null);
  const [applyTitle, setApplyTitle] = useState(true);
  const [applyCover, setApplyCover] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setRjCode(work.dlsite.rjCode ?? ""), [work.dlsite.rjCode]);
  const allInfoTags = useMemo(() => (info ? dlsiteInfoTags(info) : []), [info]);

  const refresh = async (updated?: Work) => {
    if (updated) queryClient.setQueryData(LIBRARY_KEYS.workDetail(work.id), updated);
    await Promise.all(
      getDlsiteInvalidationKeys(updated ? undefined : work.id).map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
  };

  const saveCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateDlsiteState(work.id, { rjCode: rjCode.trim() || null });
      await refresh(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "RJコードを保存できませんでした");
    } finally {
      setBusy(false);
    }
  };

  const fetchInfo = async () => {
    setBusy(true);
    setError(null);
    try {
      if (rjCode.trim().toUpperCase() !== work.dlsite.rjCode) {
        const updated = await updateDlsiteState(work.id, { rjCode: rjCode.trim() || null });
        queryClient.setQueryData(LIBRARY_KEYS.workDetail(work.id), updated);
      }
      const fetched = await fetchDlsiteInfo(work.id);
      setInfo(fetched);
      setSelectedTags(unappliedDlsiteTags(work, fetched));
      setApplyTitle(fetched.title !== work.title);
      setApplyCover(Boolean(fetched.coverUrl));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!info) return;
    setBusy(true);
    setError(null);
    try {
      await applyDlsiteInfo(
        work.id,
        buildDlsiteApplyBody(info, { applyTitle, applyCover, applyTags: selectedTags }),
      );
      setInfo(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "DLsite情報を適用できませんでした");
    } finally {
      setBusy(false);
    }
  };

  const toggleSkipped = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateDlsiteState(work.id, {
        skipped: work.dlsite.status !== "skipped",
      });
      await refresh(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "連携設定を変更できませんでした");
    } finally {
      setBusy(false);
    }
  };

  const statusClass =
    work.dlsite.status === "applied"
      ? "is-applied"
      : work.dlsite.status === "error" || work.dlsite.status === "not_found"
        ? "is-error"
        : "is-muted";

  return (
    <section className="mle-dlsite">
      <div className="mle-dlsite__head">
        <span className={`mle-dlsite__badge ${statusClass}`} title={work.dlsite.error ?? undefined}>
          DLsite: {STATUS_LABEL[work.dlsite.status]}
        </span>
        <label className="mle-dlsite__skip">
          <input
            type="checkbox"
            checked={work.dlsite.status === "skipped"}
            disabled={busy}
            onChange={toggleSkipped}
          />
          この作品は連携しない
        </label>
      </div>
      <div className="mle-dlsite__controls">
        <input
          aria-label="DLsite RJコード"
          value={rjCode}
          disabled={busy}
          placeholder="RJ123456"
          onChange={(event) => setRjCode(event.target.value)}
        />
        <button type="button" disabled={busy} onClick={saveCode}>
          コードを保存
        </button>
        <button
          type="button"
          disabled={busy || !rjCode.trim() || work.dlsite.status === "skipped"}
          onClick={fetchInfo}
        >
          DLsiteから取得
        </button>
      </div>
      {error && (
        <p className="mle-prv__edit-error" role="alert">
          {error}
        </p>
      )}

      {info && (
        <>
          <button
            type="button"
            aria-label="プレビューを閉じる"
            className="mle-dlsite-dialog__backdrop"
            onClick={() => setInfo(null)}
          />
          <dialog open aria-label="DLsite情報の適用" className="mle-dlsite-dialog">
            <h3>DLsite情報の適用</h3>
            <label className="mle-dlsite-dialog__row">
              <input
                type="checkbox"
                checked={applyTitle}
                onChange={(e) => setApplyTitle(e.target.checked)}
              />
              <span>タイトル</span>
              <span>{work.title}</span>
              <span>→</span>
              <span>{info.title}</span>
            </label>
            <label className="mle-dlsite-dialog__row">
              <input
                type="checkbox"
                checked={applyCover}
                disabled={!info.coverUrl}
                onChange={(e) => setApplyCover(e.target.checked)}
              />
              <span>カバー</span>
              <span>{work.coverImage ?? "未設定"}</span>
              <span>→</span>
              <span>{info.coverUrl ? "DLsite画像" : "画像なし"}</span>
            </label>
            <div className="mle-dlsite-dialog__tags">
              <span>タグ</span>
              {allInfoTags.map((tag) => {
                const applied = work.tags.includes(tag);
                return (
                  <label key={tag}>
                    <input
                      type="checkbox"
                      disabled={applied}
                      checked={applied || selectedTags.includes(tag)}
                      onChange={(e) =>
                        setSelectedTags((current) =>
                          e.target.checked
                            ? [...current, tag]
                            : current.filter((item) => item !== tag),
                        )
                      }
                    />
                    {tag} {applied && <small>適用済み</small>}
                  </label>
                );
              })}
            </div>
            <div className="mle-dlsite-dialog__actions">
              <button type="button" disabled={busy} onClick={() => setInfo(null)}>
                キャンセル
              </button>
              <button type="button" disabled={busy} onClick={apply}>
                選択内容を適用
              </button>
            </div>
          </dialog>
        </>
      )}
    </section>
  );
}
