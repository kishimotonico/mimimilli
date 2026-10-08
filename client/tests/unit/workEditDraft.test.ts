import { describe, expect, it } from "vitest";
import type { NormalizedTag, WorkEditSnapshot } from "@mimimilli/shared";
import {
  URL_HTTP_ONLY_MESSAGE,
  URL_PAIR_REQUIRED_MESSAGE,
  canSaveWorkEditDraft,
  createWorkEditDraftState,
  deriveWorkEditDirty,
  planWorkEditSave,
  workEditDraftReducer,
  type WorkEditDraftAction,
  type WorkEditDraftState,
} from "../../src/features/library/model/workEditDraft";

const tag = (value: string) => value as NormalizedTag;

function snapshot(patch: Partial<WorkEditSnapshot> = {}): WorkEditSnapshot {
  return {
    sourceRevision: "r1",
    id: "w1",
    physicalPath: "/lib/w1",
    title: "元タイトル",
    tags: [tag("a")],
    urls: [{ label: "公式", url: "https://example.com" }],
    coverImage: null,
    dlsite: { rjCode: null, status: "none", appliedTags: [] },
    ...patch,
  } as WorkEditSnapshot;
}

function run(state: WorkEditDraftState, ...actions: WorkEditDraftAction[]) {
  return actions.reduce(workEditDraftReducer, state);
}

function loaded(patch: Partial<WorkEditSnapshot> = {}) {
  const snap = snapshot(patch);
  const initial = createWorkEditDraftState({ title: snap.title, tags: snap.tags, urls: snap.urls });
  return run(initial, { type: "snapshotReceived", snapshot: snap });
}

describe("snapshotの取り込み", () => {
  it("最初のsnapshotは基準とdraftの両方に取り込む", () => {
    const state = loaded({ title: "取得した値" });
    expect(state.accepted?.title).toBe("取得した値");
    expect(state.draft.title).toBe("取得した値");
    expect(deriveWorkEditDirty(state).any).toBe(false);
  });

  it("同じrevisionの再受信は何もしない", () => {
    const state = run(loaded(), { type: "titleChanged", title: "編集中" });
    const next = run(state, { type: "snapshotReceived", snapshot: snapshot({ title: "別" }) });
    expect(next).toBe(state);
  });

  it("dirtyでないフィールドは外部の変更へ自動追従し、dirtyなフィールドは保つ", () => {
    const state = run(
      loaded(),
      { type: "titleChanged", title: "自分の編集" },
      {
        type: "snapshotReceived",
        snapshot: snapshot({ sourceRevision: "r2", tags: [tag("a"), tag("b")] }),
      },
    );
    expect(state.draft.title).toBe("自分の編集");
    expect(state.draft.tags).toEqual([tag("a"), tag("b")]);
    expect(state.accepted?.sourceRevision).toBe("r2");
    expect(state.pending).toBeNull();
  });

  it("自分の保存と同じ値が届いたdirtyフィールドは衝突にしない", () => {
    const state = run(
      loaded(),
      { type: "titleChanged", title: "新タイトル" },
      {
        type: "snapshotReceived",
        snapshot: snapshot({ sourceRevision: "r2", title: "新タイトル" }),
      },
    );
    expect(state.pending).toBeNull();
    expect(deriveWorkEditDirty(state).title).toBe(false);
  });

  it("dirtyなフィールドが外部でも別の値に変わったら衝突として保留する", () => {
    const state = run(
      loaded(),
      { type: "titleChanged", title: "自分の編集" },
      { type: "snapshotReceived", snapshot: snapshot({ sourceRevision: "r2", title: "他の編集" }) },
    );
    expect(state.pending?.conflictFields).toEqual(["title"]);
    expect(state.accepted?.sourceRevision).toBe("r1");
    expect(state.draft.title).toBe("自分の編集");
    expect(planWorkEditSave(state)).toEqual({ kind: "blocked" });
    expect(canSaveWorkEditDraft(state)).toBe(false);
  });

  it("衝突のない新しいsnapshotが届いたら古い保留を捨てる", () => {
    const state = run(
      loaded(),
      { type: "titleChanged", title: "自分の編集" },
      { type: "snapshotReceived", snapshot: snapshot({ sourceRevision: "r2", title: "他の編集" }) },
      {
        type: "snapshotReceived",
        snapshot: snapshot({ sourceRevision: "r3", title: "自分の編集" }),
      },
    );
    expect(state.pending).toBeNull();
    expect(state.accepted?.sourceRevision).toBe("r3");
  });
});

