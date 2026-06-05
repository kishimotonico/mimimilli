import {
  TRACK_NAMES,
  type SearchPresetMock,
  type WorkSummaryMock,
} from "../fixtures/index";
import { buildFileTree } from "../fixtures/fileTree";
import { exactPath, matchPath, readBody, sendJson, sendNoContent, sendNotFound } from "../http";
import type { MockHandler } from "./types";

const AXIS_TAG_PREFIX: Record<string, string> = {
  circle: "サークル/",
  cv: "cv/",
  series: "シリーズ/",
  cat: "カテゴリ/",
};

export const handleWorks: MockHandler = async ({ req, res, url, urlPath, method, state }) => {
  let params: Record<string, string> | null;

  if (method === "GET" && exactPath(urlPath, "/works")) {
    sendJson(res, searchWorks(url, state.works));
    return true;
  }

  if (method === "GET" && matchPath(urlPath, "/works/:id/cover")) {
    sendNotFound(res);
    return true;
  }

  if (method === "GET" && (params = matchPath(urlPath, "/works/:id/files"))) {
    const work = state.works.find((w) => w.id === params!.id);
    if (!work) {
      sendJson(res, null);
      return true;
    }
    sendJson(res, buildFileTree(work));
    return true;
  }

  if (method === "GET" && (params = matchPath(urlPath, "/works/:id"))) {
    const work = state.works.find((w) => w.id === params!.id);
    sendJson(res, work ? buildFullWork(work) : null);
    return true;
  }

  if (method === "PUT" && (params = matchPath(urlPath, "/works/:id/tags"))) {
    const body = await readBody(req);
    const work = state.works.find((w) => w.id === params!.id);
    if (work && Array.isArray(body.tags)) {
      work.tags = body.tags as string[];
    }
    sendNoContent(res);
    return true;
  }

  if (method === "PUT" && (params = matchPath(urlPath, "/works/:id/title"))) {
    const body = await readBody(req);
    const work = state.works.find((w) => w.id === params!.id);
    if (work && typeof body.title === "string") {
      work.title = body.title;
    }
    sendNoContent(res);
    return true;
  }

  if (method === "POST" && (params = matchPath(urlPath, "/works/:id/bookmark"))) {
    const work = state.works.find((w) => w.id === params!.id);
    if (!work) {
      sendNotFound(res);
      return true;
    }
    work.bookmarked = !work.bookmarked;
    sendJson(res, { bookmarked: work.bookmarked });
    return true;
  }

  if (method === "POST" && (params = matchPath(urlPath, "/works/:id/last-played"))) {
    const work = state.works.find((w) => w.id === params!.id);
    if (work) work.lastPlayedAt = new Date().toISOString();
    sendNoContent(res);
    return true;
  }

  if (method === "POST" && matchPath(urlPath, "/works/:id/resume")) {
    sendNoContent(res);
    return true;
  }

  if (method === "GET" && exactPath(urlPath, "/tags")) {
    const allTags = [...new Set(state.works.flatMap((w) => w.tags))].sort();
    sendJson(res, allTags);
    return true;
  }

  if (method === "GET" && exactPath(urlPath, "/presets")) {
    sendJson(res, state.presets);
    return true;
  }

  if (method === "POST" && exactPath(urlPath, "/presets")) {
    const body = await readBody(req);
    const preset: SearchPresetMock = {
      id: state.nextPresetId++,
      name: (body.name as string) ?? "",
      query: (body.query as string) ?? "",
      tagFilters: (body.tagFilters as string[]) ?? [],
      sortId: (body.sortId as string) ?? "added-desc",
    };
    state.presets.push(preset);
    sendJson(res, { id: preset.id });
    return true;
  }

  if (method === "DELETE" && (params = matchPath(urlPath, "/presets/:id"))) {
    const id = Number(params.id);
    state.presets = state.presets.filter((p) => p.id !== id);
    sendNoContent(res);
    return true;
  }

  if (method === "POST" && exactPath(urlPath, "/export")) {
    const data = JSON.stringify({ version: 1, works: state.works }, null, 2);
    sendJson(res, { data });
    return true;
  }

  if (method === "POST" && (params = matchPath(urlPath, "/dlsite/:workId/fetch"))) {
    sendJson(res, {
      rjCode: params.workId,
      title: `（モック）${params.workId}`,
      circle: "モックサークル",
      cvs: ["モックCV"],
      genreTags: ["テスト"],
      coverUrl: null,
      url: `https://www.dlsite.com/maniax/work/=/product_id/${params.workId}.html`,
    });
    return true;
  }

  if (method === "POST" && matchPath(urlPath, "/dlsite/:workId/apply")) {
    sendNoContent(res);
    return true;
  }

  return false;
};

