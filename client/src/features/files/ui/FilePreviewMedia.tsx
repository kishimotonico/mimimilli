import { useEffect, useState, type ReactNode } from "react";
import { I } from "../../../shared/ui/Icon";
import Lightbox from "../../../shared/ui/Lightbox";
import { formatFileSize } from "../../../shared/lib/format";
import { getWorkspaceMediaUrl } from "../../../entities/file-system/api";
import { getWorkFolderDisplay } from "../model/workFolderDisplay";
import type { MediaKind } from "@mimimilli/shared";
import { FILE_KIND_ICON, FILE_KIND_LABEL, type FileKind, type FsEntry } from "../model/types";

function formatBreakdownLine(breakdown: { kind: FileKind; count: number }[]): string {
  return breakdown.map(({ kind: k, count }) => `${FILE_KIND_LABEL[k]} ${count}`).join(" ・ ");
}

export function Hero({
  kind,
  entry,
  isWorkFolder,
  breakdown,
  workTitle,
}: {
  kind: FileKind;
  entry: FsEntry;
  isWorkFolder: boolean;
  breakdown?: { kind: FileKind; count: number }[];
  /** 単一ファイル作品の実タイトル。物理ファイル名からの推測（getWorkFolderDisplay）より優先する（TASK-428.18） */
  workTitle?: string;
}) {
  const Ic = I[FILE_KIND_ICON[kind]];
  const display = getWorkFolderDisplay(entry.name, isWorkFolder ? entry.workId : null);
  const name = workTitle ?? display.name;
  const metaLine =
    breakdown && breakdown.length > 0
      ? formatBreakdownLine(breakdown)
      : kind !== "dir"
        ? formatFileSize(entry.size)
        : null;
  return (
    <div className={`mle-fprev__hero is-${kind}`}>
      <span className="ic">
        <Ic size={28} />
      </span>
      <div className="bd">
        <div className="mle-fprev__name">
          {display.badge && <span className="wbadge">{display.badge}</span>}
          {name}
        </div>
        <div className="mle-fprev__path">{entry.path}</div>
        {metaLine && <div className="mle-fprev__meta">{metaLine}</div>}
      </div>
    </div>
  );
}

export function WorkspaceMedia({
  entry,
  isRegisteredWork,
  workTitle,
}: {
  entry: FsEntry;
  /** 作品として登録済みか（フォルダー単位・単一ファイル単位どちらも含む）。
   *  Heroの isWorkFolder とは意味が異なる（あちらはフォルダー単位限定）ため名前を分ける（TASK-428.18） */
  isRegisteredWork: boolean;
  workTitle?: string;
}) {
  const kind = entry.mediaKind!;
  const preview = entry.preview!;
  const src = getWorkspaceMediaUrl(entry.path);

  if (preview.kind === "unavailable") {
    return <UnavailableMedia entry={entry} kind={kind} />;
  }

  switch (kind) {
    case "audio":
      return (
        <Hero kind="audio" entry={entry} isWorkFolder={isRegisteredWork} workTitle={workTitle} />
      );
    case "image":
      return <ImageMedia entry={entry} src={src} />;
    case "pdf":
      return <PdfMedia entry={entry} src={src} />;
    case "text":
      return <TextMedia entry={entry} src={src} truncated={preview.kind === "truncated"} />;
    case "video":
      return <VideoMedia entry={entry} src={src} />;
    default:
      return <UnavailableMedia entry={entry} kind={kind} />;
  }
}

/** entryがメディアプレビュー対応ファイル（preview/mediaKind有り）ならWorkspaceMedia、
 *  それ以外（フォルダー・非対応ファイル）ならHeroへ振り分ける。 */
export function FilePreviewMediaSlot({
  entry,
  isDir,
  kind,
  isRegisteredWork,
  breakdown,
  workTitle,
}: {
  entry: FsEntry;
  isDir: boolean;
  kind: FileKind;
  isRegisteredWork: boolean;
  breakdown: { kind: FileKind; count: number }[];
  workTitle?: string;
}) {
  if (!isDir && entry.preview && entry.mediaKind) {
    return (
      <WorkspaceMedia entry={entry} isRegisteredWork={isRegisteredWork} workTitle={workTitle} />
    );
  }
  return (
    <Hero
      kind={kind}
      entry={entry}
      isWorkFolder={isRegisteredWork}
      breakdown={isDir ? breakdown : undefined}
      workTitle={workTitle}
    />
  );
}

function MediaCaption({ entry }: { entry: FsEntry }) {
  return (
    <div className="mle-fprev__caption">
      <div className="mle-fprev__name">{entry.name}</div>
      <div className="mle-fprev__path">{entry.path}</div>
      <div className="mle-fprev__meta">{formatFileSize(entry.size)}</div>
    </div>
  );
}

function useMediaLoadError(src: string) {
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    setErrored(false);
  }, [src]);
  return { errored, onError: () => setErrored(true) };
}

