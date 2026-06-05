import { handleAssets } from "./assets";
import { handleFs } from "./fs";
import { handleLibrary } from "./library";
import { handleScan } from "./scan";
import { handleSettings } from "./settings";
import type { MockHandler } from "./types";
import { handleWorks } from "./works";

export const mockHandlers: MockHandler[] = [
  handleSettings,
  handleScan,
  handleFs,
  handleLibrary,
  handleWorks,
  handleAssets,
];
