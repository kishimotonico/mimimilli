// 設定モーダル内の「タグ設定」セクション（ADR-0005）。
// prefix 定義の一覧・トグル編集・削除・新規追加と、データ中の未登録 prefix からの
// ワンクリック登録（candidates）を提供する。データ取得・更新はこのコンポーネントで完結させる。
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TagPrefixCreate, TagPrefixUpdate } from "@mimimilli/shared";
import {
  createTagPrefix,
  deleteTagPrefix,
  listTagPrefixCandidates,
  listTagPrefixes,
  updateTagPrefix,
} from "../../../entities/tag/api";
import { TAG_QUERY_KEYS } from "../../../entities/tag/queryKeys";
import { I } from "../../../shared/ui/Icon";

const SECTION_LABEL_CLASS =
  "font-sans text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase";

const TOGGLE_LABEL_CLASS =
  "inline-flex items-center gap-1 font-sans text-[11px] text-ink-2 cursor-pointer whitespace-nowrap";

const INPUT_CLASS =
  "h-[30px] min-w-0 flex-1 rounded-[6px] border border-line-soft bg-paper-0 px-2.5 font-jp text-[11.5px] text-ink-1";

export default function TagPrefixSettings() {
  const queryClient = useQueryClient();
  const [newPrefix, setNewPrefix] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const prefixesQuery = useQuery({
    queryKey: TAG_QUERY_KEYS.prefixes(),
    queryFn: listTagPrefixes,
  });
  const candidatesQuery = useQuery({
    queryKey: TAG_QUERY_KEYS.prefixCandidates(),
    queryFn: listTagPrefixCandidates,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: TAG_QUERY_KEYS.prefixes() });
  };

  const createMutation = useMutation({
    mutationFn: (input: TagPrefixCreate) => createTagPrefix(input),
    onSuccess: async () => {
      setError(null);
      setNewPrefix("");
      setNewLabel("");
      await invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "prefix を追加できませんでした"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ prefix, patch }: { prefix: string; patch: TagPrefixUpdate }) =>
      updateTagPrefix(prefix, patch),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "prefix を更新できませんでした"),
  });

  const deleteMutation = useMutation({
    mutationFn: (prefix: string) => deleteTagPrefix(prefix),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "prefix を削除できませんでした"),
  });

  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const prefixes = prefixesQuery.data ?? [];
  const candidates = candidatesQuery.data ?? [];

  const submitNew = () => {
    const prefix = newPrefix.trim();
    if (!prefix) return;
    createMutation.mutate({
      prefix,
      label: newLabel.trim() || prefix,
      color: null,
      showAsAxis: true,
      protected: false,
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <span className={SECTION_LABEL_CLASS}>タグ設定（prefix 定義）</span>

      {/* 定義一覧 */}
      <div className="flex max-h-[180px] flex-col overflow-y-auto rounded-[6px] border border-line-soft bg-paper-0">
        {prefixes.length === 0 && (
          <span className="px-3 py-2.5 text-[11.5px] text-ink-3">prefix 定義がありません</span>
        )}
        {prefixes.map((p) => (
          <div
            key={p.prefix}
            className="flex items-center gap-2.5 border-b border-line-soft px-2.5 py-1.5"
          >
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-ink-1">
              {p.label}
              <span className="ml-1.5 font-mono text-[10px] text-ink-3">{p.prefix}/</span>
            </span>
            <label className={TOGGLE_LABEL_CLASS}>
              <input
                type="checkbox"
                checked={p.showAsAxis}
                disabled={isMutating}
                onChange={(e) =>
                  updateMutation.mutate({
                    prefix: p.prefix,
                    patch: { showAsAxis: e.target.checked },
                  })
                }
              />
              軸
            </label>
            <label className={TOGGLE_LABEL_CLASS}>
              <input
                type="checkbox"
                checked={p.protected}
                disabled={isMutating}
                onChange={(e) =>
                  updateMutation.mutate({
                    prefix: p.prefix,
                    patch: { protected: e.target.checked },
                  })
                }
              />
              保護
            </label>
            <button
              type="button"
              aria-label={`prefix「${p.prefix}」を削除`}
              disabled={isMutating}
              onClick={() => deleteMutation.mutate(p.prefix)}
              className="grid h-[22px] w-[22px] cursor-pointer place-items-center rounded-[4px] border-none bg-transparent text-ink-3 disabled:cursor-not-allowed"
            >
              <I.x size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* 新規追加 */}
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          submitNew();
        }}
      >
        <input
          value={newPrefix}
          onChange={(e) => setNewPrefix(e.target.value)}
          aria-label="新しい prefix"
          placeholder="prefix（例: 気分）"
          className={INPUT_CLASS}
        />
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          aria-label="表示ラベル"
          placeholder="ラベル（省略可）"
          className={INPUT_CLASS}
        />
        <button
          type="submit"
          disabled={!newPrefix.trim() || isMutating}
          className="h-[30px] cursor-pointer rounded-[6px] border border-line bg-paper-1 px-3 font-sans text-[12px] font-medium whitespace-nowrap text-ink-1 disabled:cursor-not-allowed"
        >
          追加
        </button>
      </form>

      {/* 未登録 prefix のサジェスト */}
      {candidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] text-ink-3">データ内の未登録 prefix:</span>
          {candidates.map((c) => (
            <button
              key={c.prefix}
              type="button"
              disabled={isMutating}
              onClick={() =>
                createMutation.mutate({
                  prefix: c.prefix,
                  label: c.prefix,
                  color: null,
                  showAsAxis: true,
                  protected: false,
                })
              }
              title={`「${c.prefix}/」を prefix 定義に登録`}
              className="inline-flex h-[22px] cursor-pointer items-center gap-1 rounded-[11px] border border-dashed border-line bg-paper-0 px-2 font-jp text-[10.5px] text-ink-2 disabled:cursor-not-allowed"
            >
              <I.add size={10} />
              {c.prefix}
              <span className="font-mono text-ink-3">{c.count}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mll-selectable m-0 text-[11px] text-[var(--r-coral)]">
          {error}
        </p>
      )}
    </div>
  );
}
