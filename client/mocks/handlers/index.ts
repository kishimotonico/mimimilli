import { handleAssets } from "./assets";
import { handleLibrary } from "./library";
import { handleScan } from "./scan";
import { handleSettings } from "./settings";
import type { MockHandler } from "./types";
import { handleWorks } from "./works";

export const mockHandlers: MockHandler[] = [
  handleSettings,
  handleScan,
  handleLibrary,
  handleWorks,
  handleAssets,
];
