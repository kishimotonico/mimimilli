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
