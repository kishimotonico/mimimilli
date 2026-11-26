import { Menu } from "@ark-ui/react/menu";
import { Popover } from "@ark-ui/react/popover";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MenuPopup, MotionMenuRoot, useMotionMenu } from "../../../src/shared/ui/menu/MotionMenu";
import {
  MotionPopoverRoot,
  PopoverPopup,
  useMotionPopover,
} from "../../../src/shared/ui/popover/MotionPopover";
import { useDialogModal } from "../../../src/shared/ui/useDialogModal";

function NestedMenu() {
  const handle = useMotionMenu();
  return (
    <MotionMenuRoot handle={handle}>
      <Menu.Trigger>メニューを開く</Menu.Trigger>
      <MenuPopup origin="top left">
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
        <Popover.Trigger>ポップオーバーを開く</Popover.Trigger>
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
