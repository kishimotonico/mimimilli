export interface WorkSummaryMock {
  id: string;
  title: string;
  coverImage: string | null;
  status: string;
  physicalPath: string;
  totalDurationSec: number;
  addedAt: string;
  errorMessage: string | null;
  urls: { label: string; url: string }[];
  tags: string[];
  trackCount: number;
  bookmarked: boolean;
  lastPlayedAt: string | null;
}

export interface SmartFolderRuleMock {
  conjunction: string;
  field: string;
  operator: string;
  values: string[];
}

export interface SmartFolderMock {
  id: string;
  name: string;
  rules: SmartFolderRuleMock[];
  sort: string;
  createdAt: string;
}

export interface SearchPresetMock {
  id: number;
  name: string;
  query: string;
  tagFilters: string[];
  sortId: string;
}
