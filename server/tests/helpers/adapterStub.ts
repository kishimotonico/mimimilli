import type { DataAdapter } from "../../src/adapter/index.ts";
import { createFixtureAdapter } from "../../src/adapters/fixture/index.ts";

/** fixture adapter の fetchDlsiteProduct だけを差し替える。ジョブ管理の挙動を通信なしで制御するために使う。 */
export function withFetchDlsiteProduct(
  fetchDlsiteProduct: DataAdapter["fetchDlsiteProduct"],
): DataAdapter {
  return { ...createFixtureAdapter(), fetchDlsiteProduct };
}
