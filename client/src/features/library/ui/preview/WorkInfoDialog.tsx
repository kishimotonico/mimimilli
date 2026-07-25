import type { ReactNode } from "react";
import type { Track, Work } from "@mimimilli/shared";
import Button from "../../../../shared/ui/Button";
import IconButton from "../../../../shared/ui/IconButton";
import { I } from "../../../../shared/ui/Icon";
import { useDialogModal } from "../../../../shared/ui/useDialogModal";
import { STATUS_LABEL } from "./DlsiteEditor";
import { formatDate, formatDateTime, formatDuration } from "./format";

const STATUS_TEXT: Record<Work["status"], string> = {
  ok: "登録済み",
  missing: "ファイル欠損",
  error: "メタ読み込みエラー",
};

interface WorkInfoDialogProps {
  work: Work;
  trackCount: number;
  hasResume: boolean;
  resumeTrack: Track | null;
  resumeTime: string;
  onClose: () => void;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5">
      <dt className="w-[96px] shrink-0 font-sans text-[11px] text-ink-3">{label}</dt>
      <dd className="min-w-0 flex-1 break-words font-jp text-[12px] text-ink-0">{children}</dd>
    </div>
  );
}

/** work.urls・work.tags 等、閲覧ビューに常時出ている情報も含め、
 *  Work型が持つ状態を過不足なく読み取り専用で見せる。編集は WorkEditDialog の役割。 */
export function WorkInfoDialog({
  work,
  trackCount,
  hasResume,
  resumeTrack,
  resumeTime,
  onClose,
}: WorkInfoDialogProps) {
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose });
  const playlistLabel =
    work.playlists.length === 0
      ? "なし"
      : `${work.playlists.find((playlist) => playlist.id === work.defaultPlaylistId)?.name ?? work.playlists[0]!.name}${
          work.playlists.length > 1 ? `（全${work.playlists.length}件）` : ""
        }`;

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックはuseDialogModalで判定する。
    <dialog
      ref={dialogRef}
      aria-labelledby="work-info-title"
      onCancel={handleCancel}
      onClick={(event) => handleBackdropClick(event, onClose)}
      className="m-auto w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-0 font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      <div className="flex max-h-[calc(100vh-32px)] min-h-0 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center border-b border-line-soft px-[18px] py-[14px]">
          <h2 id="work-info-title" className="min-w-0 flex-1 font-sans text-[14px] font-semibold">
            作品の情報
          </h2>
          <IconButton icon={I.x} label="閉じる" size="sm" onClick={onClose} />
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-[18px] py-4">
          <section aria-labelledby="work-info-basic-title" className="flex flex-col gap-1">
            <h3
              id="work-info-basic-title"
              className="mb-1 font-sans text-[11px] font-semibold text-ink-1"
            >
              基本情報
            </h3>
            <dl className="flex flex-col divide-y divide-line-soft">
              <InfoRow label="タイトル">{work.title}</InfoRow>
              <InfoRow label="状態">
                {STATUS_TEXT[work.status]}
                {work.status === "error" && work.errorMessage && (
                  <span className="mt-0.5 block text-ink-2">{work.errorMessage}</span>
                )}
              </InfoRow>
              <InfoRow label="ブックマーク">{work.bookmarked ? "あり" : "なし"}</InfoRow>
              <InfoRow label="タグ">{work.tags.length > 0 ? work.tags.join(", ") : "なし"}</InfoRow>
              <InfoRow label="追加日">{formatDate(work.addedAt)}</InfoRow>
              <InfoRow label="作成日時">
                {work.createdAt ? formatDate(work.createdAt) : "不明"}
              </InfoRow>
              <InfoRow label="最終再生">
                {work.lastPlayedAt ? formatDate(work.lastPlayedAt) : "再生履歴なし"}
              </InfoRow>
              <InfoRow label="再生位置">
                {hasResume && resumeTrack ? `${resumeTrack.title} · ${resumeTime}` : "なし"}
              </InfoRow>
              <InfoRow label="トラック・時間">
                {trackCount > 0
                  ? `${trackCount} トラック · ${work.totalDurationSec !== null ? formatDuration(work.totalDurationSec) : "--:--"}`
                  : "なし"}
              </InfoRow>
              <InfoRow label="プレイリスト">{playlistLabel}</InfoRow>
              <InfoRow label="カバー画像">{work.cover ? "あり" : "なし"}</InfoRow>
              <InfoRow label="物理パス">
                <span className="break-all font-mono text-[11px]">{work.physicalPath}</span>
              </InfoRow>
              <InfoRow label="外部リンク">
                {work.urls.length > 0 ? (
                  <ul className="flex flex-col gap-0.5">
                    {work.urls.map((u) => (
                      <li key={u.url}>
                        <a
                          href={u.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-acc-ink hover:underline"
                        >
                          {u.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  "なし"
                )}
              </InfoRow>
            </dl>
          </section>

          <section
            aria-labelledby="work-info-dlsite-title"
            className="flex flex-col gap-1 border-t border-line-soft pt-4"
          >
            <h3
              id="work-info-dlsite-title"
              className="mb-1 font-sans text-[11px] font-semibold text-ink-1"
            >
              DLsite連携
            </h3>
            <dl className="flex flex-col divide-y divide-line-soft">
              <InfoRow label="状態">{STATUS_LABEL[work.dlsite.status]}</InfoRow>
              <InfoRow label="RJコード">
                <span className="font-mono text-[11px]">{work.dlsite.rjCode ?? "未設定"}</span>
              </InfoRow>
              <InfoRow label="最終取得日時">
                {work.dlsite.lastAttemptAt ? formatDateTime(work.dlsite.lastAttemptAt) : "未取得"}
              </InfoRow>
              <InfoRow label="エラー内容">{work.dlsite.error ?? "-"}</InfoRow>
              <InfoRow label="適用済みタグ">
                {work.dlsite.appliedTags.length > 0 ? work.dlsite.appliedTags.join(", ") : "-"}
              </InfoRow>
            </dl>
          </section>
        </div>
        <footer className="flex shrink-0 justify-end border-t border-line-soft px-[18px] py-3">
          <Button variant="quiet" onClick={onClose}>
            閉じる
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
