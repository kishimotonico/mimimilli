import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { ActiveModal } from "../../../app/model/activeModal";
import { isDlsiteNotificationModal } from "../../../app/model/activeModal";
import { setAppModeAtom } from "../../navigation/model/navigationAtoms";
import { selectLibraryWorkAtom } from "../model/libraryNavigationActions";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import DlsiteFetchFailedModal from "./DlsiteFetchFailedModal";
import DlsiteParseFailedModal from "./DlsiteParseFailedModal";
import RjCodeMissingModal from "./RjCodeMissingModal";

interface DlsiteNotificationModalsProps {
  activeModal: ActiveModal;
  onClose: () => void;
}

export default function DlsiteNotificationModals({
  activeModal,
  onClose,
}: DlsiteNotificationModalsProps) {
  const setAppMode = useSetAtom(setAppModeAtom);
  const { setAxis: setLibraryAxis } = useLibraryNavigation();
  const selectLibraryWork = useSetAtom(selectLibraryWorkAtom);

  const handleOpenWork = useCallback(
    (workId: string) => {
      onClose();
      setAppMode("library");
      setLibraryAxis("all");
      selectLibraryWork(workId);
    },
    [onClose, selectLibraryWork, setAppMode, setLibraryAxis],
  );

  if (!isDlsiteNotificationModal(activeModal)) return null;

  switch (activeModal) {
    case "rj-missing":
      return <RjCodeMissingModal onClose={onClose} onOpenWork={handleOpenWork} />;
    case "fetch-failed":
      return <DlsiteFetchFailedModal onClose={onClose} onOpenWork={handleOpenWork} />;
    case "parse-failed":
      return <DlsiteParseFailedModal onClose={onClose} onOpenWork={handleOpenWork} />;
  }
}
