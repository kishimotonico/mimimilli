import { exactPath, sendJson } from "../http";
import type { MockHandler } from "./types";

export const handleScan: MockHandler = ({ res, urlPath, method, state }) => {
  if (method !== "POST" || !exactPath(urlPath, "/scan")) {
    return false;
  }

  state.lastScanTime = new Date().toISOString();
  sendJson(res, {
    registered: state.works.length,
    newlyGenerated: state.scanNewWorkIds.length,
    errors: state.works.filter((w) => w.status === "error").length,
    missing: state.works.filter((w) => w.status === "missing").length,
    newWorkIds: state.scanNewWorkIds,
  });
  return true;
};
