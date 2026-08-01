import type { Work } from "@mimimilli/shared";

/**
 * レジューム位置の「作品全体に対する割合」（0〜1）を求める。カバー画像下端の
 * 進捗バー表示用。resumeが指すプレイリスト内で、resumeTrackより前のトラックの
 * durationSecを積み上げてoffsetSecを足し、プレイリスト合計時間で割る。
 *
 * durationSec未計測（null）のトラックが1つでもあれば、割合を正しく出せないため
 * nullを返す（雑に0扱いにしない）。resumeが無い・対象トラックが見つからない・
 * 合計時間が0以下の場合もnull。
 */
export function computeResumeProgressRatio(work: Work): number | null {
  const resume = work.resume;
  if (!resume) return null;

  const playlist = work.playlists.find((candidate) => candidate.id === resume.playlistId);
  if (!playlist) return null;

  const trackIndex = playlist.tracks.findIndex((candidate) => candidate.id === resume.trackId);
  if (trackIndex < 0) return null;

  let elapsedSec = 0;
  let totalSec = 0;
  for (let i = 0; i < playlist.tracks.length; i++) {
    const duration = playlist.tracks[i]!.durationSec;
    if (duration === null) return null;
    totalSec += duration;
    if (i < trackIndex) elapsedSec += duration;
  }
  elapsedSec += resume.offsetSec;

  if (totalSec <= 0) return null;
  return Math.min(1, Math.max(0, elapsedSec / totalSec));
}

/** カバー進捗バーのfill要素に渡すCSS width値。割合が極小でも「聴きかけである」
 *  こと自体は視認できるよう、最小8pxを保証する（role="progressbar"のaria値は
 *  この最小幅の影響を受けず、呼び出し側で実割合をそのまま使う）。 */
export function resumeProgressBarWidth(ratio: number): string {
  // 浮動小数点の丸め誤差（0.55*100 = 55.00000000000001等）でCSS値が汚れないよう、
  // 小数点以下2桁に丸める（進捗バーの表示精度としても十分）。
  const percent = Math.round(ratio * 10000) / 100;
  return `max(8px, ${percent}%)`;
}
