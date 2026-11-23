import assert from "node:assert/strict";
import { test } from "node:test";
import { createTagPrefixMethods } from "../../src/adapters/real/tagPrefixMethods.ts";
import type { UserWorkStateRepository } from "../../src/adapters/real/userWorkStateRepository.ts";
import type { WorkQueryRepository } from "../../src/adapters/real/workQueryRepository.ts";

test("タグ prefix のメソッドは real adapter を起動せず直接生成できる", async () => {
  const user = {
    listTagPrefixes: () => [{ prefix: "genre:", label: "ジャンル", color: null, protected: false }],
  } as unknown as UserWorkStateRepository;

  const methods = createTagPrefixMethods({
    query: {} as unknown as WorkQueryRepository,
    user,
  });

  assert.deepStrictEqual(await methods.listTagPrefixes(), [
    { prefix: "genre:", label: "ジャンル", color: null, protected: false },
  ]);
});
