import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { setAppModeAtom } from "../../navigation/model/navigationAtoms";
import {
  closeDlsiteNotificationModalAtom,
  dlsiteNotificationModalAtom,
} from "../model/dlsiteNotificationAtoms";
import { selectLibraryWorkAtom, setLibraryAxisAtom } from "../model/libraryNavigationActions";
import DlsiteFetchFailedModal from "./DlsiteFetchFailedModal";
import DlsiteParseFailedModal from "./DlsiteParseFailedModal";
import RjCodeMissingModal from "./RjCodeMissingModal";

interface DlsiteNotificationModalsProps {
  /** 作品詳細へ遷移する直前に呼ぶ（スキャンモーダルを閉じる等） */
  onBeforeNavigateToWork?: () => void;
}

export default function DlsiteNotificationModals({
  onBeforeNavigateToWork,
}: DlsiteNotificationModalsProps) {
  const modal = useAtomValue(dlsiteNotificationModalAtom);
  const closeModal = useSetAtom(closeDlsiteNotificationModalAtom);
  const setAppMode = useSetAtom(setAppModeAtom);
  const setLibraryAxis = useSetAtom(setLibraryAxisAtom);
  const selectLibraryWork = useSetAtom(selectLibraryWorkAtom);

  const handleOpenWork = useCallback(
    (workId: string) => {
      closeModal();
      onBeforeNavigateToWork?.();
      setAppMode("library");
      setLibraryAxis("all");
      selectLibraryWork(workId);
    },
    [closeModal, onBeforeNavigateToWork, selectLibraryWork, setAppMode, setLibraryAxis],
  );

  if (modal === null) return null;

  switch (modal) {
    case "rj-missing":
      return <RjCodeMissingModal onClose={closeModal} onOpenWork={handleOpenWork} />;
    case "fetch-failed":
      return <DlsiteFetchFailedModal onClose={closeModal} onOpenWork={handleOpenWork} />;
    case "parse-failed":
      return <DlsiteParseFailedModal onClose={closeModal} onOpenWork={handleOpenWork} />;
  }
}
