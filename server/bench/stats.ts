export interface LatencyStats {
  p50: number;
  p95: number;
  min: number;
  max: number;
  samples: number;
}

export function percentile(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return 0;
  const rank = (p / 100) * (sortedMs.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sortedMs[lower]!;
  const weight = rank - lower;
  return sortedMs[lower]! * (1 - weight) + sortedMs[upper]! * weight;
}

export function summarizeLatencies(samplesMs: number[]): LatencyStats {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    samples: sorted.length,
  };
}
