import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "../lib/cn";

export type TextInputFont = "sans" | "jp" | "mono";
export type TextInputSurface = 0 | 1;

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  font?: TextInputFont;
  surface?: TextInputSurface;
  ref?: Ref<HTMLInputElement>;
}

const FONT_CLASS: Record<TextInputFont, string> = {
  sans: "font-sans text-body",
  jp: "font-jp text-body",
  mono: "font-mono text-mono",
};

const SURFACE_CLASS: Record<TextInputSurface, string> = {
  0: "bg-paper-0",
  1: "bg-paper-1",
};

export default function TextInput({
  font = "sans",
  surface = 0,
  className,
  ref,
  ...rest
}: TextInputProps) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-8 w-full min-w-0 rounded-[6px] border border-line px-2.5 text-ink-0",
        "placeholder:text-ink-4 outline-none focus-visible:border-line-strong",
        "disabled:cursor-not-allowed disabled:text-ink-4",
        FONT_CLASS[font],
        SURFACE_CLASS[surface],
        className,
      )}
      {...rest}
    />
  );
}
