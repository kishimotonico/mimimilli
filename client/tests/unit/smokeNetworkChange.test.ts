import { describe, expect, it } from "vitest";
import {
  appendNetworkChangeNotice,
  isNetworkChangeText,
  NETWORK_CHANGE_NOTICE,
} from "../smoke/networkChange";

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

describe("appendNetworkChangeNotice", () => {
  it("既存のエラーを残したまま注記を末尾に足す", () => {
    const errors = [{ message: "expect failed" }];
    appendNetworkChangeNotice(errors);
    expect(errors).toEqual([{ message: "expect failed" }, { message: NETWORK_CHANGE_NOTICE }]);
  });
});
