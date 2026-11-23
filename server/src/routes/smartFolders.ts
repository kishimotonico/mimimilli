// /smart-folders 以下（ADR-0040「HTTP の契約」）。
//   GET    /smart-folders                  一覧（サーバーの順、件数入り）
//   POST   /smart-folders                  作成（sf-<uuid> を採番）
//   PUT    /smart-folders/order            全件の順序を置き換える
//   POST   /smart-folders/from-template    テンプレートの固定 ID で追加
//   POST   /smart-folders/restore          削除した行を同じ ID・位置・作成日時で戻す
//   PUT    /smart-folders/:id              更新
//   PUT    /smart-folders/:id/condition    条件（と、変えるときだけ既定の並び）だけを更新（検索の上書き・取り消し）
//   PUT    /smart-folders/:id/sort         既定の並びだけを更新
//   PUT    /smart-folders/:id/group-sort   値一覧の並びだけを更新
//   DELETE /smart-folders/:id              削除
//   GET    /smart-folders/:id/works        作品一覧（scanRecord でスキャン記録の作品に絞れる）
//   POST   /smart-folders/:id/groups       値一覧・「＋絞り込み」候補
import { Hono } from "hono";
import { z, type ZodError } from "zod";
import {
  conditionViolation,
  deleteViolation,
  findSmartFolderTemplate,
  needsCount,
  groupSortViolation,
  restoreViolation,
  smartFolderFromTemplateSchema,
  smartFolderConditionWriteSchema,
  smartFolderGroupSortWriteSchema,
  smartFolderOrderSchema,
  smartFolderRestoreSchema,
  smartFolderSortWriteSchema,
  smartFolderWriteSchema,
  sortViolation,
  updateViolation,
  type PolicyViolation,
  type SmartFolder,
  type SmartFolderWrite,
} from "@mimimilli/shared";
import type { DataAdapter } from "../adapter/index.ts";
import type { SmartFolderRow } from "../adapter/classification.ts";
import { insertFromTemplate } from "../core/smartFolderTemplateRow.ts";
import { apiError, conflict, invalidRequest, notFound } from "../lib/httpError.ts";
import { readJsonBody } from "../lib/jsonBody.ts";
import type { ScanRecordStore } from "../scanRecord.ts";
import {
  parseSmartFolderGroupsRequest,
  parseSmartFolderWorksRequest,
  queryFolderGroups,
  queryFolderWorks,
} from "./smartFolderQuery.ts";

/** 件数を数えるものを shared の判定関数で選び、1往復で数えて載せる */
async function withCounts(adapter: DataAdapter, rows: SmartFolderRow[]): Promise<SmartFolder[]> {
  const targets = rows.flatMap((row, index) =>
    needsCount(row) ? [{ index, condition: row.condition }] : [],
  );
  const counts =
    targets.length === 0
      ? []
      : await adapter.countByConditions(
          targets.map((target) => target.condition),
          { now: Date.now() },
        );
  const countByIndex = new Map(targets.map((target, i) => [target.index, counts[i]!]));
  return rows.map((row, index) => ({ ...row, count: countByIndex.get(index) ?? null }));
}

async function singleWithCount(adapter: DataAdapter, row: SmartFolderRow): Promise<SmartFolder> {
  const [item] = await withCounts(adapter, [row]);
  return item!;
}

/** 条件の検証エラーは、スキーマが返す文言（保存できない理由）をそのまま返す。それ以外は固定の文言 */
function writeInvalidMessage(fallback: string): (error: ZodError) => string {
  return (error) => error.issues.find((issue) => issue.code === "custom")?.message ?? fallback;
}

function rejectViolation(violation: PolicyViolation | null): void {
  if (violation === null) return;
  if (violation.kind === "forbidden") throw apiError("forbidden", violation.message);
  invalidRequest(violation.message);
}

function notFoundFolder(id: string): never {
  notFound(`スマートフォルダーが見つかりません: ${id}`);
}

async function requireFolder(adapter: DataAdapter, id: string) {
  const row = await adapter.getSmartFolder(id);
  if (!row) notFoundFolder(id);
  return { condition: row.condition, groupBy: row.groupBy };
}

