// /api/fs — 物理ファイルシステムのブラウズ（File モード用モック）。
// rootFolder を起点に「わざと未整理」な合成ツリーを構築し、1階層ぶんの listing を返す。
// 作品フォルダー配下のファイルには workId / workRelPath を付与し、既存のメディア配信
// （/api/audio/:id/*path · /api/files/:id/*path）をそのまま再利用できるようにする。

import { buildFileTree, type FileNode } from "../fixtures/fileTree";
import type { WorkSummaryMock } from "../fixtures/index";
import { exactPath, sendJson } from "../http";
import type { MockHandler } from "./types";
import type { MockState } from "../state";

interface PhysNode {
  name: string;
  isDir: boolean;
  size: number;
  fileType: string;
  workId: string | null; // dir: 登録作品ルート / file: 所属作品
  workRelPath: string | null; // file: 所属作品からの相対パス
  children: PhysNode[];
}

const pf = (name: string, fileType: string, size: number): PhysNode => ({
  name, isDir: false, size, fileType, workId: null, workRelPath: null, children: [],
});
const pd = (name: string, children: PhysNode[]): PhysNode => ({
  name, isDir: true, size: 0, fileType: "dir", workId: null, workRelPath: null, children,
});

// buildFileTree（作品相対ツリー）を物理ノードへ変換。
// 中間 dir は workId を付けない（wbadge は作品ルートのみ）。ファイルには workId+相対パスを付ける。
function annotate(nodes: FileNode[], workId: string): PhysNode[] {
  return nodes.map((n) =>
    n.isDir
      ? { name: n.name, isDir: true, size: 0, fileType: "dir", workId: null, workRelPath: null, children: annotate(n.children, workId) }
      : { name: n.name, isDir: false, size: n.size, fileType: n.fileType, workId, workRelPath: n.path, children: [] }
  );
}

// 作品フォルダー（フォルダー名は実物に寄せて生々しく）。配下は buildFileTree を流用。
function pwork(folderName: string, work: WorkSummaryMock | undefined): PhysNode | null {
  if (!work) return null;
  return {
    name: folderName,
    isDir: true,
    size: 0,
    fileType: "dir",
    workId: work.id,
    workRelPath: null,
    children: annotate(buildFileTree(work).children, work.id),
  };
}

function buildPhysRoot(state: MockState): PhysNode {
  const byId = (id: string) => state.works.find((w) => w.id === id);
  const rootName = (state.rootFolder ?? "/mock/library").split("/").filter(Boolean).pop() ?? "library";

  // 整理済み・未整理が入り混じった雑多な構成。深さもバラバラ。
  const children: PhysNode[] = [
    pf(".DS_Store", "other", 6 * 1024),
    pf("readme.txt", "text", 1 * 1024),

    pd("asmr", [
      pf(".DS_Store", "other", 6 * 1024),
      pd("2024", [
        pd("03月", [
          pwork("RJ412801_水瀬なずな_深夜の耳かき屋さん", byId("RJ412801")),
          pwork("RJ398201", byId("RJ398201")),
        ].filter(Boolean) as PhysNode[]),
        pd("04月", [
          pwork("RJ389054", byId("RJ389054")),
        ].filter(Boolean) as PhysNode[]),
        pd("未分類", [
          pwork("RJ378923 - 耳元でこっそり", byId("RJ378923")),
          pd("スクショ", [
            pf("Screenshot 2024-02-14 23.11.05.png", "image", 820 * 1024),
            pf("名称未設定.png", "image", 410 * 1024),
            pf("無題.png", "image", 388 * 1024),
          ]),
          pf("メモ.txt", "text", 900),
        ]),
      ]),
      pd("2023", [
        pwork("RJ334567_環境音コレクション", byId("RJ334567")),
        pd("old", [
          pwork("RJ311234", byId("RJ311234")),
          pf("整理する.txt", "text", 200),
        ].filter(Boolean) as PhysNode[]),
      ]),
    ]),

    pd("_未整理", [
      pwork("RJ445612_水瀬なずな_幼馴染の彼女と過ごす休日【SV】_v2", byId("RJ445612")),
      pwork("RJ460011_ツンデレ後輩_DL版(1)", byId("RJ460011")),
      pd("download", [
        pf("RJ421088.zip", "other", 612 * 1024 * 1024),
        pwork("RJ421088", byId("RJ421088")),
        pd("新しいフォルダー", []),
        pf("cover (1).jpg", "image", 360 * 1024),
        pf("cover (2).jpg", "image", 366 * 1024),
        pf("track01.mp3", "audio", 7 * 1024 * 1024),
      ].filter(Boolean) as PhysNode[]),
      pd("Christmas2024_未編集", [
        pf("mix_v1.wav", "audio", 180 * 1024 * 1024),
        pf("mix_v2.wav", "audio", 184 * 1024 * 1024),
        pf("mix_final_FIX_real.wav", "audio", 188 * 1024 * 1024),
        pf("Thumbs.db", "other", 12 * 1024),
      ]),
    ]),

    pd("ダウンロード", [
      pwork("RJ401237", byId("RJ401237")),
      pd("お姉さんの添い寝ラジオ vol.3 (コピー)", [
        pf("desktop.ini", "other", 300),
      ]),
      pf("~$tmp.docx", "other", 1 * 1024),
    ].filter(Boolean) as PhysNode[]),

    // ルート直下に放り込まれた作品
    pwork("RJ356789", byId("RJ356789")),
    pwork("RJ499999", byId("RJ499999")),

    pd("くずかご", []),
  ].filter(Boolean) as PhysNode[];

  return { name: rootName, isDir: true, size: 0, fileType: "dir", workId: null, workRelPath: null, children };
}

function normalize(p: string): string {
  const trimmed = p.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function resolveDir(root: PhysNode, rootAbs: string, target: string): PhysNode | null {
  if (target === rootAbs) return root;
  if (!target.startsWith(rootAbs + "/")) return null;
  const segments = target.slice(rootAbs.length + 1).split("/").filter(Boolean);
  let cur = root;
  for (const seg of segments) {
    const next = cur.children.find((c) => c.isDir && c.name === seg);
    if (!next) return null;
    cur = next;
  }
  return cur;
}

export const handleFs: MockHandler = ({ res, url, urlPath, method, state }) => {
  if (method !== "GET" || !exactPath(urlPath, "/fs")) return false;

  const rootAbs = normalize(state.rootFolder ?? "/mock/library");
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const rawPath = new URLSearchParams(query).get("path");
  const target = rawPath ? normalize(rawPath) : rootAbs;

  const root = buildPhysRoot(state);
  const dir = resolveDir(root, rootAbs, target);

  const parent = target === rootAbs ? null : target.slice(0, target.lastIndexOf("/")) || rootAbs;

  if (!dir) {
    sendJson(res, { path: target, parent, entries: [] });
    return true;
  }

  const entries = dir.children.map((c) => ({
    name: c.name,
    path: `${target}/${c.name}`,
    isDir: c.isDir,
    size: c.size,
    fileType: c.fileType,
    childCount: c.isDir ? c.children.length : 0,
    workId: c.workId,
    workRelPath: c.workRelPath,
  }));

  sendJson(res, { path: target, parent, entries });
  return true;
};
