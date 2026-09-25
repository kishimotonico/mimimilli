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

export class SourceChangedError extends Error {
  constructor() {
    super("作品データが外部で変更されました。再読み込みしてから編集してください");
    this.name = "SourceChangedError";
  }
}

export const SOURCE_FILE_MISSING_MESSAGE = "作品情報ファイルが見つからないため編集できません。";
export const SOURCE_FILE_BROKEN_MESSAGE =
  "作品情報ファイルが壊れているため編集できません。表示は前回スキャン時点の内容です。";
export const SOURCE_FORMAT_UNSUPPORTED_MESSAGE =
  "この作品情報の形式には未対応のため編集できません。";
export const SOURCE_IDENTITY_MISMATCH_MESSAGE =
  "作品情報の識別子が一致しないため、この操作は適用できません。";
export const SOURCE_LOCATION_MISMATCH_MESSAGE =
  "作品の場所が一致しないため、この操作は適用できません。";

/** JSON 不正・スキーマ不正・formatVersion 非対応。HTTP は parse_error。 */
export class SourceParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceParseError";
  }
}

/** ファイル欠損・identity/location 不一致。HTTP は conflict。 */
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

export class WorkRegisterError extends Error {
  readonly code:
    | "already_registered"
    | "descendants_registered"
    | "identity_conflict"
    | "not_configured"
    | "invalid_meta";
  readonly descendantCount?: number;

  constructor(
    code:
      | "already_registered"
      | "descendants_registered"
      | "identity_conflict"
      | "not_configured"
      | "invalid_meta",
    message: string,
    descendantCount?: number,
  ) {
    super(message);
    this.name = "WorkRegisterError";
    this.code = code;
    this.descendantCount = descendantCount;
  }
}

export function descendantsRegisteredError(count: number): WorkRegisterError {
  return new WorkRegisterError(
    "descendants_registered",
    `配下に登録済み作品が${count}件あります。先に子作品の登録を解除してから親を登録してください`,
    count,
  );
}

export function restoreIdentityConflictError(): WorkRegisterError {
  return new WorkRegisterError(
    "identity_conflict",
    "同じ Work ID が別の場所で登録済みです。移動の再接続なら先にスキャンしてください。複製なら Files で「別作品として取り込む」を使ってください",
  );
}

export class DlsiteOfflineError extends Error {
  constructor() {
    super("DLsiteはオフライン設定のため取得しませんでした");
    this.name = "DlsiteOfflineError";
  }
}
