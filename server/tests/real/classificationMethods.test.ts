import { expect, test } from "bun:test";
import { createClassificationMethods } from "../../src/adapters/real/classificationMethods.ts";
import type { UserWorkStateRepository } from "../../src/adapters/real/userWorkStateRepository.ts";
import type { WorkQueryRepository } from "../../src/adapters/real/workQueryRepository.ts";

test("分類メソッドは real adapter を起動せず直接生成できる", async () => {
  const user = {
    listTagPrefixes: () => [
      { prefix: "genre:", label: "ジャンル", color: null, showAsAxis: false, protected: false },
    ],
  } as unknown as UserWorkStateRepository;

  const methods = createClassificationMethods({
    query: {} as unknown as WorkQueryRepository,
    user,
  });

  expect(await methods.listTagPrefixes()).toEqual([
    { prefix: "genre:", label: "ジャンル", color: null, showAsAxis: false, protected: false },
  ]);
});
