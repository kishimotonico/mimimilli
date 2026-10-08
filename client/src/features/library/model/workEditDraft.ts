import type { NormalizedTag, UrlEntry, WorkEditSnapshot } from "@mimimilli/shared";
import { isHttpAbsoluteUrl } from "@mimimilli/shared";
import {
  reconcileWorkEditSnapshot,
  tagsEqual,
  urlsEqual,
  type WorkEditField,
} from "./workEditReconcile";

// 作品編集ダイアログの編集状態（ADR-0025 一括draft保存）の状態遷移。基準snapshotの取り込み、
// 衝突の選び直し、dirty判定、保存リクエストの組み立てをReactなしで扱う。

export interface WorkEditFields {
  title: string;
  tags: NormalizedTag[];
  urls: UrlEntry[];
}

interface PendingReconcile {
  snapshot: WorkEditSnapshot;
  changedFields: WorkEditField[];
  conflictFields: WorkEditField[];
  keepMineFields: ReadonlySet<WorkEditField>;
}

export interface WorkEditDraftState {
  /** snapshotが届くまでの基準（一覧上のWork由来） */
  initial: WorkEditFields;
  accepted: WorkEditSnapshot | null;
  processedRevision: string | null;
  draft: WorkEditFields;
  urlValidationError: string | null;
  pending: PendingReconcile | null;
}

export type WorkEditDraftAction =
  | { type: "snapshotReceived"; snapshot: WorkEditSnapshot }
  | { type: "titleChanged"; title: string }
  | { type: "tagsChanged"; tags: NormalizedTag[] }
  | { type: "urlsChanged"; urls: UrlEntry[] }
  | { type: "urlValidationFailed"; message: string }
  | { type: "conflictResolved"; field: WorkEditField; useLatest: boolean }
  | { type: "saved"; snapshot: WorkEditSnapshot };

export interface WorkEditDirty {
  trimmedTitle: string;
  normalizedUrls: UrlEntry[];
  title: boolean;
  tags: boolean;
  urls: boolean;
  any: boolean;
}

export type WorkEditSavePlan =
  | { kind: "blocked" }
  | { kind: "invalidUrls"; message: string }
  | {
      kind: "ready";
      sourceRevision: string;
      title: string | undefined;
      tags: NormalizedTag[] | undefined;
      urls: UrlEntry[] | undefined;
    };

export const URL_PAIR_REQUIRED_MESSAGE = "ラベルとURLの両方を入力してください";
export const URL_HTTP_ONLY_MESSAGE = "httpまたはhttpsのURLだけを登録できます";

export function cloneUrls(urls: UrlEntry[]): UrlEntry[] {
  return urls.map((entry) => ({ label: entry.label, url: entry.url }));
}

function fieldsOf(snapshot: Pick<WorkEditSnapshot, "title" | "tags" | "urls">): WorkEditFields {
  return { title: snapshot.title, tags: snapshot.tags, urls: cloneUrls(snapshot.urls) };
}

export function createWorkEditDraftState(initial: {
  title: string;
  tags: NormalizedTag[];
  urls: UrlEntry[];
}): WorkEditDraftState {
  const fields = fieldsOf(initial);
  return {
    initial: fields,
    accepted: null,
    processedRevision: null,
    draft: fields,
    urlValidationError: null,
    pending: null,
  };
}

function currentOf(state: WorkEditDraftState): WorkEditFields {
  return state.accepted ?? state.initial;
}

export function deriveWorkEditDirty(state: WorkEditDraftState): WorkEditDirty {
  const current = currentOf(state);
  const trimmedTitle = state.draft.title.trim();
  const normalizedUrls = state.draft.urls
    .map((entry) => ({ label: entry.label.trim(), url: entry.url.trim() }))
    .filter((entry) => entry.label || entry.url);
  const title = trimmedTitle !== current.title;
  const tags = !tagsEqual(state.draft.tags, current.tags);
  const urls = !urlsEqual(normalizedUrls, current.urls);
  return { trimmedTitle, normalizedUrls, title, tags, urls, any: title || tags || urls };
}

export function hasUnresolvedConflicts(state: WorkEditDraftState): boolean {
  return (state.pending?.conflictFields.length ?? 0) > 0;
}

/** 保存ボタンと未保存プロンプトの「保存する」を許可できるか（snapshot取り込み済みは呼び出し側で見る）。 */
export function canSaveWorkEditDraft(state: WorkEditDraftState): boolean {
  const dirty = deriveWorkEditDirty(state);
  return !hasUnresolvedConflicts(state) && !(dirty.title && !dirty.trimmedTitle);
}

