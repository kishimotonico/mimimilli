// スマートフォルダーの行の不変条件（ADR-0040）。shared の smartFolderViolation を縛る。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALL_SMART_FOLDER_ID,
  definitionOf,
  EMPTY_CONDITION,
  findSmartFolderTemplate,
  smartFolderViolation,
  type Condition,
  type SmartFolderViolation,
} from "@mimimilli/shared";
import { and, or } from "./helpers/conditionTree.ts";

const base = {
  id: "sf-x",
  name: "x",
  condition: EMPTY_CONDITION,
  sort: null,
  groupBy: null,
  groupSort: null,
};
const all = {
  ...definitionOf(findSmartFolderTemplate(ALL_SMART_FOLDER_ID)!),
  id: ALL_SMART_FOLDER_ID,
};

const fieldOf = (violation: SmartFolderViolation | null) => violation?.field ?? null;

test("グループ分けと値の並びは、どちらも持つか、どちらも持たない", () => {
  const grouped = { groupBy: { kind: "tag" } as const, groupSort: "count-desc" as const };
  assert.equal(smartFolderViolation(base), null);
  assert.equal(smartFolderViolation({ ...base, ...grouped }), null);
  assert.equal(fieldOf(smartFolderViolation({ ...base, groupBy: grouped.groupBy })), "groupSort");
  assert.equal(
    fieldOf(smartFolderViolation({ ...base, groupSort: grouped.groupSort })),
    "groupSort",
  );
});

test("保存できない条件の形は condition の違反になる", () => {
  const bad: Condition[] = [and(or(or())), { type: "bookmarked" }];
  for (const condition of bad) {
    assert.equal(fieldOf(smartFolderViolation({ ...base, condition })), "condition");
  }
});

test("「すべて」の形は、名前・空の条件・グループ分けなし・並びあり", () => {
  assert.equal(smartFolderViolation(all), null);
  assert.equal(fieldOf(smartFolderViolation({ ...all, name: "全部" })), "name");
  assert.equal(fieldOf(smartFolderViolation({ ...all, sort: null })), "sort");
  assert.equal(
    fieldOf(smartFolderViolation({ ...all, condition: and({ type: "hasError" }) })),
    "condition",
  );
  assert.equal(
    fieldOf(smartFolderViolation({ ...all, groupBy: { kind: "tag" }, groupSort: "count-desc" })),
    "groupBy",
  );
});
