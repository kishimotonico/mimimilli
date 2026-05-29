import {
  type SmartFolderMock,
  type SmartFolderRuleMock,
} from "../fixtures/index";
import { exactPath, matchPath, readBody, sendJson, sendNoContent, sendNotFound } from "../http";
import type { MockHandler } from "./types";

const AXIS_TAG_PREFIX: Record<string, string> = {
  circle: "サークル/",
  cv: "cv/",
  series: "シリーズ/",
  cat: "カテゴリ/",
};

export const handleLibrary: MockHandler = async ({ req, res, urlPath, method, state }) => {
  let params: Record<string, string> | null;

  if (method === "GET" && (params = matchPath(urlPath, "/library/axes/:axis"))) {
    const items = buildAxisFacetItems(params.axis, state.works);
    sendJson(res, items);
    return true;
  }

  if (method === "GET" && (params = matchPath(urlPath, "/library/smart-folders/:id/works"))) {
    const smartFolder = state.smartFolders.find((s) => s.id === params!.id);
    sendJson(res, smartFolder ? filterSmartFolderWorks(smartFolder, state.works) : []);
    return true;
  }

  if (method === "GET" && (params = matchPath(urlPath, "/library/smart-folders/:id"))) {
    const smartFolder = state.smartFolders.find((s) => s.id === params!.id);
    smartFolder ? sendJson(res, smartFolder) : sendNotFound(res);
    return true;
  }

  if (method === "PUT" && (params = matchPath(urlPath, "/library/smart-folders/:id"))) {
    const body = await readBody(req);
    const index = state.smartFolders.findIndex((s) => s.id === params!.id);
    if (index < 0) {
      sendNotFound(res);
      return true;
    }
    state.smartFolders[index] = { ...state.smartFolders[index], ...body } as SmartFolderMock;
    sendNoContent(res);
    return true;
  }

  if (method === "DELETE" && (params = matchPath(urlPath, "/library/smart-folders/:id"))) {
    state.smartFolders = state.smartFolders.filter((s) => s.id !== params!.id);
    sendNoContent(res);
    return true;
  }

  if (method === "GET" && exactPath(urlPath, "/library/smart-folders")) {
    sendJson(res, state.smartFolders);
    return true;
  }

  if (method === "POST" && exactPath(urlPath, "/library/smart-folders")) {
    const body = await readBody(req);
    const smartFolder: SmartFolderMock = {
      id: `sf-${state.nextSmartFolderId++}`,
      name: (body.name as string) ?? "新規フォルダー",
      rules: (body.rules as SmartFolderRuleMock[]) ?? [],
      sort: (body.sort as string) ?? "added-desc",
      createdAt: new Date().toISOString(),
    };
    state.smartFolders.push(smartFolder);
    sendJson(res, smartFolder, 201);
    return true;
  }

  return false;
};

function buildAxisFacetItems(axis: string, works: { tags: string[]; addedAt: string }[]) {
  const prefix = AXIS_TAG_PREFIX[axis];
  const counts = new Map<string, number>();

  for (const work of works) {
    if (axis === "tag") {
      for (const tag of work.tags) {
        if (!tag.includes("/")) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    } else if (axis === "year") {
      const year = work.addedAt.slice(0, 4);
      counts.set(year, (counts.get(year) ?? 0) + 1);
    } else if (prefix) {
      for (const tag of work.tags) {
        if (tag.startsWith(prefix)) {
          const value = tag.slice(prefix.length);
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
      }
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

function filterSmartFolderWorks<T extends { tags: string[]; totalDurationSec: number }>(
  smartFolder: SmartFolderMock,
  works: T[],
) {
  let result = [...works];

  for (const rule of smartFolder.rules) {
    if (rule.field === "タグ" && rule.operator === "∋") {
      const values = rule.values;
      if (rule.conjunction === "AND NOT") {
        result = result.filter((w) => !values.some((v) => w.tags.includes(v)));
      } else {
        result = result.filter((w) => values.some((v) => w.tags.includes(v)));
      }
    } else if (rule.field === "長さ" && rule.operator === "≥") {
      const minSec = parseInt(rule.values[0] ?? "0", 10);
      result = result.filter((w) => w.totalDurationSec >= minSec);
    }
  }

  return result;
}
