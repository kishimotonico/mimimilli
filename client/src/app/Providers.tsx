import { QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { lazy, Suspense, type ReactNode } from "react";
import { queryClient } from "../shared/api/queryClient";

interface ProvidersProps {
  children: ReactNode;
}

// 開発時のみ devtools を遅延ロードする。
// import.meta.env.DEV は本番ビルドで静的に false になり、この dynamic import 自体が
// dead-code-elimination されるため、本番バンドルには含まれない。
// VITE_DISABLE_QUERY_DEVTOOLS=1 で明示的に無効化できる（ビジュアルテスト等、
// 画面右下のトグルボタンがスクリーンショットに写り込むと困る場面向け。
// playwright.config.ts の webServer がこのフラグを立てて起動する）。
const ReactQueryDevtools =
  import.meta.env.DEV && import.meta.env.VITE_DISABLE_QUERY_DEVTOOLS !== "1"
    ? lazy(() =>
        import("@tanstack/react-query-devtools").then((m) => ({
          default: m.ReactQueryDevtools,
        })),
      )
    : null;

/**
 * アプリ全体の Provider をまとめたコンポーネント。
 *
 * 責務:
 * - QueryClientProvider: TanStack Query（server state）
 * - JotaiProvider: Jotai（client/UI state）
 * - ReactQueryDevtools: 開発時のみ描画
 *
 * 依存方向:
 * - JotaiProvider を QueryClientProvider の内側に置くことで、将来 Query 結果を
 *   参照する場面でも両方を同じツリーで使えるようにしている。derived atom 内での
 *   Query 結合は当面行わない（issue 参照）。
 */
export default function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <JotaiProvider>
        {children}
        {ReactQueryDevtools && (
          <Suspense fallback={null}>
            {/* 既定の bottom-right だとプレイヤーのバー/ポップアップと重なるため左下に配置する */}
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
          </Suspense>
        )}
      </JotaiProvider>
    </QueryClientProvider>
  );
}