function applyField(
  draft: WorkEditFields,
  field: WorkEditField,
  snapshot: WorkEditSnapshot,
): WorkEditFields {
  if (field === "title") return { ...draft, title: snapshot.title };
  if (field === "tags") return { ...draft, tags: snapshot.tags };
  return { ...draft, urls: cloneUrls(snapshot.urls) };
}

function receiveSnapshot(
  state: WorkEditDraftState,
  incoming: WorkEditSnapshot,
): WorkEditDraftState {
  if (incoming.sourceRevision === state.processedRevision) return state;
  const processedRevision = incoming.sourceRevision;
  if (!state.accepted) {
    return { ...state, processedRevision, accepted: incoming, draft: fieldsOf(incoming) };
  }
  const dirty = deriveWorkEditDirty(state);
  const { changedFields, conflictFields } = reconcileWorkEditSnapshot(
    state.accepted,
    incoming,
    { title: dirty.title, tags: dirty.tags, urls: dirty.urls },
    { title: dirty.trimmedTitle, tags: state.draft.tags, urls: dirty.normalizedUrls },
  );
  if (conflictFields.length > 0) {
    return {
      ...state,
      processedRevision,
      pending: { snapshot: incoming, changedFields, conflictFields, keepMineFields: new Set() },
    };
  }
  const draft = changedFields.reduce((acc, field) => applyField(acc, field, incoming), state.draft);
  return { ...state, processedRevision, accepted: incoming, draft, pending: null };
}

function resolveConflict(
  state: WorkEditDraftState,
  field: WorkEditField,
  useLatest: boolean,
): WorkEditDraftState {
  const pending = state.pending;
  if (!pending) return state;
  let draft = useLatest ? applyField(state.draft, field, pending.snapshot) : state.draft;
  const keepMineFields = useLatest
    ? pending.keepMineFields
    : new Set(pending.keepMineFields).add(field);
  const remaining = pending.conflictFields.filter((f) => f !== field);
  if (remaining.length > 0) {
    return { ...state, draft, pending: { ...pending, conflictFields: remaining, keepMineFields } };
  }
  for (const changedField of pending.changedFields) {
    if (!keepMineFields.has(changedField))
      draft = applyField(draft, changedField, pending.snapshot);
  }
  return { ...state, accepted: pending.snapshot, draft, pending: null };
}

export function workEditDraftReducer(
  state: WorkEditDraftState,
  action: WorkEditDraftAction,
): WorkEditDraftState {
  switch (action.type) {
    case "snapshotReceived":
      return receiveSnapshot(state, action.snapshot);
    case "titleChanged":
      return { ...state, draft: { ...state.draft, title: action.title } };
    case "tagsChanged":
      return { ...state, draft: { ...state.draft, tags: action.tags } };
    case "urlsChanged":
      return { ...state, draft: { ...state.draft, urls: action.urls }, urlValidationError: null };
    case "urlValidationFailed":
      return { ...state, urlValidationError: action.message };
    case "conflictResolved":
      return resolveConflict(state, action.field, action.useLatest);
    case "saved":
      return {
        ...state,
        accepted: action.snapshot,
        processedRevision: action.snapshot.sourceRevision,
        draft: fieldsOf(action.snapshot),
        urlValidationError: null,
      };
  }
}

/** 空行を除き、不正な行があればエラー文言を返す。 */
function validateUrls(drafts: UrlEntry[]): { urls: UrlEntry[] } | { error: string } {
  const filled: UrlEntry[] = [];
  for (const entry of drafts) {
    const label = entry.label.trim();
    const url = entry.url.trim();
    if (!label && !url) continue;
    if (!label || !url) return { error: URL_PAIR_REQUIRED_MESSAGE };
    if (!isHttpAbsoluteUrl(url)) return { error: URL_HTTP_ONLY_MESSAGE };
    filled.push({ label, url });
  }
  return { urls: filled };
}

/** dirtyなフィールドだけを1回のPATCHへ含める（ADR-0025）。 */
export function planWorkEditSave(state: WorkEditDraftState): WorkEditSavePlan {
  if (!state.accepted || hasUnresolvedConflicts(state)) return { kind: "blocked" };
  const dirty = deriveWorkEditDirty(state);
  if (dirty.title && !dirty.trimmedTitle) return { kind: "blocked" };
  let urls: UrlEntry[] | undefined;
  if (dirty.urls) {
    const validated = validateUrls(state.draft.urls);
    if ("error" in validated) return { kind: "invalidUrls", message: validated.error };
    urls = validated.urls;
  }
  if (!dirty.any) return { kind: "blocked" };
  return {
    kind: "ready",
    sourceRevision: state.accepted.sourceRevision,
    title: dirty.title ? dirty.trimmedTitle : undefined,
    tags: dirty.tags ? state.draft.tags : undefined,
    urls,
  };
}
