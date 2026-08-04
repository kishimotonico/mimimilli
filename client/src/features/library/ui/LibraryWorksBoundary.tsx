import { Component, Suspense, useEffect, type ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import type { WorkListItem } from "@mimimilli/shared";
import type { LibraryViewState } from "../model/useLibraryNavigation";
import { isSmartAxis } from "../model/axisDefinitions";
import {
  useSuspenseNormalLibraryWorks,
  useSuspenseSmartLibraryWorks,
} from "../model/useLibraryQueries";
import { computeIsNoResultsDueToFilter, isWorksGridActive } from "../model/libraryPresentation";
import CollectionStatus from "./CollectionStatus";

interface WorksResult {
  works: WorkListItem[];
  worksParams: unknown;
  hasNextPage: boolean;
  worksTotal: number | undefined;
  worksStats: { trackCount: number; durationSec: number } | undefined;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  refetchWorks: () => void;
}

// LibraryWorksBoundary は「作品一覧を表示する結果面」（ビュー軸・スマートフォルダー軸）
// でのみ使う。facet/tag 軸の値一覧・home 軸は works query 自体を発行しないため、
// 呼び出し側（LibraryView）でこの境界に入らない。

interface Props {
  nav: LibraryViewState;
  searchQuery: string;
  viewMode: "list" | "grid";
  isPending: boolean;
  onNoResultsChange: (isNoResults: boolean) => void;
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

function NormalWorks(props: Props) {
  return (
    <ResolvedWorks
      {...props}
      result={useSuspenseNormalLibraryWorks(props.nav, props.searchQuery)}
    />
  );
}

function SmartWorks(props: Props) {
  return <ResolvedWorks {...props} result={useSuspenseSmartLibraryWorks(props.nav)} />;
}

function ResolvedWorks({
  nav,
  searchQuery,
  isPending,
  onNoResultsChange,
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
  return <>{children(result, isPending)}</>;
}

export default function LibraryWorksBoundary(props: Props) {
  const variant = isWorksGridActive(props.nav.activeAxis, props.viewMode) ? "grid" : "list";
  const resetKey = JSON.stringify({
    axis: props.nav.activeAxis,
    tags: props.nav.selectedTags,
    sort: props.nav.sort,
    search: props.searchQuery,
  });
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <WorksErrorBoundary resetKey={resetKey} variant={variant} onRetry={reset}>
          <Suspense fallback={<CollectionStatus variant={variant} kind="loading" />}>
            {isSmartAxis(props.nav.activeAxis) ? (
              <SmartWorks {...props} />
            ) : (
              <NormalWorks {...props} />
            )}
          </Suspense>
        </WorksErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
