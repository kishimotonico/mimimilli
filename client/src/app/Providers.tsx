import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Provider as JotaiProvider, useSetAtom } from "jotai";
import { lazy, Suspense, useCallback, type ReactNode } from "react";
import DlsiteBulkRuntime from "../features/dlsite/ui/DlsiteBulkRuntime";
import DlsiteBulkApplyRuntime from "../features/dlsite/ui/DlsiteBulkApplyRuntime";
import ScanRuntime from "../features/scan/ui/ScanRuntime";
import { PlayerRuntimeProvider } from "../features/player/model/PlayerRuntimeProvider";
import { queryClient } from "./model/queryClient";
import { useRootReconfiguringApiErrorHandler } from "./model/useRootReconfiguringApiErrorHandler";
import { reconfigurationExitEpochAtom } from "../entities/settings/reconfigurationExitAtom";

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

// useRootReconfiguringApiErrorHandlerはreconfigurationExitEpochAtomを書くため、
// JotaiProviderの内側（子として）でマウントする必要がある。Providers自身の関数本体は
// 自分が返すJotaiProviderの外側にあたるので、ここで呼んではいけない。
function RootApiErrorSubscription() {
  const client = useQueryClient();
  const bumpReconfigurationExitEpoch = useSetAtom(reconfigurationExitEpochAtom);
  const onRootReconfiguring = useCallback(
    () => bumpReconfigurationExitEpoch((epoch) => epoch + 1),
    [bumpReconfigurationExitEpoch],
  );
  useRootReconfiguringApiErrorHandler(client, onRootReconfiguring);
  return null;
}

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
        <RootApiErrorSubscription />
        <PlayerRuntimeProvider>
          <DlsiteBulkRuntime />
          <DlsiteBulkApplyRuntime />
          <ScanRuntime />
          {children}
          {ReactQueryDevtools && (
            <Suspense fallback={null}>
              {/* 既定の bottom-right だとプレイヤーのバー/ポップアップと重なるため左下に配置する */}
              <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
            </Suspense>
          )}
        </PlayerRuntimeProvider>
      </JotaiProvider>
    </QueryClientProvider>
  );
}
