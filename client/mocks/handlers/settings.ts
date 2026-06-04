import { exactPath, readBody, sendJson, sendNoContent } from "../http";
import type { MockHandler } from "./types";

export const handleSettings: MockHandler = async ({ req, res, urlPath, method, state }) => {
  if (method === "GET" && exactPath(urlPath, "/settings")) {
    sendJson(res, {
      rootFolder: state.rootFolder,
      lastScanTime: state.lastScanTime,
    });
    return true;
  }

  if (method === "POST" && exactPath(urlPath, "/settings")) {
    const body = await readBody(req);
    if (typeof body.rootFolder === "string") {
      state.rootFolder = body.rootFolder;
    }
    sendNoContent(res);
    return true;
  }

  return false;
};
