import assert from "node:assert/strict";
import { test } from "node:test";
import { groupByKey, parseGroupByKey, type GroupBy } from "@mimimilli/shared";

test("groupByKey と parseGroupByKey は往復する", () => {
  const all: GroupBy[] = [
    { kind: "prefix", prefix: "cv" },
    { kind: "prefix", prefix: "サークル" },
    { kind: "prefix", prefix: "a:b" },
    { kind: "tag" },
    { kind: "addedYear" },
  ];
  for (const groupBy of all) assert.deepEqual(parseGroupByKey(groupByKey(groupBy)), groupBy);
});

test("parseGroupByKey は読めない文字列を null にする", () => {
  for (const key of ["", "prefix:", "prefix", "unknown", "tag:x", "Prefix:cv"]) {
    assert.equal(parseGroupByKey(key), null, JSON.stringify(key));
  }
});
