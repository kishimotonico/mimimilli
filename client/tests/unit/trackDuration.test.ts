import { describe, expect, it } from "vitest";
import { formatTrackDuration, trackDurationAriaLabel } from "../../src/shared/lib/trackDuration";

describe("formatTrackDuration", () => {
  it("解決済みは四捨五入した総時間を返す", () => {
    expect(formatTrackDuration({ durationSec: 906.6, durationKind: "resolved" })).toBe("15:07");
  });

  it("未計測は --:-- を返す", () => {
    expect(formatTrackDuration({ durationSec: null, durationKind: "unprobed" })).toBe("--:--");
  });

  it("計測失敗は em dash を返す", () => {
    expect(formatTrackDuration({ durationSec: null, durationKind: "missing" })).toBe("—");
    expect(formatTrackDuration({ durationSec: null, durationKind: "unsupported" })).toBe("—");
    expect(formatTrackDuration({ durationSec: null, durationKind: "invalid-start" })).toBe("—");
  });
});

describe("trackDurationAriaLabel", () => {
  it("未計測と計測失敗を区別する", () => {
    expect(trackDurationAriaLabel("unprobed")).toBe("再生時間未計測");
    expect(trackDurationAriaLabel("missing")).toMatch(/計測失敗/);
  });
});
