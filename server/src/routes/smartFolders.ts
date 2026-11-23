// /smart-folders 以下（ADR-0040「HTTP の契約」）。
//   GET    /smart-folders                  定義の一覧（サーバーの順。件数は含めない）
//   GET    /smart-folders/counts           件数（Record<id, number>）。数えるものは showsCount で選ぶ
//   POST   /smart-folders                  作成（id を省くと sf-<uuid> を採番。既定から追加・削除の取り消しも id と position を渡してここを通る）
//   PUT    /smart-folders/order            全件の順序を置き換える
//   PATCH  /smart-folders/:id              部分更新（送った列だけ）
//   DELETE /smart-folders/:id              削除
//   GET    /smart-folders/:id/works        作品一覧（scanRecord でスキャン記録の作品に絞れる）
//   GET    /smart-folders/:id/groups       値一覧・「＋絞り込み」候補
import { Hono } from "hono";
import type { ZodError } from "zod";
import {
  ALL_SMART_FOLDER_ID,
  showsCount,
  type SmartFolderCounts,
  smartFolderCreateSchema,
  smartFolderOrderSchema,
  smartFolderPatchSchema,
  smartFolderViolation,
} from "@mimimilli/shared";
import type { DataAdapter } from "../adapter/index.ts";
import { conflict, invalidRequest, notFound } from "../lib/httpError.ts";
import { readJsonBody } from "../lib/jsonBody.ts";
import type { ScanRecordStore } from "../scanRecord.ts";
import {
  parseSmartFolderGroupsRequest,
  parseSmartFolderWorksRequest,
  queryFolderGroups,
  queryFolderWorks,
} from "./smartFolderQuery.ts";

/** 件数を出す行だけを1往復で数える。応答のキーは行の ID */
async function countFolders(adapter: DataAdapter): Promise<SmartFolderCounts> {
  const targets = (await adapter.listSmartFolders()).filter(showsCount);
  if (targets.length === 0) return {};
  const counts = await adapter.countByConditions(
    targets.map((folder) => folder.condition),
    { now: Date.now() },
  );
  return Object.fromEntries(targets.map((folder, i) => [folder.id, counts[i]!]));
}

/** 条件の検証エラーは、スキーマが返す文言（保存できない理由）をそのまま返す。それ以外は固定の文言 */
function writeInvalidMessage(fallback: string): (error: ZodError) => string {
  return (error) => error.issues.find((issue) => issue.code === "custom")?.message ?? fallback;
}

function notFoundFolder(id: string): never {
  notFound(`見つかりません: ${id}`);
}

async function requireFolder(adapter: DataAdapter, id: string) {
  const row = await adapter.getSmartFolder(id);
  if (!row) notFoundFolder(id);
  return { name: row.name, condition: row.condition, groupBy: row.groupBy };
}

export function smartFoldersRoute(adapter: DataAdapter, scanRecord: ScanRecordStore): Hono {
  const app = new Hono();

  app.get("/smart-folders", async (c) => {
    return c.json(await adapter.listSmartFolders());
  });

  app.get("/smart-folders/counts", async (c) => c.json(await countFolders(adapter)));

  app.post("/smart-folders", async (c) => {
    const {
      id = `sf-${crypto.randomUUID()}`,
      position,
      ...data
    } = await readJsonBody(c, smartFolderCreateSchema, writeInvalidMessage("作成内容が不正です"));
    const violation = smartFolderViolation({ id, ...data });
    if (violation) invalidRequest(violation.message);
    const row = await adapter.insertSmartFolder(
      { id, ...data, createdAt: new Date().toISOString() },
      position,
    );
    if (!row) conflict(`すでにあります: ${id}`);
    return c.json(row, 201);
  });

  app.put("/smart-folders/order", async (c) => {
    const data = await readJsonBody(c, smartFolderOrderSchema, "並び順が不正です");
    const rows = await adapter.reorderSmartFolders(data.ids);
    if (!rows) invalidRequest("今ある行を過不足なく指定してください");
    return c.json(rows);
  });

  app.patch("/smart-folders/:id", async (c) => {
    const id = c.req.param("id");
    const patch = await readJsonBody(
      c,
      smartFolderPatchSchema,
      writeInvalidMessage("更新内容が不正です"),
    );
    const result = await adapter.updateSmartFolder(id, patch);
    if (!result) notFoundFolder(id);
    if ("violation" in result) invalidRequest(result.violation.message);
    return c.json(result.row);
  });

  app.delete("/smart-folders/:id", async (c) => {
    const id = c.req.param("id");
    if (id === ALL_SMART_FOLDER_ID) invalidRequest("「すべて」は削除できません");
    if (!(await adapter.deleteSmartFolder(id))) notFoundFolder(id);
    return c.body(null, 204);
  });

  app.get("/smart-folders/:id/works", async (c) => {
    const folder = await requireFolder(adapter, c.req.param("id"));
    // 契約にないキーも検証に渡し、黙って無視せず 400 にする
    const request = parseSmartFolderWorksRequest({
      ...c.req.query(),
      tags: c.req.queries("tags"),
    });
    const { scanRecord: recordKind, scanChange } = request;
    if (scanChange !== undefined && recordKind !== "updated") {
      invalidRequest("scanChange は scanRecord=updated のときだけ指定できます");
    }
    const ids = recordKind ? scanRecord.workIds(recordKind, scanChange) : undefined;
    return c.json(await queryFolderWorks(adapter, folder, request, ids));
  });

  app.get("/smart-folders/:id/groups", async (c) => {
    const folder = await requireFolder(adapter, c.req.param("id"));
    const request = parseSmartFolderGroupsRequest({
      ...c.req.query(),
      tags: c.req.queries("tags"),
    });
    return c.json(await queryFolderGroups(adapter, folder, request));
  });

  return app;
}
