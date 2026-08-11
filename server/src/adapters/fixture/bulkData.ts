// 大量件数シナリオ（"large"）用の作品データ生成。
// 実ライブラリ規模（数百〜数千件）でのページング・ファセット・仮想スクロールを
// 手元で確認するために、決定的な擬似乱数で作品を組み立てる。
import { dedupeTags, normalizeTags } from "@mimimilli/shared";
import type { DlsiteState, WorkSummary } from "@mimimilli/shared";
import { fixtureCoverColumnsForWork, fixtureCoverFromColumns } from "./data.ts";

/** 決定的な擬似乱数（mulberry32）。同じシードなら常に同じライブラリになる */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CIRCLES = [
  "夜想曲スタジオ",
  "月白製作所",
  "silent bell",
  "こもれびレコード",
  "ゆびさきラボ",
  "アトリエ・ノクターン",
  "眠りの箱庭",
  "スタジオ蒼音",
  "みみなり工房",
  "Lunar Whisper",
  "ひだまり音響",
  "深海クロニクル",
  "紙ヒコーキ社",
  "夢語り堂",
  "リフレインworks",
  "ねむり亭",
  "cotton voice",
  "白詰草ソフト",
];

const CVS = [
  "水瀬なずな",
  "霧島レイ",
  "天音かなで",
  "小春ひより",
  "槙原あまね",
  "白瀬みくり",
  "藤白すず",
  "七海るり",
  "如月このは",
  "夜長ひかる",
  "篠宮あおい",
  "御影さくら",
  "東雲みなも",
  "柚木ののか",
  "秋月しずく",
  "神無月ゆう",
];

const SERIES = [
  "図書室シリーズ",
  "添い寝カフェ",
  "誘導ボイスシリーズ",
  "辺境の魔法使いシリーズ",
  "深夜ラジオ編",
  "湯けむり紀行",
  "眠れぬ夜のために",
  "耳かき四季めぐり",
  "こもれびの午後",
  "星降る丘の物語",
];

const CATEGORIES = [
  "ASMR",
  "シチュエーションボイス",
  "催眠",
  "ドラマ",
  "環境音",
  "バイノーラル",
  "睡眠導入",
];

const FREE_TAGS = [
  "囁き",
  "朗読",
  "癒し系",
  "耳かき",
  "添い寝",
  "マッサージ",
  "日常系",
  "ツンデレ",
  "後輩",
  "先輩",
  "幼馴染",
  "お姉さん",
  "妹",
  "ファンタジー",
  "long",
  "ソロ",
  "掛け合い",
  "雨音",
  "焚き火",
  "波の音",
  "read-aloud",
  "BGM",
  "睡眠用",
  "低音ボイス",
  "甘々",
  "淡々",
  "オホーツク",
  "作業用",
  "実験音響",
  "リラックス",
];

const TITLE_PREFIXES = [
  "【ASMR】",
  "【バイノーラル】",
  "【シチュエーションボイス】",
  "【睡眠導入】",
  "【長編】",
  "【短編】",
  "",
  "",
  "",
];

const TITLE_HEADS = [
  "夜更けの図書室で",
  "静かな喫茶店で",
  "雨上がりの縁側で",
  "真冬の山小屋で",
  "深夜のラジオブースで",
  "海辺のペンションで",
  "古びた洋館で",
  "放課後の音楽室で",
  "満天の星空の下で",
  "湯けむりの宿で",
  "屋根裏部屋で",
  "小さな灯台で",
  "路地裏の古書店で",
  "早朝の駅のホームで",
  "夏祭りの帰り道で",
];

const TITLE_TAILS = [
  "囁き朗読",
  "耳かきしてもらう",
  "まったりトーク",
  "眠りにつくまで",
  "とろける誘導",
  "ふたりの内緒話",
  "そっと甘やかされる",
  "静かに看病される",
  "髪を乾かしてもらう",
  "膝枕のひととき",
  "肩をほぐしてもらう",
  "とりとめのない昔話",
  "羊を数える夜",
  "焚き火を眺める時間",
  "そばで本を読む",
];

/** 配列から決定的に1件選ぶ */
function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

/** 配列から重複なしで n 件選ぶ */
function pickMany<T>(random: () => number, items: readonly T[], count: number): T[] {
  const chosen: T[] = [];
  while (chosen.length < count && chosen.length < items.length) {
    const candidate = pick(random, items);
    if (!chosen.includes(candidate)) chosen.push(candidate);
  }
  return chosen;
}

const START_MS = Date.UTC(2021, 0, 1);
const END_MS = Date.UTC(2026, 5, 1);