export function smartFoldersRoute(adapter: DataAdapter, scanRecord: ScanRecordStore): Hono {
  const app = new Hono();

  app.get("/smart-folders", async (c) => {
    return c.json(await withCounts(adapter, await adapter.listSmartFolders()));
  });

  app.post("/smart-folders", async (c) => {
    const data = await readJsonBody(
      c,
      smartFolderWriteSchema,
      writeInvalidMessage("スマートフォルダーの作成内容が不正です"),
    );
    const row = await adapter.appendSmartFolder({
      id: `sf-${crypto.randomUUID()}`,
      ...data,
      createdAt: new Date().toISOString(),
    });
    if (!row) conflict("スマートフォルダーの ID が重複しました");
    return c.json(await singleWithCount(adapter, row), 201);
  });

  app.put("/smart-folders/order", async (c) => {
    const data = await readJsonBody(
      c,
      smartFolderOrderSchema,
      "スマートフォルダーの並び順が不正です",
    );
    const rows = await adapter.reorderSmartFolders(data.ids);
    if (!rows) invalidRequest("今あるスマートフォルダーを過不足なく指定してください");
    return c.json(await withCounts(adapter, rows));
  });

  app.post("/smart-folders/from-template", async (c) => {
    const data = await readJsonBody(
      c,
      smartFolderFromTemplateSchema,
      "テンプレートの指定が不正です",
    );
    const template = findSmartFolderTemplate(data.templateId)!;
    const row = await adapter.appendSmartFolder(
      insertFromTemplate(template, new Date().toISOString()),
    );
    if (!row) conflict(`すでにあるスマートフォルダーです: ${template.id}`);
    return c.json(await singleWithCount(adapter, row), 201);
  });

  app.post("/smart-folders/restore", async (c) => {
    const data = await readJsonBody(
      c,
      smartFolderRestoreSchema,
      writeInvalidMessage("復元するスマートフォルダーの内容が不正です"),
    );
    rejectViolation(restoreViolation(data));
    const row = await adapter.restoreSmartFolder(data);
    if (!row) conflict(`すでにあるスマートフォルダーです: ${data.id}`);
    return c.json(await singleWithCount(adapter, row), 201);
  });

  app.put("/smart-folders/:id", async (c) => {
    const id = c.req.param("id");
    const data: SmartFolderWrite = await readJsonBody(
      c,
      smartFolderWriteSchema,
      writeInvalidMessage("スマートフォルダーの更新内容が不正です"),
    );
    const existing = await adapter.getSmartFolder(id);
    if (!existing) notFoundFolder(id);
    rejectViolation(updateViolation(existing, data));
    const row = await adapter.updateSmartFolder(id, data);
    if (!row) notFoundFolder(id);
    return c.json(await singleWithCount(adapter, row));
  });

  app.put("/smart-folders/:id/condition", async (c) => {
    const id = c.req.param("id");
    const data = await readJsonBody(
      c,
      smartFolderConditionWriteSchema,
      writeInvalidMessage("スマートフォルダーの条件が不正です"),
    );
    const existing = await adapter.getSmartFolder(id);
    if (!existing) notFoundFolder(id);
    rejectViolation(conditionViolation(existing));
    const row = await adapter.updateSmartFolderCondition(id, data);
    if (!row) notFoundFolder(id);
    return c.json(await singleWithCount(adapter, row));
  });

  app.put("/smart-folders/:id/sort", async (c) => {
    const id = c.req.param("id");
    const data = await readJsonBody(c, smartFolderSortWriteSchema, "既定の並びが不正です");
    const existing = await adapter.getSmartFolder(id);
    if (!existing) notFoundFolder(id);
    rejectViolation(sortViolation(existing, data.sort));
    const row = await adapter.updateSmartFolderSort(id, data.sort);
    if (!row) notFoundFolder(id);
    return c.json(await singleWithCount(adapter, row));
  });

  app.put("/smart-folders/:id/group-sort", async (c) => {
    const id = c.req.param("id");
    const data = await readJsonBody(c, smartFolderGroupSortWriteSchema, "値一覧の並びが不正です");
    const existing = await adapter.getSmartFolder(id);
    if (!existing) notFoundFolder(id);
    rejectViolation(groupSortViolation(existing));
    const row = await adapter.updateSmartFolderGroupSort(id, data.groupSort);
    if (!row) {
      if (!(await adapter.getSmartFolder(id))) notFoundFolder(id);
      conflict("グループ分けが外されたため、値の並びを保存できません");
    }
    return c.json(await singleWithCount(adapter, row));
  });

  app.delete("/smart-folders/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await adapter.getSmartFolder(id);
    if (!existing) notFoundFolder(id);
    rejectViolation(deleteViolation(existing));
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

  app.post("/smart-folders/:id/groups", async (c) => {
    const folder = await requireFolder(adapter, c.req.param("id"));
    const body = await readJsonBody(c, z.unknown(), "値一覧の要求が不正です");
    return c.json(await queryFolderGroups(adapter, folder, parseSmartFolderGroupsRequest(body)));
  });

  return app;
}
