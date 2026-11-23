/** Workは存在するが、resumeのPlaylist/Track所属またはoffsetが不正。 */
export class InvalidResumeError extends Error {}

/** 前提条件（ルートフォルダー未設定等）を満たしていない操作。HTTP では 409 conflict */
export class NotConfiguredError extends Error {}

/** root再設定中・失敗中のため通常操作を受け付けない（ADR-0029）。HTTP では 409 root_reconfiguring */
export class RootReconfiguringError extends Error {
  constructor() {
    super("ルートフォルダーの再設定中のため、この操作はできません");
    this.name = "RootReconfiguringError";
  }
}

/** ルートフォルダーとして指定されたパスが存在しない、またはディレクトリではない。HTTP では 400 invalid_request */
export class InvalidRootFolderError extends Error {}

/** DLsiteカバーを作品フォルダーへ保存できなかった。 */
export class CoverSaveError extends Error {
  constructor(options?: ErrorOptions) {
    super("DLsiteカバーの保存に失敗しました", options);
    this.name = "CoverSaveError";
  }
}

export interface UnreadableSmartFolderRow {
  id: string;
  name: string;
  problems: Array<{ column: string; reason: string }>;
}

/** 保存済みのスマートフォルダーの行が、保存と同じ検証を通らない。HTTP は 500 internal で、本文に行の ID・理由・直し方を出す。
 *  ユーザー向けの文言には総称を出さず、行を名前と ID で呼ぶ */
export class UnreadableSmartFolderError extends Error {
  readonly rows: UnreadableSmartFolderRow[];
  readonly dbPath: string;

  constructor(rows: UnreadableSmartFolderRow[], dbPath: string) {
    super(unreadableSmartFolderMessage(rows, dbPath));
    this.name = "UnreadableSmartFolderError";
    this.rows = rows;
    this.dbPath = dbPath;
  }
}

/** シェルでも SQL でも壊れない形で ID を指す。安全な文字だけの ID はそのまま、それ以外は16進のリテラルにする */
function idCondition(id: string): string {
  if (/^[A-Za-z0-9_-]+$/.test(id)) return `id = '${id}'`;
  return `id = CAST(x'${Buffer.from(id, "utf8").toString("hex")}' AS TEXT)`;
}

function unreadableSmartFolderMessage(rows: UnreadableSmartFolderRow[], dbPath: string): string {
  const lines = rows.map((row) => {
    const reasons = row.problems.map((p) => `${p.column}: ${p.reason}`).join(" / ");
    const sql = `DELETE FROM smart_folders WHERE ${idCondition(row.id)}`;
    return `「${row.name}」（ID: ${row.id}）を読めません。${reasons}\n  sqlite3 "${dbPath}" "${sql}"`;
  });
  return `保存済みの行を読めないため、ライブラリを開けません。次のコマンドで行を消してください（消した「すべて」は次の起動で戻ります）。\n${lines.join("\n")}`;
}

export class SourceChangedError extends Error {
  constructor() {
    super("作品データが外部で変更されました。再読み込みしてからやり直してください");
    this.name = "SourceChangedError";
  }
}

export const SOURCE_FILE_MISSING_MESSAGE = "作品情報ファイルが見つかりません。";
export const SOURCE_FILE_BROKEN_MESSAGE =
  "作品情報ファイルが壊れています。表示は前回スキャン時点の内容です。";
export const SOURCE_FORMAT_UNSUPPORTED_MESSAGE = "この作品情報の形式には未対応です。";
export const SOURCE_IDENTITY_MISMATCH_MESSAGE =
  "作品情報の識別子が一致しないため、この操作は適用できません。";
export const SOURCE_LOCATION_MISMATCH_MESSAGE =
  "作品の場所が一致しないため、この操作は適用できません。";

export const SOURCE_RELOAD_FAILED_MESSAGE = "作品を一覧へ反映できませんでした。";

/** 作品情報ファイルを読み直して投影し直しても、保存された値がまだ検証を通らない。HTTP は reload_unresolved。 */
export class SourceReloadUnresolvedError extends Error {
  constructor() {
    super("作品情報ファイルを読み直しても、この作品の保存値を直せませんでした。");
    this.name = "SourceReloadUnresolvedError";
  }
}

/** JSON 不正・スキーマ不正・formatVersion 非対応。HTTP は parse_error。 */
export class SourceParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceParseError";
  }
}

/** 作品情報ファイルが無い・identity/location 不一致。HTTP は conflict。 */
export class SourceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceConflictError";
  }
}

export class CandidatePoolChangedError extends Error {
  constructor() {
    super("候補が更新されています。再スキャンして選び直してください");
    this.name = "CandidatePoolChangedError";
  }
}

export type WorkRegisterErrorCode =
  | "already_registered"
  | "descendants_registered"
  | "identity_conflict"
  | "invalid_path"
  | "invalid_meta";

export class WorkRegisterError extends Error {
  readonly code: WorkRegisterErrorCode;
  readonly descendantCount?: number;

  constructor(code: WorkRegisterErrorCode, message: string, descendantCount?: number) {
    super(message);
    this.name = "WorkRegisterError";
    this.code = code;
    this.descendantCount = descendantCount;
  }
}

export function descendantsRegisteredError(count: number): WorkRegisterError {
  return new WorkRegisterError(
    "descendants_registered",
    `配下に登録済み作品が${count}件あります。先に子作品を登録解除してから親を登録してください`,
    count,
  );
}

export function restoreIdentityConflictError(): WorkRegisterError {
  return new WorkRegisterError(
    "identity_conflict",
    "同じ Work ID が別の場所で登録済みです。移動の再接続なら先にスキャンしてください。複製なら Files で「別の作品として取り込む」を使ってください",
  );
}

export class DlsiteRefetchRequiredError extends Error {
  constructor() {
    super("DLsiteの取得結果が古くなりました。もう一度取得してから適用してください");
    this.name = "DlsiteRefetchRequiredError";
  }
}

export class DlsiteOfflineError extends Error {
  constructor() {
    super("DLsiteはオフライン設定のため取得しませんでした");
    this.name = "DlsiteOfflineError";
  }
}
