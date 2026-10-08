import type { DataAdapter } from "../../src/adapter/index.ts";
import { createFixtureAdapter } from "../../src/adapters/fixture/index.ts";

/** fixture adapter の runDlsiteBulk だけを差し替える。ジョブ管理の挙動を fetch なしで制御するために使う。 */
export function withRunDlsiteBulk(runDlsiteBulk: DataAdapter["runDlsiteBulk"]): DataAdapter {
  return { ...createFixtureAdapter(), runDlsiteBulk };
}
