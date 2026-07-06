// player feature の API。resume position と最終再生時刻の保存。
// entities/work/api に実装があるが、player feature から直接参照できるよう re-export する。

export { saveResumePosition, updateLastPlayed } from "../../entities/work/api";
