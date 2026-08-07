export interface Point {
  x: number;
  y: number;
}

/** 点 p が三角形 a-b-c の内部（境界含む）にあるかを符号付き面積法で判定する。 */
export function isPointInTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  // 3頂点が同一直線上（面積0）の退化三角形は、判定点も同じ直線上にあると
  // 外積が全て0になり誤って true を返すため、明示的に除外する。
  if (cross(c, a, b) === 0) return false;
  const d1 = cross(p, a, b);
  const d2 = cross(p, b, c);
  const d3 = cross(p, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function cross(p: Point, a: Point, b: Point): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}
