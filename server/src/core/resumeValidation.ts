// resume保存（PUT /api/works/:id/resume）の検証規則。real/fixture 両adapterが共有する。
import { InvalidResumeError } from "../errors.ts";

export interface ResumeTrackRef {
  durationSec: number | null;
}

/** trackがWorkに属していない、またはoffsetSecがトラック区間外の場合に InvalidResumeError を投げる。 */
export function validateResumeRequest(track: ResumeTrackRef | null, offsetSec: number): void {
  if (!track) {
    throw new InvalidResumeError("resumeのPlaylistまたはTrackが作品に属していません");
  }
  if (offsetSec < 0 || (track.durationSec !== null && offsetSec > track.durationSec)) {
    throw new InvalidResumeError("resumeのoffsetSecがトラック区間外です");
  }
}
