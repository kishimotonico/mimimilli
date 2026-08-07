import { type CSSProperties, type ElementType, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { PRESENCE_DURATION_MS } from "./presenceDurations";
import { usePresence, type UsePresenceOptions } from "./usePresence";

export type PresenceVariant =
  | "fade"
  | "fade-slide-up"
  | "collapse"
  | "dock-bar-slide"
  | "dock-bar-switch"
  | "dock-popup-scale"
  | "popover-scale"
  | "colstack-width"
  | "preview-slide";

const VARIANT_CLASS: Record<PresenceVariant, string> = {
  fade: "ml-presence-fade",
  "fade-slide-up": "ml-presence-fade-slide-up",
  collapse: "ml-presence-collapse",
  "dock-bar-slide": "ml-presence-dock-bar",
  "dock-bar-switch": "ml-presence-dock-bar ml-presence-dock-bar--switch",
  "dock-popup-scale": "ml-presence-dock-popup",
  "popover-scale": "ml-presence-popover-scale",
  "colstack-width": "ml-presence-colstack",
  "preview-slide": "ml-presence-preview",
};

export interface PresenceProps extends UsePresenceOptions {
  show: boolean;
  as?: ElementType;
  variant: PresenceVariant;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  type?: "button" | "submit" | "reset";
  title?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  /** 退出中も操作・フォーカス可能なままにしたい場合に true。
   *  既定では show=false の間は inert にする（pointer-events:none だけではキーボード
   *  操作・アクセシビリティツリーからの到達を防げないため）。data-phase ではなく show を
   *  見るのは、退出中に再び show=true になった瞬間（beginEnter が effect で phase を
   *  "enter" へ更新する前の1レンダー）に inert が残ってフォーカスを奪えなくなるのを
   *  避けるため。 */
  keepInteractiveOnExit?: boolean;
}

export default function Presence({
  show,
  as: Component = "div",
  variant,
  className,
  style,
  children,
  skipInitial,
  durationMs,
  onExitComplete,
  type,
  title,
  onClick,
  keepInteractiveOnExit,
}: PresenceProps) {
  const { mounted, phase } = usePresence(show, {
    skipInitial,
    durationMs: durationMs ?? PRESENCE_DURATION_MS[variant],
    onExitComplete,
  });

  if (!mounted) return null;

  return (
    <Component
      data-phase={phase}
      className={cn(VARIANT_CLASS[variant], className)}
      style={style}
      type={type}
      title={title}
      onClick={onClick}
      inert={!show && !keepInteractiveOnExit}
    >
      {variant === "collapse" ? (
        <div className="ml-presence-collapse__inner">{children}</div>
      ) : (
        children
      )}
    </Component>
  );
}
