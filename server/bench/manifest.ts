import type { SortId } from "@mimimilli/shared";

export interface BenchManifest {
  version: 1;
  workCount: number;
  rngSeed: number;
  catalogDb: string;
  userDb: string;
  libRoot: string;
  sampleWorkId: string;
  sampleAudioRelPath: string;
  sampleSearchQ: string;
  sampleTag: string;
  smartFolderNoRulesId: string;
  smartFolderWithRulesId: string;
  deepPage: number;
  sorts: SortId[];
}

export const BENCH_SORTS: SortId[] = [
  "added-desc",
  "added-asc",
  "title-asc",
  "title-desc",
  "duration-desc",
  "duration-asc",
  "last-played",
  "random",
  "id-asc",
];
