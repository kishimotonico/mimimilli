import { useCallback } from "react";
import type { DlsiteNotificationModalKind } from "../model/dlsiteNotificationModal";
import { isDlsiteNotificationModal } from "../model/dlsiteNotificationModal";
import DlsiteFetchFailedModal from "./DlsiteFetchFailedModal";
import DlsiteParseFailedModal from "./DlsiteParseFailedModal";
import RjCodeMissingModal from "./RjCodeMissingModal";

interface DlsiteNotificationModalsProps {
  activeModal: DlsiteNotificationModalKind | null;
  onClose: () => void;
  onOpenWork: (workId: string) => void;
}

export default function DlsiteNotificationModals({
  activeModal,
  onClose,
  onOpenWork,
}: DlsiteNotificationModalsProps) {
  const handleOpenWork = useCallback(
    (workId: string) => {
      onClose();
      onOpenWork(workId);
    },
    [onClose, onOpenWork],
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
