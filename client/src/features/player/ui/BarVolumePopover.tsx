import { useEffect, useRef, useState } from "react";
import { Popover } from "@ark-ui/react/popover";
import { useIsPresent } from "motion/react";
import { I } from "../../../shared/ui/Icon";
import {
  MotionPopoverRoot,
  PopoverPopup,
  useMotionPopover,
} from "../../../shared/ui/popover/MotionPopover";

interface BarVolumePopoverProps {
  volume: number;
  onSetVolume: (volume: number) => void;
}

export default function BarVolumePopover({ volume, onSetVolume }: BarVolumePopoverProps) {
  const isPresent = useIsPresent();
  const [isOpen, setIsOpen] = useState(false);
  const sliderRef = useRef<HTMLInputElement>(null);

  const popover = useMotionPopover({
    open: isOpen,
    onOpenChange: ({ open }) => setIsOpen(open),
    positioning: { placement: "top" },
    initialFocusEl: () => sliderRef.current,
  });

  useEffect(() => {
    if (!isPresent && isOpen) setIsOpen(false);
  }, [isPresent, isOpen]);

  return (
    <div className="mle-bar1__vol">
      <MotionPopoverRoot handle={popover}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`mle-bar1__track-button ${volume === 0 ? "is-muted" : ""}`}
            aria-label={`音量 ${volume}%`}
            title={`音量 ${volume}%`}
            data-player-control
            onClick={(e) => e.stopPropagation()}
          >
            <I.volume size={16} />
          </button>
        </Popover.Trigger>
        <PopoverPopup
          className="mle-bar1__volpop"
          origin="bottom center"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            ref={sliderRef}
            type="range"
            min={0}
            max={100}
            value={volume}
            aria-label="音量"
            onChange={(e) => onSetVolume(Number(e.target.value))}
          />
          <span className="mle-bar1__volval">{volume}</span>
        </PopoverPopup>
      </MotionPopoverRoot>
    </div>
  );
}
