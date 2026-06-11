// テスト・スモーク用のサンプルライブラリ生成。
// 有効な PCM WAV（既知の再生時間）を生成するため、duration プローブの検証にも使える。
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** 指定秒数の有効な 8kHz mono PCM WAV を生成する */
export function writeWav(path: string, seconds: number): void {
  const rate = 8000;
  const n = Math.round(rate * seconds);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.sin(i / 20) * 8000), 44 + i * 2);
  }
  writeFileSync(path, buf);
}

export interface SampleLibrary {
  root: string;
  /** 既存メタを持つ作品の ID */
  existingWorkId: string;
}

/**
 * サンプルライブラリを baseDir に作る（既存があれば作り直す）。
 * - dlsite/RJ900001_テスト作品/  … メタなし（自動生成対象）。mp3/ サブフォルダー + cover.jpg
 * - dlsite/RJ900002_既存メタ/    … .meta.json あり。トラック1本欠損（status: error になる）
 */
export function makeSampleLibrary(baseDir: string): SampleLibrary {
  const root = join(baseDir, "lib");
  rmSync(root, { recursive: true, force: true });

  const work1 = join(root, "dlsite", "RJ900001_テスト作品");
  const work2 = join(root, "dlsite", "RJ900002_既存メタ");
  mkdirSync(join(work1, "mp3"), { recursive: true });
  mkdirSync(work2, { recursive: true });

  writeWav(join(work1, "mp3", "01_intro.wav"), 2);
  writeWav(join(work1, "mp3", "02_main.wav"), 3);
  writeWav(join(work2, "track.wav"), 1);
  writeFileSync(join(work1, "cover.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

  const existingWorkId = "11111111-1111-4111-8111-111111111111";
  writeFileSync(
    join(work2, ".meta.json"),
    JSON.stringify(
      {
        id: existingWorkId,
        title: "既存メタの作品",
        tags: ["cv/水瀬なずな", "サークル/夜想曲", "バイノーラル"],
        playlists: [
          {
            name: "default",
            tracks: [
              { title: "本編", file: "track.wav" },
              { title: "欠損", file: "missing.wav" },
            ],
          },
        ],
        defaultPlaylist: "default",
      },
      null,
      2
    )
  );

  return { root, existingWorkId };
}
