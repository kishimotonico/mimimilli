import { describe, expect, it } from "vitest";
import { conditionSchema } from "@mimimilli/shared";
import { resolveLibraryView, type WorksView } from "../../src/entities/library/resolveLibraryView";
import {
  createInitialAppRoute,
  type LibraryRoute,
} from "../../src/entities/navigation/model/appRoute";
import {
  isOverwritable,
  overwriteChange,
  overwriteUndoChange,
  saveOffer,
  saveSearchDraft,
  type OverwritableFolder,
} from "../../src/features/library/model/saveSearch";
import { buildSmartFolder, defaultSmartFolders } from "../helpers/smartFolders";
import { nts } from "../helpers/tag";

const own = buildSmartFolder({
  id: "sf-own",
  name: "自作",
  condition: { type: "and", children: [{ type: "tag", tag: "asmr" }] },
  sort: "title-asc",
});
const ownGrouped = buildSmartFolder({
  id: "sf-grouped",
  name: "自作グループ",
  condition: { type: "and", children: [{ type: "bookmarked" }] },
  groupBy: { kind: "prefix", prefix: "cv" },
});
const folders = [...defaultSmartFolders(), own, ownGrouped];

function view(patch: Partial<LibraryRoute>) {
  const route = { ...createInitialAppRoute().library, seed: 1, ...patch };
  return resolveLibraryView(route, folders);
}
function works(patch: Partial<LibraryRoute>): WorksView {
  const v = view(patch);
  if (v.kind !== "works") throw new Error("works ではありません");
  return v;
}

describe("saveOffer", () => {
  it("絞り込みが無ければ出さない", () => {
    expect(saveOffer(view({ folderId: "all" }))).toBeNull();
    expect(saveOffer(view({ folderId: "sf-own" }))).toBeNull();
    expect(saveOffer(view({ folderId: "by-cv" }))).toBeNull();
  });

  it("すべては、チップか検索語があれば「検索を保存」で、上書きは出さない", () => {
    expect(saveOffer(view({ folderId: "all", selectedTags: nts(["ASMR"]) }))).toBe("save");
    expect(saveOffer(view({ folderId: "all", q: "雨" }))).toBe("save");
    expect(saveOffer(view({ folderId: "all", q: "  " }))).toBeNull();
    expect(saveOffer(view({ folderId: "sf-own", q: " \u3000" }))).toBeNull();
    expect(saveOffer(view({ folderId: "all", sort: "title-asc" }))).toBeNull();
  });

  it("既定のスマートフォルダーも自作と同じく、チップを足すか並びを変えると「上書き」", () => {
    expect(saveOffer(view({ folderId: "fav", selectedTags: nts(["ASMR"]) }))).toBe("overwrite");
    expect(saveOffer(view({ folderId: "fav", sort: "title-asc" }))).toBe("overwrite");
  });

  it("グループ分けを持つ自作は値を選んでいれば「検索を保存」で、上書きは出さない", () => {
    expect(
      saveOffer(view({ folderId: "sf-grouped", group: "藤田", selectedTags: nts(["a"]) })),
    ).toBe("save");
    expect(saveOffer(view({ folderId: "by-cv", group: "藤田" }))).toBe("save");
  });

  it("自作でグループ分けなしは、チップか並びの変更で上書き、検索語だけなら「検索を保存」", () => {
    expect(saveOffer(view({ folderId: "sf-own", selectedTags: nts(["ASMR"]) }))).toBe("overwrite");
    expect(saveOffer(view({ folderId: "sf-own", sort: "added-desc" }))).toBe("overwrite");
    expect(saveOffer(view({ folderId: "sf-own", q: "雨" }))).toBe("save");
    expect(saveOffer(view({ folderId: "sf-own", sort: "title-asc" }))).toBeNull();
  });
});

