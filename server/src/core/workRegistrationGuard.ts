// 作品登録（POST /api/works）の重複チェック。real/fixture 両adapterが共有する。
import { descendantsRegisteredError, WorkRegisterError } from "../errors.ts";

export interface RegistrationConflictCheck {
  alreadyRegistered: boolean;
  descendantWorkCount: number;
  kind: "folder" | "file";
}

const ALREADY_REGISTERED_MESSAGE: Record<RegistrationConflictCheck["kind"], string> = {
  folder: "このフォルダーは既に作品として登録されています",
  file: "このファイルは既に作品として登録されています",
};

/** 登録対象が既に登録済み、または配下に登録済み作品を持つ場合に WorkRegisterError を投げる。 */
export function assertRegistrationAllowed(check: RegistrationConflictCheck): void {
  if (check.alreadyRegistered) {
    throw new WorkRegisterError("already_registered", ALREADY_REGISTERED_MESSAGE[check.kind]);
  }
  if (check.descendantWorkCount > 0) {
    throw descendantsRegisteredError(check.descendantWorkCount);
  }
}
