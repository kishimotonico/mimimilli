export type ScanEntryRing =
  | { kind: "none" }
  | { kind: "indeterminate" }
  | { kind: "determinate"; ratio: number };
