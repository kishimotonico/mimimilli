import { Component, Suspense, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import type { WorkListItem } from "@mimimilli/shared";
import type { ReadyLibraryViewState } from "../model/useLibraryNavigation";
import type { ResolvedLibraryView } from "../../../entities/library/resolveLibraryView";
import { useSuspenseLibraryWorks } from "../model/useLibraryQueries";
import { folderWorksResetKey } from "../model/folderWorksRequest";
import { computeIsNoResultsDueToFilter } from "../model/libraryPresentation";
import CollectionStatus from "../../../shared/ui/CollectionStatus";

interface WorksResult {
  works: WorkListItem[];
  hasNextPage: boolean;
  worksTotal: number | undefined;
  worksStats: { trackCount: number; durationSec: number } | undefined;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  refetchWorks: () => void;
}

// LibraryWorksBoundary は作品一覧を表示する結果面でのみ使う。値一覧・読めない行は
// works query 自体を発行しないため、呼び出し側（LibraryView）でこの境界に入らない。

type WorksView = Extract<ResolvedLibraryView, { kind: "works" }>;

interface Props {
  nav: ReadyLibraryViewState;
  view: WorksView;
  searchQuery: string;
  viewMode: "list" | "grid";
  isPending: boolean;
  onNoResultsChange: (isNoResults: boolean) => void;
  onWorksTotalChange: (worksTotal: number | undefined) => void;
  children: (result: WorksResult, isPending: boolean) => ReactNode;
}

interface ErrorState {
  error: Error | null;
  resetKey: string;
}

class WorksErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void; variant: "list" | "grid"; resetKey: string },
  ErrorState
> {
  state: ErrorState = { error: null, resetKey: "" };

  static getDerivedStateFromProps(
    props: Readonly<{ resetKey: string }>,
    state: ErrorState,
  ): Partial<ErrorState> | null {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorState> {
    return { error };
  }

  handleRetry = () => {
    this.props.onRetry();
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <CollectionStatus variant={this.props.variant} kind="error" onRetry={this.handleRetry} />
      );
    }
    return this.props.children;
  }
}

function Works(props: Props) {
  return (
    <ResolvedWorks {...props} result={useSuspenseLibraryWorks(props.view, props.searchQuery)} />
  );
}

function ResolvedWorks({
  nav,
  searchQuery,
  isPending,
  onNoResultsChange,
  onWorksTotalChange,
  children,
  result,
}: Props & { result: WorksResult }) {
  const isNoResults = computeIsNoResultsDueToFilter(
    true,
    result.works.length,
    searchQuery,
    nav.selectedTags,
    false,
    false,
  );
  useEffect(() => onNoResultsChange(isNoResults), [isNoResults, onNoResultsChange]);
  useEffect(() => onWorksTotalChange(result.worksTotal), [result.worksTotal, onWorksTotalChange]);
  // アンマウント時（エラー捕捉）は未確定へ戻す。すでに表示済みのSuspense境界が再サスペンド
  // した場合はアンマウントされず非表示のまま保持されるため、その経路はSuspenseフォールバック
  // 側（LoadingFallback）で別途未確定に戻す。startTransition中の再検証（旧一覧を薄表示のまま
  // 保持）では再サスペンドもアンマウントも起きないため、その間は直前の件数を出し続ける
  // （結果面の「旧一覧を保持」と一貫させる）。
  const onWorksTotalChangeRef = useRef(onWorksTotalChange);
  onWorksTotalChangeRef.current = onWorksTotalChange;
  useEffect(() => {
    return () => onWorksTotalChangeRef.current(undefined);
  }, []);
  return <>{children(result, isPending)}</>;
}

/** Suspenseのfallbackとして描画される間、件数を未確定へ戻す。fallback自体はサスペンドしない
 *  通常のコンポーネントなので、表示された瞬間にmount effectが確実に発火する。 */
function LoadingFallback({ variant, onShow }: { variant: "list" | "grid"; onShow: () => void }) {
  useLayoutEffect(() => onShow(), [onShow]);
  return <CollectionStatus variant={variant} kind="loading" />;
}

export default function LibraryWorksBoundary(props: Props) {
  const variant = props.viewMode === "grid" ? "grid" : "list";
  const { view } = props;
  const resetKey = folderWorksResetKey(view, props.searchQuery);
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <WorksErrorBoundary resetKey={resetKey} variant={variant} onRetry={reset}>
          <Suspense
            fallback={
              <LoadingFallback
                variant={variant}
                onShow={() => props.onWorksTotalChange(undefined)}
              />
            }
          >
            <Works {...props} />
          </Suspense>
        </WorksErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