function buildDlsiteState(random: () => number, id: string, tags: string[]): DlsiteState {
  const roll = random();
  if (roll < 0.62) {
    return {
      rjCode: id,
      status: "applied",
      lastAttemptAt: new Date(START_MS + random() * (END_MS - START_MS)).toISOString(),
      error: null,
      errorKind: null,
      appliedTags: dedupeTags(normalizeTags(tags.filter((tag) => /^(?:cv|サークル)\//.test(tag)))),
    };
  }
  if (roll < 0.82) {
    return {
      rjCode: id,
      status: "none",
      lastAttemptAt: null,
      error: null,
      errorKind: null,
      appliedTags: [],
    };
  }
  if (roll < 0.88) {
    return {
      rjCode: null,
      status: "none",
      lastAttemptAt: null,
      error: null,
      errorKind: null,
      appliedTags: [],
    };
  }
  if (roll < 0.92) {
    return {
      rjCode: id,
      status: "not_found",
      lastAttemptAt: new Date(END_MS).toISOString(),
      error: "作品が見つかりません",
      errorKind: "not_found",
      appliedTags: [],
    };
  }
  if (roll < 0.95) {
    return {
      rjCode: id,
      status: "error",
      lastAttemptAt: new Date(END_MS).toISOString(),
      error: "DLsiteのHTML構造が想定と異なります",
      errorKind: "parse_error",
      appliedTags: [],
    };
  }
  return {
    rjCode: id,
    status: "skipped",
    lastAttemptAt: null,
    error: null,
    errorKind: null,
    appliedTags: [],
  };
}

/** 大量件数シナリオ用の作品を count 件生成する。
 *  ID は RJ6xxxxx 帯で、手書きシード（RJ5010xx）と衝突しない。 */
export function createBulkWorks(count: number): WorkSummary[] {
  const random = createRandom(20260811);
  const works: WorkSummary[] = [];

  for (let i = 0; i < count; i++) {
    const id = `RJ${600000 + i}`;
    const circle = pick(random, CIRCLES);
    const title = `${pick(random, TITLE_PREFIXES)}${pick(random, TITLE_HEADS)}${pick(random, TITLE_TAILS)}`;

    const tagSource = [
      `サークル/${circle}`,
      ...pickMany(random, CVS, random() < 0.2 ? 2 : 1).map((cv) => `cv/${cv}`),
      ...(random() < 0.35 ? [`シリーズ/${pick(random, SERIES)}`] : []),
      `カテゴリ/${pick(random, CATEGORIES)}`,
      ...pickMany(random, FREE_TAGS, 1 + Math.floor(random() * 5)),
    ];
    const tags = dedupeTags(normalizeTags(tagSource));

    const statusRoll = random();
    const status = statusRoll < 0.02 ? "error" : statusRoll < 0.05 ? "missing" : "ok";

    const trackCount = status === "error" ? 0 : 1 + Math.floor(random() * 20);
    // 未解決トラックを含む作品を模して一部は totalDurationSec = null
    const totalDurationSec =
      status === "error"
        ? 0
        : random() < 0.04
          ? null
          : trackCount * (600 + Math.floor(random() * 900));

    // 未計測カバー（cover列にimageがありdimensionsがnull）は手書きシードRJ501003が担うため、
    // 生成分は「カバーあり（寸法既知）」か「カバーなし」の2択にする
    const coverRoll = random();
    const dimensions =
      coverRoll < 0.5
        ? { width: 800, height: 1200 }
        : coverRoll < 0.8
          ? { width: 1000, height: 1000 }
          : { width: 1200, height: 800 };
    const coverImage = status === "error" || random() < 0.12 ? null : "cover.jpg";

    const addedAt = new Date(START_MS + random() * (END_MS - START_MS)).toISOString();
    const played = random() < 0.45;

    const raw = {
      id,
      title,
      cover: coverImage ? { image: coverImage, dimensions } : null,
      status,
      physicalPath: `/library/dlsite/${circle}/${id}_${pick(random, TITLE_TAILS)}`,
      totalDurationSec,
      addedAt,
      errorMessage:
        status === "error"
          ? "メタデータの生成に失敗しました: 音声ファイルのヘッダーが読み取れません"
          : null,
      urls:
        random() < 0.85
          ? [{ label: "DLsite", url: `https://www.dlsite.com/maniax/work/=/product_id/${id}.html` }]
          : [],
      tags,
      trackCount,
      bookmarked: random() < 0.08,
      lastPlayedAt: played
        ? new Date(Date.parse(addedAt) + random() * (END_MS - Date.parse(addedAt))).toISOString()
        : null,
    } satisfies Omit<WorkSummary, "dlsite">;

    works.push({
      ...raw,
      cover: fixtureCoverFromColumns(fixtureCoverColumnsForWork(raw)),
      dlsite: buildDlsiteState(random, id, tags),
    });
  }

  return works;
}