describe("saveSearchDraft", () => {
  it("検索語は前後の空白を落として保存し、空白だけなら text を足さない（保存は常に通る）", () => {
    const padded = saveSearchDraft(works({ folderId: "all", q: "  雨 " }));
    expect(padded.condition).toEqual({ type: "and", children: [{ type: "text", q: "雨" }] });
    const blank = saveSearchDraft(
      works({ folderId: "all", selectedTags: nts(["asmr"]), q: "   " }),
    );
    expect(blank.condition).toEqual({ type: "and", children: [{ type: "tag", tag: "asmr" }] });
    expect(conditionSchema.safeParse(padded.condition).success).toBe(true);
    expect(conditionSchema.safeParse(blank.condition).success).toBe(true);
  });

  it("元の条件・値・チップ・@year・検索語を条件にまとめ、グループ分けを外し、並びを変えていなければ継承", () => {
    const draft = saveSearchDraft(
      works({
        folderId: "sf-grouped",
        group: "藤田",
        selectedTags: nts(["asmr", "@year/2025"]),
        q: "雨",
      }),
    );
    expect(draft).toEqual({
      name: "藤田",
      condition: {
        type: "and",
        children: [
          { type: "bookmarked" },
          { type: "tag", tag: "cv/藤田" },
          { type: "tag", tag: "asmr" },
          { type: "addedYear", year: "2025" },
          { type: "text", q: "雨" },
        ],
      },
      sort: null,
      groupBy: null,
      groupSort: null,
    });
    expect(conditionSchema.safeParse(draft.condition).success).toBe(true);
  });

  it("並びを変えていなければ元の既定の並びを写す", () => {
    expect(saveSearchDraft(works({ folderId: "recent", q: "雨" })).sort).toBe("last-played");
    expect(saveSearchDraft(works({ folderId: "random", q: "雨" })).sort).toBe("random");
    expect(saveSearchDraft(works({ folderId: "fav", q: "雨" })).sort).toBeNull();
    expect(saveSearchDraft(works({ folderId: "all", q: "雨" })).sort).toBeNull();
  });

  it("並びを変えていればその並びを既定にする", () => {
    const draft = saveSearchDraft(works({ folderId: "all", q: "雨", sort: "title-asc" }));
    expect(draft.sort).toBe("title-asc");
    expect(draft.name).toBe("雨");
  });

  it("名前はチップの末尾の値を「・」でつなぐ", () => {
    expect(
      saveSearchDraft(works({ folderId: "all", selectedTags: nts(["cv/藤田", "asmr"]) })).name,
    ).toBe("藤田・asmr");
  });

  it("値にスラッシュを含むタグは、最初のスラッシュより後ろ全部を名前にする", () => {
    expect(saveSearchDraft(works({ folderId: "all", selectedTags: nts(["cv/a/b"]) })).name).toBe(
      "a/b",
    );
  });
});

describe("overwriteChange", () => {
  it("条件にチップと検索語を足し、並びを変えていればそれを既定の並びにする。名前などは送らない", () => {
    const v = works({
      folderId: "sf-own",
      selectedTags: nts(["cv/藤田"]),
      q: "雨",
      sort: "added-desc",
    });
    expect(isOverwritable(v)).toBe(true);
    const change = overwriteChange({ ...v, folder: v.folder as OverwritableFolder });
    expect(change).toEqual({
      condition: {
        type: "and",
        children: [
          { type: "tag", tag: "asmr" },
          { type: "tag", tag: "cv/藤田" },
          { type: "text", q: "雨" },
        ],
      },
      sort: "added-desc",
    });
  });

  it("並びを変えていなければ既定の並びは送らない", () => {
    const v = works({ folderId: "sf-own", selectedTags: nts(["x"]) });
    expect(overwriteChange({ ...v, folder: v.folder as OverwritableFolder })).not.toHaveProperty(
      "sort",
    );
  });

  it("取り消しは、上書きが更新した項目だけを上書き前の値にする", () => {
    const changed = works({ folderId: "sf-own", selectedTags: nts(["x"]), sort: "added-desc" });
    const kept = works({ folderId: "sf-own", selectedTags: nts(["x"]) });
    const folder = changed.folder as OverwritableFolder;

    expect(overwriteUndoChange({ ...changed, folder })).toEqual({
      condition: folder.condition,
      sort: "title-asc",
    });
    expect(
      overwriteUndoChange({ ...kept, folder: kept.folder as OverwritableFolder }),
    ).not.toHaveProperty("sort");
  });

  it("「すべて」・グループ分けを持つものは上書きの対象外", () => {
    expect(isOverwritable(works({ folderId: "fav" }))).toBe(true);
    expect(isOverwritable(works({ folderId: "all" }))).toBe(false);
    expect(isOverwritable(works({ folderId: "sf-grouped", group: "x" }))).toBe(false);
  });
});
