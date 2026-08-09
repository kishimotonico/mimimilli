import type {
  AxisFacetItem,
  AxisFacetsQuery,
  SmartFolder,
  SmartFolderCreate,
  SmartFolderEvalQuery,
  SmartFolderUpdate,
  TagPrefix,
  TagPrefixCandidate,
  TagPrefixCreate,
  TagPrefixUpdate,
  WorksPage,
} from "@mimimilli/shared";

export interface ClassificationAdapter {
  /** axis は "tag" / "year" / 任意の prefix 文字列（正規形・小文字）（ADR-0005） */
  getAxisFacets(axis: string, filter?: Partial<AxisFacetsQuery>): Promise<AxisFacetItem[]>;
  listTagPrefixes(): Promise<TagPrefix[]>;
  /** 既存の prefix と重複する場合は null（ルートが 409 を返す） */
  createTagPrefix(input: TagPrefixCreate): Promise<TagPrefix | null>;
  updateTagPrefix(prefix: string, patch: TagPrefixUpdate): Promise<TagPrefix | null>;
  deleteTagPrefix(prefix: string): Promise<boolean>;
  listTagPrefixCandidates(): Promise<TagPrefixCandidate[]>;
  listSmartFolders(): Promise<SmartFolder[]>;
  createSmartFolder(input: SmartFolderCreate): Promise<SmartFolder>;
  updateSmartFolder(id: string, input: SmartFolderUpdate): Promise<SmartFolder | null>;
  deleteSmartFolder(id: string): Promise<boolean>;
  evalSmartFolder(id: string, query: SmartFolderEvalQuery): Promise<WorksPage | null>;
}
