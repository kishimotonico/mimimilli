/** Workは存在するが、resumeのPlaylist/Track所属またはoffsetが不正。 */
export class InvalidResumeError extends Error {}

/** 前提条件（ルートフォルダー未設定等）を満たしていない操作。HTTP では 409 conflict */
export class NotConfiguredError extends Error {}

/** ルートフォルダーとして指定されたパスが存在しない、またはディレクトリではない。HTTP では 400 invalid_request */
export class InvalidRootFolderError extends Error {}

export class SourceChangedError extends Error {
  constructor() {
    super("作品データが外部で変更されました。再読み込みしてから編集してください");
    this.name = "SourceChangedError";
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
    | "descendants_require_merge"
    | "not_configured"
    | "invalid_meta";
  readonly descendantCount?: number;

  constructor(
    code: "already_registered" | "descendants_require_merge" | "not_configured" | "invalid_meta",
    message: string,
    descendantCount?: number,
  ) {
    super(message);
    this.name = "WorkRegisterError";
    this.code = code;
    this.descendantCount = descendantCount;
  }
}

export class DlsiteOfflineError extends Error {
  constructor() {
    super("DLsiteはオフライン設定のため取得しませんでした");
    this.name = "DlsiteOfflineError";
  }
}