function buildFullWork(summary: WorkSummaryMock) {
  const namedTracks = TRACK_NAMES[summary.id];
  const tracks = Array.from({ length: summary.trackCount }, (_, i) => ({
    title: namedTracks?.[i] ?? `Track ${i + 1}`,
    file: `track${String(i + 1).padStart(2, "0")}.mp3`,
  }));

  return {
    ...summary,
    defaultPlaylist: "default",
    createdAt: summary.addedAt,
    playlists: summary.trackCount > 0 ? [{ name: "default", tracks }] : [],
    resumePosition: 0,
    resumeTrackIndex: 0,
  };
}

function searchWorks(url: string, works: WorkSummaryMock[]) {
  const queryString = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const queryParams = new URLSearchParams(queryString);
  const q = queryParams.get("q") ?? "";
  const tagsRaw = queryParams.get("tags") ?? "";
  const tagOp = (queryParams.get("tagOp") ?? "AND").toUpperCase();
  const axis = queryParams.get("axis") ?? "";
  const axisValue = queryParams.get("axisValue") ?? "";
  const view = queryParams.get("view") ?? "";
  const sort = queryParams.get("sort") ?? "added-desc";

  let results = [...works];

  if (q) {
    const normalizedQuery = q.toLowerCase();
    results = results.filter((work) =>
      work.title.toLowerCase().includes(normalizedQuery) ||
      work.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    );
  }

  if (tagsRaw) {
    const tagList = tagsRaw.split(",").filter(Boolean);
    if (tagOp === "AND") {
      results = results.filter((work) =>
        tagList.every((tagFilter) =>
          work.tags.some((tag) => tag.toLowerCase().includes(tagFilter.toLowerCase()))
        )
      );
    } else {
      results = results.filter((work) =>
        tagList.some((tagFilter) =>
          work.tags.some((tag) => tag.toLowerCase().includes(tagFilter.toLowerCase()))
        )
      );
    }
  }

  if (axis && axisValue) {
    const prefix = AXIS_TAG_PREFIX[axis] ?? `${axis}/`;
    const fullValue = prefix + axisValue;
    results = results.filter((work) => work.tags.some((tag) => tag === fullValue || tag === axisValue));
  }

  if (view === "recent") results = results.filter((work) => work.lastPlayedAt != null);
  else if (view === "added") {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    results = results.filter((work) => work.addedAt >= cutoff);
  }
  else if (view === "fav") results = results.filter((work) => work.bookmarked);
  else if (view === "unplayed") results = results.filter((work) => !work.lastPlayedAt && work.status === "ok");
  else if (view === "missing") results = results.filter((work) => work.status === "missing");

  if (sort === "title-asc") results.sort((a, b) => a.title.localeCompare(b.title, "ja"));
  else if (sort === "title-desc") results.sort((a, b) => b.title.localeCompare(a.title, "ja"));
  else if (sort === "added-asc") results.sort((a, b) => a.addedAt < b.addedAt ? -1 : 1);
  else if (sort === "added-desc") results.sort((a, b) => a.addedAt > b.addedAt ? -1 : 1);
  else if (sort === "duration-asc") results.sort((a, b) => a.totalDurationSec - b.totalDurationSec);
  else if (sort === "duration-desc") results.sort((a, b) => b.totalDurationSec - a.totalDurationSec);
  else if (sort === "last-played") {
    results.sort((a, b) => {
      if (!a.lastPlayedAt && !b.lastPlayedAt) return 0;
      if (!a.lastPlayedAt) return 1;
      if (!b.lastPlayedAt) return -1;
      return a.lastPlayedAt > b.lastPlayedAt ? -1 : 1;
    });
  }

  return results;
}
