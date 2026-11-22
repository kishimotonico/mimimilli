import { QueryClient } from "@tanstack/react-query";
import { SMART_FOLDER_QUERY_KEYS } from "../../src/entities/smart-folder/queryKeys";
import { SMART_FOLDER_TEMPLATES, type SmartFolderItem } from "@mimimilli/shared";

export function buildSmartFolderItem(overrides: Partial<SmartFolderItem> = {}): SmartFolderItem {
  return {
    id: "sf-00000000-0000-4000-8000-000000000001",
    name: "テスト",
    condition: { type: "and", children: [] },
    sort: null,
    groupBy: null,
    position: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    count: null,
    ...overrides,
  };
}

/** 初回起動時に入るテンプレート（サーバーの順）。件数は applyCounts で上書きする */
export function defaultSmartFolderItems(counts: Record<string, number> = {}): SmartFolderItem[] {
  return SMART_FOLDER_TEMPLATES.filter((template) => template.seeded).map((template, position) =>
    buildSmartFolderItem({
      id: template.id,
      name: template.name,
      condition: template.condition,
      sort: template.sort,
      groupBy: template.groupBy,
      position,
      count: counts[template.id] ?? null,
    }),
  );
}

/** LibraryNavigationProvider は起動時に先読み済みの一覧を前提にする */
export function seedSmartFolders(
  queryClient: QueryClient,
  items: SmartFolderItem[] = defaultSmartFolderItems(),
): void {
  queryClient.setQueryDefaults(SMART_FOLDER_QUERY_KEYS.all(), { staleTime: Infinity });
  queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), items);
}

/** スマートフォルダー一覧を先読み済みにした QueryClient（LibraryNavigationProvider の前提） */
export function createSmartFolderQueryClient(
  folders: SmartFolderItem[] = defaultSmartFolderItems(),
): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedSmartFolders(queryClient, folders);
  return queryClient;
}
