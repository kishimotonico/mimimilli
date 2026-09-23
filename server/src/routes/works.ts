// 作品関連: GET/PATCH/DELETE /works, /works/:id/resume, /works/:id/last-played,
//          POST /works/:id/playback-preparation,
//          GET /tags, POST /export, POST /works, GET /works/register-preview
import { Hono } from "hono";
import {
  normalizeTag,
  resumeBodySchema,
  tagSchema,
  WORKS_DEFAULT_PAGE_SIZE,
  workBookmarkPatchSchema,
  workCreateBodySchema,
  identityConflictReassignBodySchema,
  workRegisterPreviewQuerySchema,
  workProjectionBodySchema,
  workSourceMutationResultSchema,
  workSourcePatchSchema,
  worksQuerySchema,
} from "@mimimilli/shared";
import { InvalidResumeError, WorkRegisterError } from "../errors.ts";
import type { DataAdapter } from "../adapter/index.ts";
import {
  apiError,
  conflict,
  invalidRequest,
  notFound,
  throwSourceCommandError,
} from "../lib/httpError.ts";
import { SourceChangedError } from "../errors.ts";

function parseWorkTagPath(c: {
  req: { path: string; param: (name: string) => string };
}): import("@mimimilli/shared").NormalizedTag {
  const workId = c.req.param("id");
  const marker = `/works/${workId}/tags/`;
  const index = c.req.path.indexOf(marker);
  const encoded = index >= 0 ? c.req.path.slice(index + marker.length) : "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    invalidRequest("タグが不正です");
  }
  const parsed = tagSchema.safeParse(decoded);
  if (!parsed.success) invalidRequest(parsed.error.issues[0]?.message ?? "タグが不正です");
  const normalized = normalizeTag(parsed.data);
  if (normalized === null) invalidRequest("空になるタグは登録できません");
  return normalized;
}