describe("衝突の解決", () => {
  const conflicted = () =>
    run(
      loaded(),
      { type: "titleChanged", title: "自分の編集" },
      {
        type: "snapshotReceived",
        snapshot: snapshot({ sourceRevision: "r2", title: "他の編集", tags: [tag("z")] }),
      },
    );

  it("最新の値を使うとdraftが置き換わり、全衝突の解決でsnapshotを基準にする", () => {
    const state = run(conflicted(), { type: "conflictResolved", field: "title", useLatest: true });
    expect(state.draft.title).toBe("他の編集");
    expect(state.draft.tags).toEqual([tag("z")]);
    expect(state.accepted?.sourceRevision).toBe("r2");
    expect(state.pending).toBeNull();
  });

  it("自分の編集を残すとdraftを保ったまま新しい基準に対するdirtyになる", () => {
    const state = run(conflicted(), { type: "conflictResolved", field: "title", useLatest: false });
    expect(state.draft.title).toBe("自分の編集");
    expect(state.accepted?.sourceRevision).toBe("r2");
    expect(deriveWorkEditDirty(state).title).toBe(true);
    expect(state.draft.tags).toEqual([tag("z")]);
  });

  it("保留がないときは何もしない", () => {
    const state = loaded();
    expect(run(state, { type: "conflictResolved", field: "title", useLatest: true })).toBe(state);
  });
});

describe("dirty判定", () => {
  it("タイトルは前後の空白を無視し、空のURL行は無視する", () => {
    const state = run(
      loaded(),
      { type: "titleChanged", title: "  元タイトル " },
      {
        type: "urlsChanged",
        urls: [
          { label: "公式", url: "https://example.com" },
          { label: " ", url: "" },
        ],
      },
    );
    expect(deriveWorkEditDirty(state).any).toBe(false);
  });

  it("snapshot到着前はWork由来の初期値が基準になる", () => {
    const initial = createWorkEditDraftState({ title: "t", tags: [], urls: [] });
    expect(deriveWorkEditDirty(initial).any).toBe(false);
    expect(planWorkEditSave(initial)).toEqual({ kind: "blocked" });
  });
});

describe("保存リクエストの組み立て", () => {
  it("dirtyなフィールドだけを含める", () => {
    const state = run(loaded(), { type: "titleChanged", title: " 新タイトル " });
    expect(planWorkEditSave(state)).toEqual({
      kind: "ready",
      sourceRevision: "r1",
      title: "新タイトル",
      tags: undefined,
      urls: undefined,
    });
  });

  it("タイトルを空にした保存と、変更のない保存は止める", () => {
    expect(planWorkEditSave(run(loaded(), { type: "titleChanged", title: "  " }))).toEqual({
      kind: "blocked",
    });
    expect(planWorkEditSave(loaded())).toEqual({ kind: "blocked" });
  });

  it("URLはラベルとURLの両方が要る", () => {
    const state = run(loaded(), { type: "urlsChanged", urls: [{ label: "x", url: "" }] });
    expect(planWorkEditSave(state)).toEqual({
      kind: "invalidUrls",
      message: URL_PAIR_REQUIRED_MESSAGE,
    });
  });

  it("URLはhttp(s)の絶対URLだけを受け付ける", () => {
    const state = run(loaded(), {
      type: "urlsChanged",
      urls: [{ label: "x", url: "ftp://example.com" }],
    });
    expect(planWorkEditSave(state)).toEqual({
      kind: "invalidUrls",
      message: URL_HTTP_ONLY_MESSAGE,
    });
  });

  it("URLは空白を除いた値を送る", () => {
    const state = run(loaded(), {
      type: "urlsChanged",
      urls: [
        { label: " x ", url: " https://example.com/x " },
        { label: "", url: "" },
      ],
    });
    expect(planWorkEditSave(state)).toMatchObject({
      kind: "ready",
      urls: [{ label: "x", url: "https://example.com/x" }],
    });
  });
});

describe("URL検証エラーと保存後の状態", () => {
  it("URLを編集するとエラーが解除される", () => {
    const state = run(
      loaded(),
      { type: "urlValidationFailed", message: "エラー" },
      { type: "urlsChanged", urls: [] },
    );
    expect(state.urlValidationError).toBeNull();
  });

  it("保存成功でdraftを保存した値へ揃え、エラーを解除する", () => {
    const state = run(
      loaded(),
      { type: "titleChanged", title: "保存した" },
      { type: "urlValidationFailed", message: "エラー" },
      { type: "saved", snapshot: snapshot({ sourceRevision: "r2", title: "保存した" }) },
    );
    expect(state.accepted?.sourceRevision).toBe("r2");
    expect(state.processedRevision).toBe("r2");
    expect(state.urlValidationError).toBeNull();
    expect(deriveWorkEditDirty(state).any).toBe(false);
  });
});
