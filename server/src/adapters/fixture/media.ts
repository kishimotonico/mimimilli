// fixture アダプタ用のメディア合成ロジック。
// 実ファイルを持たない fixture でも再生・シーク・カバー表示が成立するよう、
// 「指定秒数の無音WAV」と「作品ごとのSVGプレースホルダー」をメモリ上で合成する。
import type { Track, WorkSummary } from "@mimimilli/shared";
import type { MediaLocation } from "../../adapter.ts";

/** 合成WAVのフォーマット: 8kHz / mono / 8bit PCM（符号なし、無音=128） → 8,000 byte/sec */
const SAMPLE_RATE = 8000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 8;
const BYTE_RATE = SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8); // 8,000 B/s
const WAV_HEADER_SIZE = 44;
/** 8bit unsigned PCM の無音値（中央値） */
const SILENCE_BYTE = 128;

/** トラック尺が不明なときの既定値（秒） */
const DEFAULT_TRACK_DURATION_SEC = 300;

/** 指定秒数ぶんの無音WAVを表す MediaLocation を返す。
 *  全体をメモリに持たず、要求された byte range に応じてヘッダー部/無音データ部を都度生成する。 */
export function synthesizeSilentWav(durationSec: number): MediaLocation {
  const dataSize = Math.max(1, Math.round(durationSec * BYTE_RATE));
  const totalSize = WAV_HEADER_SIZE + dataSize;
  const header = buildWavHeader(dataSize);

  return {
    type: "synthetic",
    mime: "audio/wav",
    size: totalSize,
    read(start: number, end: number): Uint8Array {
      const length = end - start + 1;
      const out = new Uint8Array(length);

      for (let i = 0; i < length; i++) {
        const pos = start + i;
        out[i] = pos < WAV_HEADER_SIZE ? header[pos] : SILENCE_BYTE;
      }

      return out;
    },
  };
}

/** 44バイトの WAV (PCM) ヘッダーを構築する */
function buildWavHeader(dataSize: number): Uint8Array {
  const buf = new ArrayBuffer(WAV_HEADER_SIZE);
  const view = new DataView(buf);

  // RIFF chunk
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true); // ファイル全体 - 8
  writeAscii(view, 8, "WAVE");

  // fmt chunk
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt チャンクサイズ（PCM = 16）
  view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, BYTE_RATE, true);
  view.setUint16(32, (CHANNELS * BITS_PER_SAMPLE) / 8, true); // BlockAlign
  view.setUint16(34, BITS_PER_SAMPLE, true);

  // data chunk
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  return new Uint8Array(buf);
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/** トラックの再生尺（秒）を決める。
 *  Track.start/end が両方あればその差分、無ければ作品の totalDurationSec を
 *  trackCount で等分する。どちらも得られない場合は既定値を返す。 */
export function resolveTrackDurationSec(track: Track, work: WorkSummary, trackCount: number): number {
  if (track.start !== undefined && track.end !== undefined && track.end > track.start) {
    return track.end - track.start;
  }
  if (work.totalDurationSec > 0 && trackCount > 0) {
    return work.totalDurationSec / trackCount;
  }
  return DEFAULT_TRACK_DURATION_SEC;
}

const SVG_BACKGROUND_COLORS = [
  "#5b5fc7",
  "#c75b8a",
  "#5bc7a6",
  "#c7a35b",
  "#7a5bc7",
  "#5b9ac7",
  "#c75b5b",
  "#5bc75e",
  "#a55bc7",
  "#c7785b",
];

/** 作品IDのハッシュから安定的に背景色を選ぶ */
function colorForWorkId(workId: string): string {
  let hash = 0;
  for (let i = 0; i < workId.length; i++) {
    hash = (hash * 31 + workId.charCodeAt(i)) >>> 0;
  }
  return SVG_BACKGROUND_COLORS[hash % SVG_BACKGROUND_COLORS.length];
}

/** タイトル先頭1文字＋作品IDから決まる背景色で、簡易カバー画像SVGを合成する */
export function synthesizeCoverSvg(work: WorkSummary): MediaLocation {
  const initial = (work.title.trim().charAt(0) || "?").replace(/[<>&"']/g, "");
  const bg = colorForWorkId(work.id);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="${escapeXml(work.title)}">
  <rect width="400" height="400" fill="${bg}" />
  <text x="200" y="220" font-family="sans-serif" font-size="160" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(initial)}</text>
</svg>`;

  return synthesizeStaticContent(svg, "image/svg+xml");
}

/** 画像系の拡張子を持つパスに対する SVG プレースホルダー */
export function synthesizeFilePlaceholderSvg(relPath: string): MediaLocation {
  const name = relPath.split("/").pop() ?? relPath;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" aria-label="${escapeXml(name)}">
  <rect width="400" height="300" fill="#3a3f4b" />
  <text x="200" y="150" font-family="sans-serif" font-size="20" fill="#cfd3dc" text-anchor="middle" dominant-baseline="middle">${escapeXml(name)}</text>
</svg>`;
  return synthesizeStaticContent(svg, "image/svg+xml");
}

/** テキスト系ファイルに対する固定プレースホルダーテキスト */
export function synthesizeFilePlaceholderText(relPath: string): MediaLocation {
  const text = `（fixture）${relPath} はモックデータのためプレースホルダーを表示しています。\n`;
  return synthesizeStaticContent(text, "text/plain; charset=utf-8");
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (ch) => {
    switch (ch) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

/** 文字列全体をUTF-8バイト列として保持する静的コンテンツの MediaLocation を作る */
function synthesizeStaticContent(text: string, mime: string): MediaLocation {
  const bytes = new TextEncoder().encode(text);
  return {
    type: "synthetic",
    mime,
    size: bytes.length,
    read(start: number, end: number): Uint8Array {
      return bytes.subarray(start, end + 1);
    },
  };
}
