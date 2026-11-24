import { describe, expect, it } from "vitest";
import { isNetworkChangeText } from "../smoke/networkChange";

describe("isNetworkChangeText", () => {
  it("ERR_NETWORK_CHANGED を含む通信失敗を見分ける", () => {
    expect(isNetworkChangeText("Failed to load resource: net::ERR_NETWORK_CHANGED")).toBe(true);
    expect(isNetworkChangeText("net::ERR_NETWORK_CHANGED")).toBe(true);
  });

  it("他の通信失敗は対象にしない", () => {
    expect(isNetworkChangeText("net::ERR_CONNECTION_REFUSED")).toBe(false);
    expect(isNetworkChangeText("")).toBe(false);
  });
});