function MediaLoadGuard({
  src,
  entry,
  kind,
  children,
}: {
  src: string;
  entry: FsEntry;
  kind: Exclude<MediaKind, "audio" | "other">;
  children: (onError: () => void) => ReactNode;
}) {
  const { errored, onError } = useMediaLoadError(src);
  if (errored) return <MediaError entry={entry} kind={kind} />;
  return children(onError);
}

function ImageMedia({ entry, src }: { entry: FsEntry; src: string }) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  return (
    <MediaLoadGuard src={src} entry={entry} kind="image">
      {(onError) => (
        <>
          <div className="mle-fprev__media">
            <img
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role, jsx-a11y/no-noninteractive-element-to-interactive-role -- imgをbuttonで包むとサイズ算出が崩れる（縮小フィットのみのimgをshrink-to-fitコンテナに置くと0x0になる既知の挙動）ため、img自体をクリック領域にする
              role="button"
              className="mle-fprev__img cursor-zoom-in"
              src={src}
              alt={entry.name}
              tabIndex={0}
              aria-label="画像を拡大表示"
              onClick={() => setIsLightboxOpen(true)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                setIsLightboxOpen(true);
              }}
              onError={onError}
            />
          </div>
          <MediaCaption entry={entry} />
          {isLightboxOpen && (
            <Lightbox src={src} alt={entry.name} onClose={() => setIsLightboxOpen(false)} />
          )}
        </>
      )}
    </MediaLoadGuard>
  );
}

function PdfMedia({ entry, src }: { entry: FsEntry; src: string }) {
  return (
    <MediaLoadGuard src={src} entry={entry} kind="pdf">
      {(onError) => (
        <>
          <div className="mle-fprev__media is-document">
            <object
              className="mle-fprev__document"
              data={src}
              type="application/pdf"
              aria-label={`${entry.name}のPDFプレビュー`}
              onError={onError}
            >
              <span>PDFを表示できませんでした。</span>
            </object>
          </div>
          <MediaCaption entry={entry} />
        </>
      )}
    </MediaLoadGuard>
  );
}

function VideoMedia({ entry, src }: { entry: FsEntry; src: string }) {
  return (
    <MediaLoadGuard src={src} entry={entry} kind="video">
      {(onError) => (
        <>
          <div className="mle-fprev__media is-video">
            <video // oxlint-disable-line jsx-a11y/media-has-caption -- ローカル作品プレビューに字幕は無い
              className="mle-fprev__video"
              controls
              src={src}
              onError={onError}
            >
              このブラウザは動画再生に対応していません。
            </video>
          </div>
          <MediaCaption entry={entry} />
        </>
      )}
    </MediaLoadGuard>
  );
}

function TextMedia({ entry, src, truncated }: { entry: FsEntry; src: string; truncated: boolean }) {
  const [state, setState] = useState<{ text: string; error: boolean }>({ text: "", error: false });

  useEffect(() => {
    const controller = new AbortController();
    setState({ text: "", error: false });
    fetch(src, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("text preview failed");
        return response.text();
      })
      .then((text) => setState({ text, error: false }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setState({ text: "", error: true });
      });
    return () => controller.abort();
  }, [src]);

  if (state.error) return <MediaError entry={entry} kind="text" />;
  return (
    <>
      <div className="mle-fprev__media is-text">
        <pre className="mle-fprev__text">{state.text}</pre>
      </div>
      {truncated && <p className="mle-fprev__note">サイズ上限のため先頭のみ表示</p>}
      <MediaCaption entry={entry} />
    </>
  );
}

function UnavailableMedia({ entry, kind }: { entry: FsEntry; kind: MediaKind }) {
  const fileKind = kind === "other" ? "other" : kind;
  const Icon = I[FILE_KIND_ICON[fileKind]];
  const extension = extensionOf(entry.name);
  return (
    <div className={`mle-fprev__hero is-${fileKind}`}>
      <span className="ic">
        <Icon size={28} />
      </span>
      <div className="bd">
        <div className="mle-fprev__name">{entry.name}</div>
        <div className="mle-fprev__path">
          {FILE_KIND_LABEL[fileKind]}
          {extension ? `（.${extension}）` : ""}のプレビューは利用できません
        </div>
      </div>
    </div>
  );
}

function MediaError({
  entry,
  kind,
}: {
  entry: FsEntry;
  kind: Exclude<MediaKind, "audio" | "other">;
}) {
  const Icon = I[FILE_KIND_ICON[kind]];
  return (
    <div className={`mle-fprev__hero is-${kind}`} role="alert">
      <span className="ic">
        <Icon size={28} />
      </span>
      <div className="bd">
        <div className="mle-fprev__name">{entry.name}</div>
        <div className="mle-fprev__path">プレビューを読み込めませんでした</div>
      </div>
    </div>
  );
}

function extensionOf(name: string): string | null {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1) : null;
}
