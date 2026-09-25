import type { ScanDiagnostic } from "@mimimilli/shared";

/** identity_conflict診断からworkIdの該当pathを外す。残りpathが2未満なら診断ごと消す。 */
export function removeIdentityConflictPath(
  diagnostics: ScanDiagnostic[],
  workId: string,
  path: string,
): ScanDiagnostic[] {
  return diagnostics.flatMap((diagnostic) => {
    if (diagnostic.workId !== workId) return [diagnostic];
    const paths = diagnostic.paths.filter((candidate) => candidate !== path);
    return paths.length >= 2 ? [{ ...diagnostic, paths }] : [];
  });
}
