import { atom } from "jotai";
import type { ToastVariant } from "../../../shared/ui/Toast";

/** DlsiteEditor（作品詳細）での単発コード保存・適用結果トースト */
export const dlsiteApplyToastAtom = atom<{ message: string; variant: ToastVariant } | null>(null);
