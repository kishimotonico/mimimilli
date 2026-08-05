import { type ElementType, type ReactNode } from "react";
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
  | "colstack-width"
  | "preview-slide";

const VARIANT_CLASS: Record<PresenceVariant, string> = {
  fade: "ml-presence-fade",
  "fade-slide-up": "ml-presence-fade-slide-up",
  collapse: "ml-presence-collapse",
  "dock-bar-slide": "ml-presence-dock-bar",
  "dock-bar-switch": "ml-presence-dock-bar ml-presence-dock-bar--switch",
  "dock-popup-scale": "ml-presence-dock-popup",
  "colstack-width": "ml-presence-colstack",
  "preview-slide": "ml-presence-preview",
};

export interface PresenceProps extends UsePresenceOptions {
  show: boolean;
  as?: ElementType;
  variant: PresenceVariant;
  className?: string;
  children: ReactNode;
  type?: "button" | "submit" | "reset";
  title?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
}

export default function Presence({
  show,
  as: Component = "div",
  variant,
  className,
  children,
  skipInitial,
  durationMs,
  onExitComplete,
  type,
  title,
  onClick,
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
      type={type}
      title={title}
      onClick={onClick}
    >
      {variant === "collapse" ? (
        <div className="ml-presence-collapse__inner">{children}</div>
      ) : (
        children
      )}
    </Component>
  );
}
