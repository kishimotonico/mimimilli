import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import type { WorksPage } from "@mimimilli/shared";
import type { CollectionStatsDisplay } from "../../model/libraryPresentation";
import { searchWorks } from "../../api";
import { WORK_QUERY_KEYS } from "../../../../entities/work/queryKeys";
import { I } from "../../../../shared/ui/Icon";
import IconButton from "../../../../shared/ui/IconButton";
import CollectionStatus from "../../../../shared/ui/CollectionStatus";
import { formatDuration } from "./format";
import { WorkCardGrid } from "./WorkCard";

const SECTION_LIMIT = 6;
const RANDOM_SEED_MAX = 0x7fffffff;

function randomSeed(): number {
  return Math.floor(Math.random() * RANDOM_SEED_MAX);
}

function DiscoverySection({
  title,
  emptyMessage,
  queryKey,
  queryFn,
  onSelectWork,
  headerAction,
  hideWhenEmpty = false,
}: {
  title: string;
  emptyMessage: string;
  queryKey: readonly unknown[];
  queryFn: () => Promise<WorksPage>;
  onSelectWork: (id: string) => void;
  headerAction?: ReactNode;
  hideWhenEmpty?: boolean;
}) {
  const query = useQuery({ queryKey, queryFn });

  if (hideWhenEmpty && query.isSuccess && query.data.items.length === 0) return null;

  return (
    <div className="mle-discover-sect">
      <div className="mle-sect">
        <span>{title}</span>
        <div className="mle-sect__rule" />
        {headerAction}
      </div>
      {query.isPending ? (
        <CollectionStatus variant="grid" kind="loading" />
      ) : query.isError ? (
        <CollectionStatus variant="grid" kind="error" onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <CollectionStatus variant="grid" kind="empty" message={emptyMessage} />
      ) : (
        <WorkCardGrid works={query.data.items} onSelectWork={onSelectWork} />
      )}
    </div>
  );
}

export function DiscoveryDashboard({
  stats,
  onSelectWork,
}: {
  stats: CollectionStatsDisplay;
  onSelectWork: (id: string) => void;
}) {
  const [randomSeedValue, setRandomSeedValue] = useState(randomSeed);

  return (
    <div className="mle-prv__body">
      <DiscoverySection
        title="最近追加"
        emptyMessage="まだ作品がありません"
        queryKey={WORK_QUERY_KEYS.list({ sort: "added-desc", limit: SECTION_LIMIT })}
        queryFn={() => searchWorks({ sort: "added-desc", limit: SECTION_LIMIT })}
        onSelectWork={onSelectWork}
      />
      <DiscoverySection
        title="最近再生"
        emptyMessage="まだ再生履歴がありません"
        queryKey={WORK_QUERY_KEYS.list({
          sort: "last-played",
          view: "recent",
          limit: SECTION_LIMIT,
        })}
        queryFn={() => searchWorks({ sort: "last-played", view: "recent", limit: SECTION_LIMIT })}
        onSelectWork={onSelectWork}
        hideWhenEmpty
      />
      <DiscoverySection
        title="ランダムピック"
        emptyMessage="まだ作品がありません"
        queryKey={WORK_QUERY_KEYS.list({
          sort: "random",
          limit: SECTION_LIMIT,
          seed: randomSeedValue,
        })}
        queryFn={() => searchWorks({ sort: "random", limit: SECTION_LIMIT, seed: randomSeedValue })}
        onSelectWork={onSelectWork}
        headerAction={
          <IconButton
            icon={I.refresh}
            label="別の作品をピックアップ"
            size="sm"
            onClick={() => setRandomSeedValue(randomSeed())}
          />
        }
      />
      {stats.status === "ready" && (
        <div
          style={{
            textAlign: "center",
            marginTop: 24,
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--ink-3)",
          }}
        >
          {stats.count}作品 · {stats.trackCount}トラック ·{" "}
          {formatDuration(stats.durationSec) ?? "0:00"}
        </div>
      )}
      {stats.status === "error" && (
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 10.5, color: "var(--ink-3)" }}>
          統計の取得に失敗しました
        </div>
      )}
    </div>
  );
}
