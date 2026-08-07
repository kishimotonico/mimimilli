import { describe, expect, it } from "vitest";
import { isPointInTriangle } from "../../src/shared/lib/pointInTriangle";

describe("isPointInTriangle", () => {
  const a = { x: 0, y: 0 };
  const b = { x: 0, y: 100 };
  const c = { x: 100, y: 50 };

  it("三角形の内部の点を true と判定する", () => {
    expect(isPointInTriangle({ x: 30, y: 50 }, a, b, c)).toBe(true);
  });

  it("三角形の外部の点を false と判定する", () => {
    expect(isPointInTriangle({ x: -10, y: 50 }, a, b, c)).toBe(false);
    expect(isPointInTriangle({ x: 30, y: -10 }, a, b, c)).toBe(false);
    expect(isPointInTriangle({ x: 200, y: 50 }, a, b, c)).toBe(false);
  });

  it("頂点自身は内部（境界含む）と判定する", () => {
    expect(isPointInTriangle(a, a, b, c)).toBe(true);
    expect(isPointInTriangle(b, a, b, c)).toBe(true);
    expect(isPointInTriangle(c, a, b, c)).toBe(true);
  });

  it("辺の上の点は内部（境界含む）と判定する", () => {
    expect(isPointInTriangle({ x: 0, y: 50 }, a, b, c)).toBe(true);
  });

  it("頂点の並び順（時計回り/反時計回り）に関わらず同じ結果になる", () => {
    const inside = { x: 30, y: 50 };
    expect(isPointInTriangle(inside, a, b, c)).toBe(isPointInTriangle(inside, a, c, b));
  });

  it("退化した三角形（面積0）では常に false を返す", () => {
    const degenerateA = { x: 0, y: 0 };
    const degenerateB = { x: 10, y: 0 };
    const degenerateC = { x: 20, y: 0 };
    expect(isPointInTriangle({ x: 5, y: 5 }, degenerateA, degenerateB, degenerateC)).toBe(false);
  });

  it("退化した三角形（面積0）で判定点も同じ直線上にあっても false を返す", () => {
    const degenerateA = { x: 0, y: 0 };
    const degenerateB = { x: 10, y: 0 };
    const degenerateC = { x: 20, y: 0 };
    // 全頂点・判定点が y=0 の直線上に並ぶため、外積が全て0になり誤ってtrueを返しうるケース
    expect(isPointInTriangle({ x: 30, y: 0 }, degenerateA, degenerateB, degenerateC)).toBe(false);
    expect(isPointInTriangle({ x: 5, y: 0 }, degenerateA, degenerateB, degenerateC)).toBe(false);
  });
});
