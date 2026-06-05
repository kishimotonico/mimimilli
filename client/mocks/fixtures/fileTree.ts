// 作品フォルダー内のファイルツリー生成（モック）。
// /works/:id/files（作品単位ツリー）と /api/fs（物理FSブラウズ）の両方から再利用する。

import type { WorkSummaryMock } from "./types";

export interface FileNode {
  name: string;
  path: string; // 作品フォルダーからの相対パス
  isDir: boolean;
  size: number;
  fileType: string;
  children: FileNode[];
}

export function fileNode(name: string, path: string, fileType: string, size: number): FileNode {
  return { name, path, isDir: false, size, fileType, children: [] };
}

export function dirNode(name: string, path: string, children: FileNode[]): FileNode {
  return { name, path, isDir: true, size: 0, fileType: "dir", children };
}

// 作品フォルダーにありがちな構成（音声・カバー・特典イラスト・台本・SE 素材）に加え、
// 実フォルダーに紛れがちなゴミ（Thumbs.db / 重複コピー / .bak など）も混ぜる。
export function buildFileTree(work: WorkSummaryMock): FileNode {
  const seed = work.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const children: FileNode[] = [];

  if (work.coverImage) {
    children.push(fileNode("cover.jpg", "cover.jpg", "image", 384 * 1024 + (seed % 200) * 1024));
  }

  for (let i = 0; i < work.trackCount; i++) {
    const n = String(i + 1).padStart(2, "0");
    children.push(fileNode(`track${n}.mp3`, `track${n}.mp3`, "audio", 1024 * 1024 * (6 + (i % 5))));
  }

  // 特典イラスト（2〜4枚）。一部作品は hires/ サブフォルダーを持つ
  const illustCount = (work.trackCount % 3) + 2;
  const illustChildren: FileNode[] = [];
  for (let i = 0; i < illustCount; i++) {
    const n = String(i + 1).padStart(2, "0");
    illustChildren.push(fileNode(`illust_${n}.png`, `illustrations/illust_${n}.png`, "image", (1200 + i * 180) * 1024));
  }
  if (work.trackCount % 2 === 0) {
    const hires = illustChildren.slice(0, 2).map((c) =>
      fileNode(c.name, `illustrations/hires/${c.name}`, "image", c.size * 3)
    );
    illustChildren.push(dirNode("hires", "illustrations/hires", hires));
  }
  children.push(dirNode("illustrations", "illustrations", illustChildren));

  children.push(
    dirNode("特典", "特典", [
      fileNode("台本.pdf", "特典/台本.pdf", "pdf", 820 * 1024),
      fileNode("あとがき.txt", "特典/あとがき.txt", "text", 4 * 1024),
    ])
  );

  if (work.trackCount >= 4) {
    const seChildren = Array.from({ length: 3 }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      return fileNode(`se_${n}.wav`, `SE素材/se_${n}.wav`, "audio", (2400 + i * 600) * 1024);
    });
    children.push(dirNode("SE素材", "SE素材", seChildren));
  }

  children.push(fileNode("info.txt", "info.txt", "text", 2 * 1024 + (seed % 100)));

  // 紛れ込むゴミ（作品ごとに少し変える）
  children.push(fileNode("Thumbs.db", "Thumbs.db", "other", 10 * 1024));
  if (seed % 2 === 0 && work.coverImage) {
    children.push(fileNode("cover (1).jpg", "cover (1).jpg", "image", 360 * 1024));
  }
  if (seed % 3 === 0 && work.trackCount > 0) {
    children.push(fileNode("track01.mp3.bak", "track01.mp3.bak", "other", 6 * 1024 * 1024));
  }

  return dirNode(work.id, "", children);
}
