// fixture アダプタ用の自己完結シードデータ。
// client/mocks からは import せず、本ファイル内で完結させる。
import { coverFieldsFromColumns, emptyDlsiteState, normalizeTags } from "@mimimilli/shared";
import type { Cover, SmartFolder, WorkSummary } from "@mimimilli/shared";

/** fixture 内部のカバー列（real の cover_image / cover_width / cover_height に相当） */
export interface FixtureCoverColumns {
  image: string | null;
  dimensions: { width: number; height: number } | null;
}

/** シード作品のカバー列。表示用 cover とは別に保持し unmeasured 等を表現する */
export const SEED_COVER_COLUMNS: Partial<Record<string, FixtureCoverColumns>> = {
  RJ501003: { image: "cover.jpg", dimensions: null },
};

/** WorkSummary の cover からカバー列を導出する（契約テスト用 works 差し替え向け） */
export function fixtureCoverColumnsForWork(
  work: Pick<WorkSummary, "id" | "cover">,
): FixtureCoverColumns {
  const explicit = SEED_COVER_COLUMNS[work.id];
  if (explicit) return explicit;
  if (work.cover === null) return { image: null, dimensions: null };
  return { image: work.cover.image, dimensions: work.cover.dimensions };
}

/** カバー列から一覧・表示用 cover を投影する */
export function fixtureCoverFromColumns(columns: FixtureCoverColumns): Cover {
  return coverFieldsFromColumns(
    columns.image,
    columns.dimensions?.width ?? null,
    columns.dimensions?.height ?? null,
  ).cover;
}

/** シードとなる作品データ（約10件）。
 *  - サークル/cv/シリーズ/カテゴリの annotated タグとフラットタグを混在させる
 *  - 再生時間は30分〜5時間でばらつかせる
 *  - status "missing" を1件、"error"（errorMessage付き）を1件含める
 *  - bookmarked / lastPlayedAt の有無を混在させる
 *  - trackCount は1〜20の範囲でばらつかせる
 */
