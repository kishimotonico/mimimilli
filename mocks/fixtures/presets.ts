import type { SearchPresetMock } from "./types";

export const INITIAL_PRESETS: SearchPresetMock[] = [
  { id: 1, name: "ASMR全般", query: "", tagFilters: ["ASMR"], sortId: "added-desc" },
  { id: 2, name: "水瀬なずな", query: "", tagFilters: ["cv/水瀬なずな"], sortId: "added-desc" },
  { id: 3, name: "催眠・誘導", query: "催眠", tagFilters: [], sortId: "title-asc" },
];
