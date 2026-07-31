import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CollectionPlaceholder } from "../../src/features/library/ui/preview/CollectionPlaceholder";

afterEach(cleanup);

describe("CollectionPlaceholder", () => {
  it("メッセージのみ渡された場合、統計行を出さない", () => {
    render(<CollectionPlaceholder message="作品を選択してください" />);

    expect(screen.getByText("作品を選択してください")).toBeTruthy();
    expect(screen.queryByText(/作品 ·/)).toBeNull();
    expect(screen.queryByText("統計の取得に失敗しました")).toBeNull();
  });

  it("stats が loading のときは統計行を出さない", () => {
    render(
      <CollectionPlaceholder message="作品を選択してください" stats={{ status: "loading" }} />,
    );

    expect(screen.queryByText(/作品 ·/)).toBeNull();
    expect(screen.queryByText("統計の取得に失敗しました")).toBeNull();
  });

  it("stats が error のときは案内を出す（隠蔽しない）", () => {
    render(<CollectionPlaceholder message="作品を選択してください" stats={{ status: "error" }} />);

    expect(screen.getByText("統計の取得に失敗しました")).toBeTruthy();
  });

  it("stats が ready のとき、件数・トラック数・再生時間を控えめな1行で表示する", () => {
    render(
      <CollectionPlaceholder
        message="作品を選択してください"
        stats={{ status: "ready", count: 11, trackCount: 87, durationSec: 45296 }}
      />,
    );

    expect(screen.getByText(/11作品/)).toBeTruthy();
    expect(screen.getByText(/87トラック/)).toBeTruthy();
    expect(screen.getByText(/12:34:56/)).toBeTruthy();
  });

  it("hint が渡された場合は案内文の下に表示する", () => {
    render(
      <CollectionPlaceholder message="作品が見つかりません" hint="検索条件を変えてみてください" />,
    );

    expect(screen.getByText("検索条件を変えてみてください")).toBeTruthy();
  });
});
