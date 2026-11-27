import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scanJobStoreAtom } from "../../src/entities/scan/model/scanJobStore";
import ScanSidebar from "../../src/features/scan/ui/scanModal/ScanSidebar";
import { buildScanJobSnapshot } from "../helpers/builders";
import { createFakeScanJobStore } from "../helpers/fakeJobStores";

afterEach(cleanup);

function setup() {
  const scanJob = createFakeScanJobStore();
  const store = createStore();
  store.set(scanJobStoreAtom, scanJob);
  const onStart = vi.fn();
  render(
    <JotaiProvider store={store}>
      <button type="button">外</button>
      <ScanSidebar
        active={null}
        onSelect={() => {}}
        counts={{ unregistered: 0, needsAttention: 0, newWorks: 0, updated: 0 }}
        lastScanTime={null}
        scanPending={false}
        onStart={onStart}
        onFullScan={() => {}}
        onCancel={() => {}}
      />
    </JotaiProvider>,
  );
  const setStatus = (status: "running" | "cancelling" | "completed" | "cancelled") =>
    act(() => scanJob.setState((state) => ({ ...state, job: buildScanJobSnapshot({ status }) })));
  const startButton = () => screen.getByRole("button", { name: "スキャン", hidden: false });
  const cancelButton = () => screen.getByRole("button", { name: "スキャンを中止" });
  return { setStatus, startButton, cancelButton };
}

describe("ScanSidebar の開始・中止ボタンのフォーカス", () => {
  it("開始して中止ボタンに入れ替わると、フォーカスが中止ボタンへ移る", async () => {
    const { setStatus, startButton, cancelButton } = setup();
    startButton().focus();
    setStatus("running");
    await waitFor(() => expect(cancelButton()).toHaveFocus());
  });

  it("中止ボタンからの入れ替わり（中止の完了・自然完了）で、フォーカスが開始ボタンへ移る", async () => {
    for (const end of ["cancelled", "completed"] as const) {
      cleanup();
      const { setStatus, startButton, cancelButton } = setup();
      setStatus("running");
      cancelButton().focus();
      setStatus("cancelling");
      expect(cancelButton()).toHaveFocus();
      setStatus(end);
      await waitFor(() => expect(startButton()).toHaveFocus());
    }
  });

  it("フォーカスが外にあるときは奪わない", async () => {
    const { setStatus, startButton, cancelButton } = setup();
    startButton().focus();
    screen.getByRole("button", { name: "外" }).focus();
    setStatus("running");
    await waitFor(() => expect(cancelButton()).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "外" })).toHaveFocus();
    setStatus("completed");
    await waitFor(() => expect(startButton()).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "外" })).toHaveFocus();
  });
});
