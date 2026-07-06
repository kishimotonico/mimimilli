export interface WorkFolderDisplay {
  badge: string | null;
  name: string;
}

const RJ_CODE = /^RJ\d+$/;

/** 登録作品フォルダーの一覧・見出し用表示を組み立てる。物理名やパスは変更しない。 */
export function getWorkFolderDisplay(
  name: string,
  workId: string | null | undefined,
): WorkFolderDisplay {
  if (!workId) return { badge: null, name };
  if (!RJ_CODE.test(workId)) return { badge: "作品", name };

  const titleMatch = name.match(new RegExp(`^${workId}[\\s_＿・-]+(.+)$`));
  const title = titleMatch?.[1].trim();

  if (!title && name.startsWith(workId)) {
    return { badge: "作品", name };
  }

  return {
    badge: workId,
    name: title || name,
  };
}
