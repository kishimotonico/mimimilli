import "@testing-library/jest-dom";

// global.fetch のモック（各テストで vi.mocked(fetch) を使う）
global.fetch = vi.fn();

// happy-dom では Element.scrollTo / scrollIntoView が未定義のため、テスト用にスタブを置く。
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function () {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

// happy-dom では Popover API が未実装のため、Toast の top layer 表示用にスタブする。
if (!HTMLElement.prototype.showPopover) {
  HTMLElement.prototype.showPopover = function () {};
}
if (!HTMLElement.prototype.hidePopover) {
  HTMLElement.prototype.hidePopover = function () {};
}

// happy-dom では ResizeObserver が動作しないため、テスト用に動作する mock を提供する。
// observe() 時に保存したコールバックを通じて、テスト側でサイズを手動注入できる。
class MockResizeObserver implements ResizeObserver {
  private cb: ResizeObserverCallback;
  private observed = new Set<Element>();

  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }

  observe(target: Element) {
    this.observed.add(target);
  }

  unobserve(target: Element) {
    this.observed.delete(target);
  }

  disconnect() {
    this.observed.clear();
  }

  /** テストから呼び出してサイズを注入する */
  flush(entries: { target: Element; contentRect: DOMRectReadOnly }[]) {
    this.cb(entries as unknown as ResizeObserverEntry[], this);
  }

  getObserved(): Element[] {
    return Array.from(this.observed);
  }
}

const observers: MockResizeObserver[] = [];

// @tanstack/react-virtual 等が `new ResizeObserver(...)` できるように class として登録する。
class MockResizeObserverGlobal extends MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    super(cb);
    observers.push(this);
  }
}

global.ResizeObserver = MockResizeObserverGlobal as unknown as typeof ResizeObserver;

export function getResizeObservers(): MockResizeObserver[] {
  return observers;
}

export function flushAllResizeObservers(
  size: { width: number; height: number } = { width: 800, height: 600 },
) {
  observers.forEach((observer) => {
    for (const target of observer.getObserved()) {
      const rect = new DOMRectReadOnly(0, 0, size.width, size.height);
      observer.flush([{ target, contentRect: rect }]);
    }
  });
}

export function clearResizeObservers() {
  observers.length = 0;
}

// コンポーネントテスト用に HTMLElement のレイアウトサイズを偽装する。
// @tanstack/react-virtual の observeElementRect は scrollElement の offsetWidth/Height を読む。
export function mockElementSize(width = 800, height = 600): { restore: () => void } {
  const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  const originalOffsetHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetHeight",
  );
  const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  const originalClientHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientHeight",
  );
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  const isScrollTarget = (el: HTMLElement) =>
    el.classList?.contains("mll-grid") ||
    el.classList?.contains("mll-grid-scroll") ||
    el.classList?.contains("mle-col__list") ||
    el.classList?.contains("mll-qlist__body");

  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: function () {
      if (isScrollTarget(this)) return width;
      return originalOffsetWidth?.get?.call(this) ?? 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: function () {
      if (isScrollTarget(this)) return height;
      return originalOffsetHeight?.get?.call(this) ?? 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: function () {
      if (isScrollTarget(this)) return width;
      return originalClientWidth?.get?.call(this) ?? 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: function () {
      if (isScrollTarget(this)) return height;
      return originalClientHeight?.get?.call(this) ?? 0;
    },
  });
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (isScrollTarget(this)) return new DOMRectReadOnly(0, 0, width, height);
    return originalGetBoundingClientRect.call(this);
  };

  return {
    restore: () => {
      if (originalOffsetWidth) {
        Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
      } else {
        delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetWidth;
      }
      if (originalOffsetHeight) {
        Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
      } else {
        delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetHeight;
      }
      if (originalClientWidth) {
        Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth);
      } else {
        delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
      }
      if (originalClientHeight) {
        Object.defineProperty(HTMLElement.prototype, "clientHeight", originalClientHeight);
      } else {
        delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
      }
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    },
  };
}