const RAW_SEED_WORKS: Array<Omit<WorkSummary, "dlsite" | "tags"> & { tags: string[] }> = [
  {
    id: "RJ501001",
    title: "【ASMR】夜更けの図書室で囁き朗読",
    cover: { image: "cover.jpg", dimensions: { width: 800, height: 1200 } },
    status: "ok",
    physicalPath: "/library/dlsite/夜想曲スタジオ/RJ501001_夜更けの図書室で囁き朗読",
    totalDurationSec: 5400, // 1時間30分
    addedAt: "2025-04-12T09:00:00.000Z",
    errorMessage: null,
    urls: [
      { label: "DLsite", url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501001.html" },
    ],
    tags: [
      "サークル/夜想曲スタジオ",
      "cv/水瀬なずな",
      "シリーズ/図書室シリーズ",
      "カテゴリ/ASMR",
      "囁き",
      "朗読",
      "癒し系",
    ],
    trackCount: 6,
    bookmarked: true,
    lastPlayedAt: "2026-06-01T21:00:00.000Z",
  },
  {
    id: "RJ501002",
    title: "添い寝カフェへようこそ ~深夜のまったりトーク~",
    cover: { image: "cover.jpg", dimensions: { width: 1200, height: 800 } },
    status: "ok",
    physicalPath: "/library/dlsite/夜想曲スタジオ/RJ501002_添い寝カフェへようこそ",
    totalDurationSec: 9000, // 2時間30分
    addedAt: "2025-05-20T10:30:00.000Z",
    errorMessage: null,
    urls: [
      { label: "DLsite", url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501002.html" },
    ],
    tags: [
      "サークル/夜想曲スタジオ",
      "cv/霧島レイ",
      "シリーズ/添い寝カフェ",
      "カテゴリ/ASMR",
      "添い寝",
      "日常系",
    ],
    trackCount: 4,
    bookmarked: true,
    lastPlayedAt: "2026-05-28T22:15:00.000Z",
  },
  {
    id: "RJ501003",
    title: "【シチュエーションボイス】幼馴染と過ごす雨の日",
    cover: null,
    status: "ok",
    physicalPath: "/library/dlsite/月白製作所/RJ501003_幼馴染と過ごす雨の日",
    totalDurationSec: 1800, // 30分
    addedAt: "2025-06-03T08:00:00.000Z",
    errorMessage: null,
    urls: [
      { label: "DLsite", url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501003.html" },
    ],
    tags: [
      "サークル/月白製作所",
      "cv/天音かなで",
      "カテゴリ/シチュエーションボイス",
      "幼馴染",
      "日常系",
    ],
    trackCount: 3,
    bookmarked: false,
    lastPlayedAt: null,
  },
  {
    id: "RJ501004",
    title: "【催眠】意識がとろける誘導ボイス ~深層への扉~",
    cover: { image: "cover.jpg", dimensions: { width: 900, height: 900 } },
    status: "ok",
    physicalPath: "/library/dlsite/月白製作所/RJ501004_意識がとろける誘導ボイス",
    totalDurationSec: 7200, // 2時間
    addedAt: "2024-09-15T12:00:00.000Z",
    errorMessage: null,
    urls: [
      { label: "DLsite", url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501004.html" },
    ],
    tags: [
      "サークル/月白製作所",
      "cv/霧島レイ",
      "シリーズ/誘導ボイスシリーズ",
      "カテゴリ/催眠",
      "バイノーラル",
      "誘導",
    ],
    trackCount: 5,
    bookmarked: false,
    lastPlayedAt: "2025-12-20T23:00:00.000Z",
  },
  {
    id: "RJ501005",
    title: "耳かき専門店「みみより」開店しました",
    cover: { image: "cover.jpg", dimensions: { width: 750, height: 1000 } },
    status: "ok",
    physicalPath: "/library/dlsite/夜想曲スタジオ/RJ501005_耳かき専門店みみより",
    totalDurationSec: 10800, // 3時間
    addedAt: "2024-11-02T07:30:00.000Z",
    errorMessage: null,
    urls: [
      { label: "DLsite", url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501005.html" },
    ],
    tags: [
      "サークル/夜想曲スタジオ",
      "cv/水瀬なずな",
      "カテゴリ/ASMR",
      "耳かき",
      "マッサージ",
      "癒し系",
      "ソロ",
    ],
    trackCount: 8,
    bookmarked: true,
    lastPlayedAt: "2026-03-11T19:45:00.000Z",
  },
  {
    id: "RJ501006",
    title: "【長編フルボイス】辺境の魔法使いと旅する日々",
    cover: null,
    status: "ok",
    physicalPath: "/library/dlsite/月白製作所/RJ501006_辺境の魔法使いと旅する日々",
    totalDurationSec: 18000, // 5時間
    addedAt: "2024-07-19T11:00:00.000Z",
    errorMessage: null,
    urls: [
      { label: "DLsite", url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501006.html" },
    ],
    tags: [
      "サークル/月白製作所",
      "cv/天音かなで",
      "cv/霧島レイ",
      "シリーズ/辺境の魔法使いシリーズ",
      "カテゴリ/ドラマ",
      "フルボイス",
      "ファンタジー",
      "長編",
    ],
    trackCount: 20,
    bookmarked: false,
    lastPlayedAt: "2025-08-05T20:00:00.000Z",
  },
  {
    id: "RJ501007",
    title: "【睡眠導入】環境音と読み聞かせ ~小雨の降る夜に~",
    cover: null,
    status: "ok",
    physicalPath: "/library/dlsite/_その他/RJ501007_環境音と読み聞かせ",
    totalDurationSec: 14400, // 4時間
    addedAt: "2023-12-08T06:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: ["カテゴリ/環境音", "睡眠用", "読み聞かせ", "BGM", "雨音"],
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: "2025-02-14T05:30:00.000Z",
  },
  {
    id: "RJ501008",
    title: "ツンデレ後輩との放課後トレーニング【ボイスドラマ】",
    cover: { image: "cover.jpg", dimensions: { width: 1000, height: 1000 } },
    status: "ok",
    physicalPath: "/library/dlsite/月白製作所/RJ501008_ツンデレ後輩との放課後トレーニング",
    totalDurationSec: 3600, // 1時間
    addedAt: "2026-05-25T13:00:00.000Z",
    errorMessage: null,
    urls: [
      { label: "DLsite", url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501008.html" },
    ],
    tags: [
      "サークル/月白製作所",
      "cv/天音かなで",
      "カテゴリ/シチュエーションボイス",
      "ツンデレ",
      "後輩",
      "スポーツ",
    ],
    trackCount: 2,
    bookmarked: false,
    lastPlayedAt: null,
  },
  {
    id: "RJ501009",
    title: "メタデータ生成エラー作品（音声ファイル破損）",
    cover: null,
    status: "error",
    physicalPath: "/library/dlsite/_その他/RJ501009_破損ファイル",
    totalDurationSec: 0,
    addedAt: "2025-03-01T00:00:00.000Z",
    errorMessage: "メタデータの生成に失敗しました: 音声ファイルのヘッダーが読み取れません",
    urls: [],
    tags: [],
    trackCount: 0,
    bookmarked: false,
    lastPlayedAt: null,
  },
  {
    id: "RJ501010",
    title: "お気に入りだった朗読劇（フォルダー移動済み）",
    cover: null,
    status: "missing",
    physicalPath: "/library/dlsite/夜想曲スタジオ/RJ501010_朗読劇",
    totalDurationSec: 6300, // 1時間45分
    addedAt: "2023-05-30T15:00:00.000Z",
    errorMessage: null,
    urls: [
      { label: "DLsite", url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501010.html" },
    ],
    tags: ["サークル/夜想曲スタジオ", "cv/水瀬なずな", "カテゴリ/ドラマ", "朗読", "癒し系"],
    trackCount: 4,
    bookmarked: true,
    lastPlayedAt: "2024-10-10T18:00:00.000Z",
  },
  {
    id: "RJ501011",
    title: "【新作】ツンデレ後輩ちゃんの秘密のお世話ボイス",
    cover: { image: "cover.jpg", dimensions: { width: 850, height: 1100 } },
    status: "ok",
    physicalPath: "/library/dlsite/月白製作所/RJ501011_ツンデレ後輩の秘密のお世話ボイス",
    totalDurationSec: 2100, // 35分
    addedAt: "2026-06-12T00:00:00.000Z",
    errorMessage: null,
    urls: [
      { label: "DLsite", url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501011.html" },
    ],
    tags: [
      "サークル/月白製作所",
      "cv/霧島レイ",
      "カテゴリ/シチュエーションボイス",
      "ツンデレ",
      "後輩",
    ],
    trackCount: 4,
    bookmarked: false,
    lastPlayedAt: null,
  },
];

export const SEED_WORKS: WorkSummary[] = RAW_SEED_WORKS.map((work, index) => {
  const columns = fixtureCoverColumnsForWork(work);
  const cover = fixtureCoverFromColumns(columns);
  const tags = normalizeTags(work.tags);
  return {
    ...work,
    tags,
    cover,
    dlsite:
      index === 0
        ? {
            rjCode: work.id,
            status: "applied",
            lastAttemptAt: "2026-06-10T12:00:00.000Z",
            error: null,
            errorKind: null,
            appliedTags: tags.filter((tag) => /^(?:cv|genre|サークル)\//.test(tag)),
          }
        : index === 2
          ? {
              ...emptyDlsiteState(),
              rjCode: work.id,
              status: "not_found",
              error: "作品が見つかりません",
            }
          : index === 6
            ? { ...emptyDlsiteState(), rjCode: work.id, status: "skipped" }
            : { ...emptyDlsiteState(), rjCode: /^RJ\d+$/i.test(work.id) ? work.id : null },
  };
});

/** 各作品のトラック名（収録曲名）。trackCount に満たない分は呼び出し側で `Track N` を補う */
export const SEED_TRACK_NAMES: Record<string, string[]> = {
  RJ501001: [
    "開館のごあいさつ",
    "書架の間で",
    "古い本の読み聞かせ",
    "閲覧席での囁き",
    "閉館前のひととき",
    "おやすみのページ",
  ],
  RJ501002: ["いらっしゃいませ", "ホットミルクと雑談", "添い寝タイム", "おやすみなさい"],
  RJ501003: ["雨宿りの約束", "傘の中の会話", "おかえりなさい"],
  RJ501004: ["導入：深呼吸", "螺旋階段を降りて", "深層への扉", "浮遊感の中で", "覚醒：穏やかな朝"],
  RJ501005: [
    "開店のごあいさつ",
    "カウンセリング",
    "右耳の施術",
    "左耳の施術",
    "マッサージタイム",
    "休憩のお茶",
    "仕上げ",
    "またのご来店を",
  ],
  RJ501007: ["小雨の夜の読み聞かせ"],
  RJ501008: ["走り込み開始", "クールダウン"],
  RJ501010: ["第一幕", "第二幕", "第三幕", "終幕"],
  RJ501011: ["ツンな日常", "デレの瞬間", "お世話の時間", "おやすみの言葉（照れ気味）"],
};

/** シードのトラック仕様（TASK-92）。指定された作品だけ明示的なplaylists/start/end/durationSecを持ち、
 *  未指定の作品は buildFullWork が trackCount からファイル全体トラックを自動生成する（従来通り）。 */
export interface SeedTrackSpec {
  title: string;
  file: string;
  start?: number;
  end?: number;
  /** 解決済みdurationSec。fixtureには実ファイルが無いため直接指定する（null=計測不能を模す） */
  durationSec: number | null;
}

export interface SeedPlaylistSpec {
  name: string;
  tracks: SeedTrackSpec[];
}

/** end-start / end有start無 / start有end無 / 両無 / 同一ファイル複数区間 / デフォルト外playlist
 *  の組み合わせを1作品(RJ501001)でカバーする。1つ目のプレイリストがデフォルト。 */
export const SEED_PLAYLIST_SPECS: Record<string, SeedPlaylistSpec[]> = {
  RJ501001: [
    {
      name: "default",
      tracks: [
        // end有 start無（ファイル先頭からの一区間）
        { title: "開館のごあいさつ", file: "track01.mp3", end: 200, durationSec: 200 },
        // start有 end有（同一ファイルtrack01.mp3の後続区間 = 同一ファイル複数区間）
        { title: "書架の間で", file: "track01.mp3", start: 200, end: 900, durationSec: 700 },
        // start有 end無（ファイル末尾までを既知のファイル全体長から解決）
        { title: "古い本の読み聞かせ", file: "track02.mp3", start: 30, durationSec: 270 },
        // start無 end無（ファイル全体、既知）
        { title: "閲覧席での囁き", file: "track03.mp3", durationSec: 300 },
        // start無 end無（計測不能=未知を模す）
        { title: "閉館前のひととき", file: "track04.mp3", durationSec: null },
        // start有 end無（計測不能=未知を模す）
        { title: "おやすみのページ", file: "track05.mp3", start: 60, durationSec: null },
      ],
    },
    {
      // デフォルト外playlist。全playlistがprobe対象であることのfixtureカバレッジ用
      name: "chill mix",
      tracks: [{ title: "Lo-fi Loop", file: "track01.mp3", end: 60, durationSec: 60 }],
    },
  ],
};

// ── /fs 用のインメモリディレクトリツリー ──────────────────────
//   root(/library) / dlsite / サークル別 / 作品フォルダー構成。
//   作品フォルダーには workId を付与し、配下のファイルには workRelPath を付与する。

export interface FsNode {
  name: string;
  isDir: boolean;
  size: number;
  fileType: string;
  /** dir が登録作品ルート、または file が作品配下のとき所属作品 ID */
  workId: string | null;
  /** file のとき所属作品からの相対パス */
  workRelPath: string | null;
  children: FsNode[];
}

const fsFile = (name: string, fileType: string, size: number): FsNode => ({
  name,
  isDir: false,
  size,
  fileType,
  workId: null,
  workRelPath: null,
  children: [],
});

const fsDir = (name: string, children: FsNode[]): FsNode => ({
  name,
  isDir: true,
  size: 0,
  fileType: "dir",
  workId: null,
  workRelPath: null,
  children,
});

/** 作品配下のファイルツリーを構築する（GET /works/:id/files でも /fs でも使う）。
 *  coverImage は表示用 cover が null（unmeasured）でもファイル実体がある場合に指定する。 */
export function buildWorkFileTree(work: WorkSummary, coverImage: string | null): FsNode[] {
  const children: FsNode[] = [];

  if (coverImage) {
    children.push(fsFile(coverImage, "image", 420 * 1024));
  }

  for (let i = 0; i < work.trackCount; i++) {
    const n = String(i + 1).padStart(2, "0");
    children.push(fsFile(`track${n}.mp3`, "audio", 1024 * 1024 * (6 + (i % 5))));
  }

  if (work.trackCount > 0) {
    children.push(
      fsDir("特典", [
        fsFile("台本.pdf", "pdf", 640 * 1024),
        fsFile("あとがき.txt", "text", 3 * 1024),
      ]),
    );
  }

  return children;
}

/** 作品フォルダーノードを構築する（workId 付き dir。配下は buildWorkFileTree を相対パス付きで展開） */
function fsWorkFolder(work: WorkSummary, coverImage: string | null): FsNode {
  const folderName = work.physicalPath.split("/").filter(Boolean).pop() ?? work.id;

  function annotate(nodes: FsNode[]): FsNode[] {
    return nodes.map(
      (n): FsNode =>
        n.isDir
          ? { ...n, children: annotate(n.children) }
          : { ...n, workId: work.id, workRelPath: n.name },
    );
  }

  return {
    name: folderName,
    isDir: true,
    size: 0,
    fileType: "dir",
    workId: work.id,
    workRelPath: null,
    children: annotate(buildWorkFileTree(work, coverImage)),
  };
}

/** /fs のルートツリーを構築する。works はその時点の最新状態を渡す */
export function buildFsRoot(
  works: WorkSummary[],
  coverColumns: ReadonlyMap<string, FixtureCoverColumns>,
): FsNode {
  const byCircle = new Map<string, WorkSummary[]>();
  for (const work of works) {
    const circleTag = work.tags.find((t) => t.startsWith("サークル/"));
    const circle = circleTag ? circleTag.slice("サークル/".length) : "_その他";
    const list = byCircle.get(circle) ?? [];
    list.push(work);
    byCircle.set(circle, list);
  }

  const circleDirs: FsNode[] = [...byCircle.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ja"))
    .map(([circle, circleWorks]) =>
      fsDir(
        circle,
        circleWorks.map((w) =>
          fsWorkFolder(w, coverColumns.get(w.id)?.image ?? fixtureCoverColumnsForWork(w).image),
        ),
      ),
    );

  return fsDir("library", [fsDir("dlsite", circleDirs), fsFile("readme.txt", "text", 512)]);
}

/** スマートフォルダーのシード（2件） */
export function createSeedSmartFolders(now: string): SmartFolder[] {
  return [
    {
      id: "sf-1",
      name: "長時間 ASMR",
      rules: [
        { conjunction: "WHERE", field: "長さ", operator: "≥", values: ["3600"] },
        {
          conjunction: "AND",
          field: "タグ",
          operator: "∋",
          values: normalizeTags(["カテゴリ/ASMR", "環境音"]),
        },
      ],
      sort: "added-desc",
      createdAt: now,
    },
    {
      id: "sf-2",
      name: "水瀬なずな 全件",
      rules: [
        {
          conjunction: "WHERE",
          field: "タグ",
          operator: "∋",
          values: normalizeTags(["cv/水瀬なずな"]),
        },
      ],
      sort: "added-desc",
      createdAt: now,
    },
  ];
}
