import type { DlsiteNotificationModalKind } from "../../features/library/model/dlsiteNotificationModal";
import { isDlsiteNotificationModal } from "../../features/library/model/dlsiteNotificationModal";

export type ActiveModal = null | "settings" | "scan" | DlsiteNotificationModalKind;

export { isDlsiteNotificationModal };
