// HTTP routeテストを fixture と real の両 adapter で同じ期待値に通すためのハーネス。
// 同一の論理ライブラリ（作品・タグ・候補フォルダー）を、fixture はシード、real は一時ディレクトリの
// 実ファイル＋scanで用意し、createApp を通した HTTP レスポンスだけを検証する。
import { test, after } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { emptyMetaDlsiteState, META_FILE_NAME, type MetaFile } from "@mimimilli/shared";
import type { DataAdapter } from "../../src/adapter/index.ts";
import { createApp } from "./testApp.ts";
import {
  createFixtureAdapter,
  type FixtureAdapterOptions,
  type FixtureSeedWork,
} from "../../src/adapters/fixture/index.ts";
import { writeMetaFile } from "../../src/adapters/real/meta.ts";
import { configureRoot } from "./rootFolder.ts";
import { nts } from "./tag.ts";
import { createTestRealAdapter } from "./realAdapter.ts";
import { makeTestDirectory, writeWav } from "./sampleLibrary.ts";

export type AdapterKind = "fixture" | "real";
export const ADAPTER_KINDS: readonly AdapterKind[] = ["fixture", "real"];

export interface ContractWork {
  key: string;
  title?: string;
  tags?: string[];
}

export interface ContractLibrary {
  works: ContractWork[];
  /** root直下に置く未登録の候補フォルダー（音声ファイルを含む）。realで実フォルダーになる */
  candidateFolders?: Array<{ path: string; audioFiles: string[] }>;
  /** fixture側の追加オプション（シナリオ等）。worksは指定できない */
  fixture?: Omit<FixtureAdapterOptions, "works">;
}

export interface ContractHarness {
  kind: AdapterKind;
  adapter: DataAdapter;
  app: ReturnType<typeof createApp>;
  workId(key: string): string;
  request(path: string, init?: RequestInit): Promise<Response>;
  json<T = any>(path: string, init?: RequestInit): Promise<{ status: number; body: T }>;
  send<T = any>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }>;
}

const SEED_ADDED_AT = new Date().toISOString();

/** keyから決まる、real/fixtureで共通の作品ID（UUID形式） */
export function contractWorkId(key: string): string {
  const hex = Buffer.from(key).toString("hex").padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8000-${hex}`;
}

function fixtureSeedWork(work: ContractWork): FixtureSeedWork {
  return {
    id: contractWorkId(work.key),
    title: work.title ?? work.key,
    cover: null,
    status: "ok",
    physicalPath: `/library/${work.key}`,
    metaPath: `/library/${work.key}/${META_FILE_NAME}`,
    totalDurationSec: 1,
    addedAt: SEED_ADDED_AT,
    errorMessage: null,
    urls: [],
    tags: nts(work.tags ?? []),
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: {
      ...emptyMetaDlsiteState(),
      lastAttemptAt: null,
      error: null,
      errorKind: null,
    },
  };
}

function writeRealWork(root: string, work: ContractWork): void {
  const trackId = crypto.randomUUID();
  const playlistId = crypto.randomUUID();
  const file = "track.wav";
  const directory = join(root, work.key);
  mkdirSync(directory, { recursive: true });
  writeWav(join(directory, file), 1);
  const meta: MetaFile = {
    formatVersion: 1,
    id: contractWorkId(work.key),
    title: work.title ?? work.key,
    urls: [],
    tags: nts(work.tags ?? []),
    coverImage: null,
    playlists: [
      {
        id: playlistId,
        name: "default",
        tracks: [{ id: trackId, title: file, file }],
      },
    ],
    defaultPlaylistId: playlistId,
    dlsite: emptyMetaDlsiteState(),
  };
  writeMetaFile(join(directory, META_FILE_NAME), meta);
}

function wrap(
  kind: AdapterKind,
  adapter: DataAdapter,
  app: ReturnType<typeof createApp>,
): ContractHarness {
  const request = async (path: string, init?: RequestInit) => app.request(path, init);
  const json = async (path: string, init?: RequestInit) => {
    const res = await request(path, init);
    const text = await res.text();
    return {
      status: res.status,
      body: text === "" ? undefined : JSON.parse(text),
    };
  };
  return {
    kind,
    adapter,
    app,
    workId: contractWorkId,
    request,
    json,
    send: (method, path, body) =>
      json(path, {
        method,
        ...(body === undefined
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
      }),
  };
}

interface BuiltHarness {
  harness: ContractHarness;
  dispose(): Promise<void>;
}

async function build(kind: AdapterKind, library: ContractLibrary): Promise<BuiltHarness> {
  if (kind === "fixture") {
    const adapter = createFixtureAdapter({
      ...library.fixture,
      works: library.works.map(fixtureSeedWork),
    });
    const app = createApp(adapter);
    return { harness: wrap(kind, adapter, app), dispose: () => app.shutdown() };
  }

  const directory = makeTestDirectory("contract");
  const root = join(directory.path, "library");
  mkdirSync(root, { recursive: true });
  for (const work of library.works) writeRealWork(root, work);
  for (const folder of library.candidateFolders ?? []) {
    const dir = join(root, folder.path);
    mkdirSync(dir, { recursive: true });
    for (const file of folder.audioFiles) writeFileSync(join(dir, file), Buffer.alloc(16));
  }
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan();
  const app = createApp(adapter);
  return {
    harness: wrap(kind, adapter, app),
    dispose: async () => {
      await app.shutdown();
      directory.cleanup();
    },
  };
}

export interface ContractOptions {
  kinds?: readonly AdapterKind[];
  /** true なら全ケースで1つのハーネスを共有する。作品を変更せず、ケース間で干渉しない操作（専用スマートフォルダーの作成など）だけを行うケース用。既定はケースごとに作り直す */
  shared?: boolean;
}

/**
 * ライブラリ定義から、両adapter向けのテスト登録関数を返す。
 * `contract(name, run)` は `name (fixture)` / `name (real)` の2テストを登録する。
 */
export function defineContract(library: ContractLibrary, defaults: ContractOptions = {}) {
  const sharedBuilt = new Map<AdapterKind, Promise<BuiltHarness>>();
  after(async () => {
    for (const built of sharedBuilt.values()) await (await built).dispose();
  });

  return function contract(
    name: string,
    run: (harness: ContractHarness) => Promise<void>,
    options: ContractOptions = {},
  ): void {
    const { kinds = ADAPTER_KINDS, shared = false } = {
      ...defaults,
      ...options,
    };
    for (const kind of kinds) {
      test(`${name} (${kind})`, async () => {
        if (shared) {
          let built = sharedBuilt.get(kind);
          if (!built) {
            built = build(kind, library);
            sharedBuilt.set(kind, built);
          }
          await run((await built).harness);
          return;
        }
        const built = await build(kind, library);
        try {
          await run(built.harness);
        } finally {
          await built.dispose();
        }
      });
    }
  };
}

/** key `${prefix}-0000` 形式の作品を count 件作る */
export function numberedWorks(count: number, tags: string[] = []): ContractWork[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `work-${String(index).padStart(4, "0")}`,
    title: `作品 work-${String(index).padStart(4, "0")}`,
    tags,
  }));
}
