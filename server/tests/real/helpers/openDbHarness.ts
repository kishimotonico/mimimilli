import { openDb } from "../../../src/adapters/real/db.ts";

const [catalogPath, userPath, backupDir] = process.argv.slice(2);
if (!catalogPath || !userPath || !backupDir) {
  throw new Error("usage: openDbHarness.ts <catalogPath> <userPath> <backupDir>");
}

openDb({ kind: "files", catalogPath, userPath }, { backupDir }).close();
