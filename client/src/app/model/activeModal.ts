import type { DlsiteNotificationModalKind } from "../../entities/dlsite/model/dlsiteNotificationModal";
import { isDlsiteNotificationModal } from "../../entities/dlsite/model/dlsiteNotificationModal";

export type ActiveModal = null | "settings" | "scan" | DlsiteNotificationModalKind;

export { isDlsiteNotificationModal };
