import { Menu } from "@ark-ui/react/menu";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  MenuPopup,
  MotionMenuRoot,
  MotionMenuTrigger,
  useMotionMenu,
} from "../../../src/shared/ui/menu/MotionMenu";
import {
  MotionPopoverRoot,
  MotionPopoverTrigger,
  PopoverPopup,
  useMotionPopover,
} from "../../../src/shared/ui/popover/MotionPopover";
import { useDialogModal } from "../../../src/shared/ui/useDialogModal";

function NestedMenu() {
  const handle = useMotionMenu();
  return (
    <MotionMenuRoot handle={handle}>
      <MotionMenuTrigger>
        <button type="button">メニューを開く</button>
      </MotionMenuTrigger>
      <MenuPopup>
        <Menu.Item value="item">メニュー項目</Menu.Item>
      </MenuPopup>
    </MotionMenuRoot>
  );
}

function DialogHost({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const { dialogRef, handleCancel } = useDialogModal({ onClose });
  const handle = useMotionPopover({ open, onOpenChange: (details) => setOpen(details.open) });
  return (
    <dialog ref={dialogRef} aria-label="親ダイアログ" onCancel={handleCancel}>
      <MotionPopoverRoot handle={handle}>
        <MotionPopoverTrigger>
          <button type="button">ポップオーバーを開く</button>
        </MotionPopoverTrigger>
        <PopoverPopup aria-label="ポップオーバー">
          <NestedMenu />
        </PopoverPopup>
      </MotionPopoverRoot>
    </dialog>
  );
}

function App() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        ダイアログを開く
      </button>
      {open && <DialogHost onClose={() => setOpen(false)} />}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
