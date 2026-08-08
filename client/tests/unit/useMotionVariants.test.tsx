import { act, render, renderHook } from "@testing-library/react";
import { AnimatePresence, motion } from "motion/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  collapseVariant,
  colstackWidthVariant,
  dockBarSlideVariant,
  dockBarSwitchVariant,
  dockPopupScaleVariant,
  fadeSlideUpVariant,
  fadeVariant,
  popoverScaleVariant,
  previewSlideVariant,
  useMotionVariants,
} from "../../src/shared/ui/useMotionVariants";
import { setMatchMediaReducedMotion } from "./setup";

describe("motion variant builders: reduced=false は duration>0", () => {
  it.each([
    ["fade", () => fadeVariant(false)],
    ["fadeSlideUp", () => fadeSlideUpVariant(false)],
    ["collapse", () => collapseVariant(false)],
    ["dockBarSlide", () => dockBarSlideVariant(false)],
    ["dockBarSwitch", () => dockBarSwitchVariant(false, { waitEnter: true })],
    ["dockPopupScale", () => dockPopupScaleVariant(false, { waitEnter: true })],
    ["popoverScale", () => popoverScaleVariant(false, { origin: "top left" })],
    ["colstackWidth", () => colstackWidthVariant(false)],
    ["previewSlide", () => previewSlideVariant(false)],
  ])("%s", (_name, build) => {
    const variant = build();
    const animateTransition = (variant.animate as { transition?: Record<string, unknown> })
      .transition;
    expect(animateTransition).toBeTruthy();
    for (const timing of Object.values(animateTransition!) as { duration: number }[]) {
      expect(timing.duration).toBeGreaterThan(0);
    }
  });
});

describe("motion variant builders: exit は全variantで pointerEvents:none をbakeする", () => {
  it.each([
    ["fade", () => fadeVariant(false)],
    ["fadeSlideUp", () => fadeSlideUpVariant(false)],
    ["collapse", () => collapseVariant(false)],
    ["dockBarSlide", () => dockBarSlideVariant(false)],
    ["dockBarSwitch", () => dockBarSwitchVariant(false)],
    ["dockPopupScale", () => dockPopupScaleVariant(false)],
    ["popoverScale", () => popoverScaleVariant(false, { origin: "top left" })],
    ["colstackWidth", () => colstackWidthVariant(false)],
    ["previewSlide", () => previewSlideVariant(false)],
  ])("%s", (_name, build) => {
    const variant = build();
    expect((variant.exit as { pointerEvents?: string }).pointerEvents).toBe("none");
  });
});

describe("motion variant builders: reduced=true は全variantのduration/delayが0になる", () => {
  it.each([
    ["fade", () => fadeVariant(true)],
    ["fadeSlideUp", () => fadeSlideUpVariant(true)],
    ["collapse", () => collapseVariant(true)],
    ["dockBarSlide", () => dockBarSlideVariant(true)],
    ["dockBarSwitch", () => dockBarSwitchVariant(true, { waitEnter: true })],
    ["dockPopupScale", () => dockPopupScaleVariant(true, { waitEnter: true })],
    ["popoverScale", () => popoverScaleVariant(true, { origin: "top left" })],
    ["colstackWidth", () => colstackWidthVariant(true)],
    ["previewSlide", () => previewSlideVariant(true)],
  ])("%s", (_name, build) => {
    const variant = build();
    for (const phase of [variant.initial, variant.animate, variant.exit]) {
      const transition = (phase as { transition?: Record<string, unknown> }).transition;
      if (!transition) continue;
      for (const timing of Object.values(transition) as { duration: number; delay?: number }[]) {
        expect(timing.duration).toBe(0);
        expect(timing.delay ?? 0).toBe(0);
      }
    }
  });
});

describe("useMotionVariants", () => {
  afterEach(() => {
    setMatchMediaReducedMotion(false);
  });

  it("OS設定がreduceのとき reduced=true になり、builderが0duration/delayを返す", () => {
    setMatchMediaReducedMotion(true);
    const { result } = renderHook(() => useMotionVariants());

    expect(result.current.reduced).toBe(true);
    const variant = result.current.dockBarSwitch({ waitEnter: true });
    const animateTransition = (
      variant.animate as { transition: Record<string, { duration: number; delay?: number }> }
    ).transition;
    expect(animateTransition.y.duration).toBe(0);
    expect(animateTransition.y.delay ?? 0).toBe(0);
  });

  it("OS設定が既定(reduceでない)とき reduced=false になる", () => {
    setMatchMediaReducedMotion(false);
    const { result } = renderHook(() => useMotionVariants());

    expect(result.current.reduced).toBe(false);
    const variant = result.current.fade();
    const animateTransition = (
      variant.animate as { transition: Record<string, { duration: number }> }
    ).transition;
    expect(animateTransition.opacity.duration).toBeGreaterThan(0);
  });
});

describe("collapse variant: 単体での動作確認", () => {
  it("AnimatePresenceの中でmotion.divとして描画でき、開閉状態を切り替えられる", async () => {
    function Collapsible({ open }: { open: boolean }) {
      const { collapse } = useMotionVariants();
      return (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="panel"
              data-testid="panel"
              style={{ overflow: "hidden" }}
              className="flex flex-col gap-1.5"
              initial={collapse().initial}
              animate={collapse().animate}
              exit={collapse().exit}
            >
              <span>中身</span>
            </motion.div>
          )}
        </AnimatePresence>
      );
    }

    const { rerender, queryByTestId } = render(<Collapsible open={false} />);
    expect(queryByTestId("panel")).toBeNull();

    rerender(<Collapsible open={true} />);
    expect(queryByTestId("panel")).not.toBeNull();

    await act(async () => {
      rerender(<Collapsible open={false} />);
    });
  });
});
