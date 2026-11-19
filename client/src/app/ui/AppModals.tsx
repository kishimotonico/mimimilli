import type { WorkspacePath } from "@mimimilli/shared";
import { lazy, Suspense, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { activeModalAtom } from "../../shared/model/activeModalAtom";

const SettingsModal = lazy(() => import("../../features/settings/ui/SettingsModal"));
const ScanModal = lazy(() => import("../../features/scan/ui/ScanModal"));

interface AppModalsProps {
  lastScanTime: string | null;
  onChangeFolder: (path: string) => Promise<unknown>;
  onExport: () => void;
  onOpenFiles: (path: WorkspacePath) => void;
  onOpenWorkDetail: (workId: string) => void;
}

// activeModalAtom を読む唯一の場所。どのモーダルを表示するかの判断をここへ集約し、
// 各モーダル本体（SettingsModal / ScanModal）は props 駆動のまま保つ。
export default function AppModals({
  lastScanTime,
  onChangeFolder,
  onExport,
  onOpenFiles,
  onOpenWorkDetail,
}: AppModalsProps) {
  const activeModal = useAtomValue(activeModalAtom);
  const setActiveModal = useSetAtom(activeModalAtom);
  const handleClose = useCallback(() => setActiveModal(null), [setActiveModal]);

  return (
    <>
      {activeModal?.kind === "settings" && (
        <Suspense fallback={null}>
          <SettingsModal
            lastScanTime={lastScanTime}
            onClose={handleClose}
            onOpenScan={() => setActiveModal({ kind: "scan" })}
            onChangeFolder={onChangeFolder}
            onExport={onExport}
          />
        </Suspense>
      )}
      {activeModal?.kind === "scan" && (
        <Suspense fallback={null}>
          <ScanModal
            lastScanTime={lastScanTime}
            onClose={handleClose}
            onOpenFiles={onOpenFiles}
            onOpenWorkDetail={onOpenWorkDetail}
          />
        </Suspense>
      )}
    </>
  );
}