export function worksRoute(
  adapter: DataAdapter,
  onWorkRegistered: (workId: string) => void = () => {},
): Hono {
  const app = new Hono();

  app.get("/works", async (c) => {
    const parsed = worksQuerySchema.safeParse({
      ...c.req.query(),
      tags: c.req.queries("tags"),
      ids: c.req.queries("ids"),
    });
    if (!parsed.success) {
      invalidRequest("works のクエリパラメータが不正です");
    }
    // page/limit 未指定でもサーバー側デフォルトでページングする（TASK-73）。
    // limit だけの指定は page=1 として扱う
    const page = await adapter.queryWorks({
      ...parsed.data,
      page: parsed.data.page ?? 1,
      limit: parsed.data.limit ?? WORKS_DEFAULT_PAGE_SIZE,
    });
    return c.json(page);
  });

  app.get("/works/register-preview", async (c) => {
    const parsed = workRegisterPreviewQuerySchema.safeParse(c.req.query());
    if (!parsed.success) invalidRequest("register-preview のクエリパラメータが不正です");
    const preview = await adapter.getWorkRegisterPreview(parsed.data.path);
    if (!preview) notFound("指定されたパスは存在しないか、ルート配下ではありません");
    return c.json(preview);
  });

  app.post("/works/projection", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = workProjectionBodySchema.safeParse(body);
    if (!parsed.success) invalidRequest("projection のパスが不正です");
    try {
      const result = await adapter.projectWorkSource(parsed.data.path);
      if (!result) invalidRequest("指定されたパスは存在しないか、ルート配下ではありません");
      if (result.catalogInserted) onWorkRegistered(result.snapshot.id);
      return c.json(workSourceMutationResultSchema.parse(result));
    } catch (error) {
      throwSourceCommandError(error);
    }
  });

  app.post("/works", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = workCreateBodySchema.safeParse(body);
    if (!parsed.success) invalidRequest("作品の登録内容が不正です");
    try {
      const result = await adapter.createWork(parsed.data);
      if (!result) notFound("指定されたパスは存在しないか、ルート配下ではありません");
      if (result.projection.status === "published") onWorkRegistered(result.snapshot.id);
      return c.json(workSourceMutationResultSchema.parse(result), 201);
    } catch (error) {
      if (error instanceof WorkRegisterError) {
        if (error.code === "already_registered") conflict(error.message);
        if (error.code === "descendants_registered") conflict(error.message);
        if (error.code === "identity_conflict") conflict(error.message);
        if (error.code === "invalid_meta") conflict(error.message);
        if (error.code === "not_configured") notFound(error.message);
      }
      throw error;
    }
  });

  app.post("/works/identity-conflicts/reassign", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = identityConflictReassignBodySchema.safeParse(body);
    if (!parsed.success) invalidRequest("再取り込み対象のパスが不正です");
    const result = await adapter.reassignIdentityConflict(parsed.data).catch((error) => {
      if (error instanceof SourceChangedError) throw apiError("source_changed", error.message);
      throw error;
    });
    if (!result) notFound("指定されたパスはidentity_conflict診断の対象ではありません");
    if (result.projection.status === "published") onWorkRegistered(result.snapshot.id);
    return c.json(workSourceMutationResultSchema.parse(result), 201);
  });

  // ":id" と衝突するため、GET /works/:id より前で定義する
  app.get("/works/missing-count", async (c) => {
    const count = await adapter.countMissingWorks();
    return c.json({ count });
  });

  app.post("/works/unregister-missing", async (c) => {
    const result = await adapter.unregisterMissingWorks();
    return c.json(result);
  });

  app.get("/works/:id/source", async (c) => {
    const workId = c.req.param("id");
    try {
      const snapshot = await adapter.getWorkEditSnapshot(workId);
      if (!snapshot) notFound(`作品が見つかりません: ${workId}`);
      return c.json(snapshot);
    } catch (error) {
      throwSourceCommandError(error);
    }
  });

  app.get("/works/:id", async (c) => {
    const work = await adapter.getWork(c.req.param("id"));
    if (!work) notFound(`作品が見つかりません: ${c.req.param("id")}`);
    return c.json(work);
  });

  app.post("/works/:id/playback-preparation", async (c) => {
    const work = await adapter.prepareWorkPlayback(c.req.param("id"));
    if (!work) notFound(`作品が見つかりません: ${c.req.param("id")}`);
    return c.json(work);
  });

  app.patch("/works/:id/bookmark", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = workBookmarkPatchSchema.safeParse(body);
    if (!parsed.success) invalidRequest("ブックマークの更新内容が不正です");
    const result = await adapter.patchWorkBookmark(c.req.param("id"), parsed.data);
    if (!result) notFound(`作品が見つかりません: ${c.req.param("id")}`);
    return c.json(result);
  });

  app.patch("/works/:id", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = workSourcePatchSchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest("作品の更新内容が不正です");
    }
    const workId = c.req.param("id");
    try {
      const result = await adapter.patchWorkSource(workId, parsed.data);
      if (!result) notFound(`作品が見つかりません: ${workId}`);
      return c.json(result);
    } catch (error) {
      throwSourceCommandError(error);
    }
  });

  app.put("/works/:id/tags/*", async (c) => {
    const workId = c.req.param("id");
    const tag = parseWorkTagPath(c);
    try {
      const result = await adapter.addWorkTag(workId, tag);
      if (!result) notFound(`作品が見つかりません: ${workId}`);
      return c.json(result);
    } catch (error) {
      throwSourceCommandError(error);
    }
  });

  app.delete("/works/:id/tags/*", async (c) => {
    const workId = c.req.param("id");
    const tag = parseWorkTagPath(c);
    try {
      const result = await adapter.removeWorkTag(workId, tag);
      if (!result) notFound(`作品が見つかりません: ${workId}`);
      return c.json(result);
    } catch (error) {
      throwSourceCommandError(error);
    }
  });

  app.delete("/works/:id", async (c) => {
    const ok = await adapter.deleteWork(c.req.param("id"));
    if (!ok) notFound(`作品が見つかりません: ${c.req.param("id")}`);
    return c.body(null, 204);
  });

  app.post("/works/:id/resume", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = resumeBodySchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest("resume の内容が不正です");
    }
    const ok = await adapter.saveResume(c.req.param("id"), parsed.data).catch((error) => {
      if (error instanceof InvalidResumeError) invalidRequest(error.message);
      throw error;
    });
    if (!ok) notFound(`作品が見つかりません: ${c.req.param("id")}`);
    return c.body(null, 204);
  });

  app.post("/works/:id/last-played", async (c) => {
    const ok = await adapter.touchLastPlayed(c.req.param("id"));
    if (!ok) notFound(`作品が見つかりません: ${c.req.param("id")}`);
    return c.body(null, 204);
  });

  app.get("/tags", async (c) => {
    const tags = await adapter.listTags();
    return c.json(tags);
  });

  app.post("/export", async (c) => {
    const exported = await adapter.exportLibrary();
    return c.json(exported);
  });

  return app;
}
