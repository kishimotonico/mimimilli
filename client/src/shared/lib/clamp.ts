/** value を [min, max] へ収める。min > max のときは min を返す。 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
