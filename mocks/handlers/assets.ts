import { sendNotFound } from "../http";
import type { MockHandler } from "./types";

export const handleAssets: MockHandler = ({ res, urlPath, method }) => {
  if (method === "GET" && (urlPath.startsWith("/audio/") || urlPath.startsWith("/files/"))) {
    sendNotFound(res);
    return true;
  }

  return false;
};
