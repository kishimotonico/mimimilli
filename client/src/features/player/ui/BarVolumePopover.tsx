import { useRef, useState } from "react";
import { I } from "../../../shared/ui/Icon";
import {
  MotionPopoverRoot,
  MotionPopoverTrigger,
  PopoverPopup,
  useMotionPopover,
} from "../../../shared/ui/popover/MotionPopover";

interface BarVolumePopoverProps {
  volume: number;
  onSetVolume: (volume: number) => void;
}

export default function BarVolumePopover({ volume, onSetVolume }: BarVolumePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const sliderRef = useRef<HTMLInputElement>(null);

  const popover = useMotionPopover({
    open: isOpen,
    onOpenChange: ({ open }) => setIsOpen(open),
    positioning: { placement: "top" },
    initialFocusEl: () => sliderRef.current,
    closeOnParentExit: true,
  });

  return (
    <div className="mle-bar1__vol">
      <MotionPopoverRoot handle={popover}>
        <MotionPopoverTrigger>
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
        </MotionPopoverTrigger>
        <PopoverPopup className="mle-bar1__volpop" aria-label="音量">
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
