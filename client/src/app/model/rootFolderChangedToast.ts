import type { ToastRequest } from "../../shared/model/toastRequestsAtom";

/** ルートフォルダー変更成功時のトースト要求。「今すぐスキャン」からスキャンモーダルを開く */
export function buildRootFolderChangedToastRequest(onOpenScan: () => void): ToastRequest {
  return {
    message: "ルートフォルダーを変更しました。新しいフォルダーを読み込むにはスキャンしてください。",
    variant: "success",
    priority: "notice",
    actionLabel: "今すぐスキャン",
    onAction: onOpenScan,
  };
}
