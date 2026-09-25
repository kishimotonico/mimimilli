import { lazy, Suspense, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { activeModalAtom, isDlsiteNotificationModal } from "../../shared/model/activeModalAtom";
import DlsiteNotificationModals from "../../features/dlsite/ui/DlsiteNotificationModals";

const SettingsModal = lazy(() => import("../../features/settings/ui/SettingsModal"));
const ScanModal = lazy(() => import("../../features/scan/ui/ScanModal"));

interface AppModalsProps {
  lastScanTime: string | null;
  onChangeFolder: (path: string) => Promise<unknown>;
  onExport: () => void;
  onOpenFiles: (path: string) => void;
  onOpenWork: (workId: string) => void;
}

// activeModalAtom を読む唯一の場所。どのモーダルを表示するかの判断をここへ集約し、
// 各モーダル本体（SettingsModal / ScanModal / DlsiteNotificationModals）は props 駆動のまま保つ。
export default function AppModals({
  lastScanTime,
  onChangeFolder,
  onExport,
  onOpenFiles,
  onOpenWork,
}: AppModalsProps) {
  const activeModal = useAtomValue(activeModalAtom);
  const setActiveModal = useSetAtom(activeModalAtom);
  const handleClose = useCallback(() => setActiveModal(null), [setActiveModal]);
  const dlsiteModalKind =
    activeModal && isDlsiteNotificationModal(activeModal.kind) ? activeModal.kind : null;

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
            initialTab={activeModal.tab}
            onClose={handleClose}
            onOpenFiles={onOpenFiles}
          />
        </Suspense>
      )}
      <DlsiteNotificationModals
        activeModal={dlsiteModalKind}
        onClose={handleClose}
        onOpenWork={onOpenWork}
      />
    </>
  );
}
