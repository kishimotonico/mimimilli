import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyDlsiteState, type Work } from "@mimimilli/shared";
import { WorkInfoDialog } from "../../src/features/library/ui/preview/WorkInfoDialog";

afterEach(cleanup);

function makeWork(overrides: Partial<Work> = {}): Work {
  return {
    id: "w1",
    title: "作品",
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: "/lib/w1",
    totalDurationSec: 120,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    defaultPlaylistId: null,
    createdAt: null,
    playlists: [],
    resume: null,
    ...overrides,
  };
}

describe("WorkInfoDialog", () => {
  it("http(s)の外部リンクはhref付きで表示する", () => {
    render(
      <WorkInfoDialog
        work={makeWork({
          urls: [{ label: "DLsite", url: "https://www.dlsite.com/work/123" }],
        })}
        trackCount={0}
        hasResume={false}
        resumeTrack={null}
        resumeTime="0:00"
        onClose={vi.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: "DLsite" });
    expect(link).toHaveAttribute("href", "https://www.dlsite.com/work/123");
  });

  it("危険スキームの外部リンクはリンク化しない", () => {
    render(
      <WorkInfoDialog
        work={makeWork({
          urls: [{ label: "危険リンク", url: "javascript:alert(1)" }],
        })}
        trackCount={0}
        hasResume={false}
        resumeTrack={null}
        resumeTime="0:00"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("危険リンク")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "危険リンク" })).toBeNull();
  });
});
