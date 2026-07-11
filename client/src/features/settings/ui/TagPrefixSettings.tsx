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
} from "../../library/api";
import { LIBRARY_KEYS } from "../../library/model/queryKeys";
import { I } from "../../../shared/ui/Icon";

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.08em",
  color: "var(--ink-3)",
  textTransform: "uppercase",
};

const TOGGLE_LABEL_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontFamily: "var(--font-sans)",
  fontSize: 11,
  color: "var(--ink-2)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export default function TagPrefixSettings() {
  const queryClient = useQueryClient();
  const [newPrefix, setNewPrefix] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const prefixesQuery = useQuery({
    queryKey: LIBRARY_KEYS.tagPrefixes(),
    queryFn: listTagPrefixes,
  });
  const candidatesQuery = useQuery({
    queryKey: LIBRARY_KEYS.tagPrefixCandidates(),
    queryFn: listTagPrefixCandidates,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: LIBRARY_KEYS.tagPrefixes() });
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={SECTION_LABEL_STYLE}>タグ設定（prefix 定義）</span>

      {/* 定義一覧 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          border: "1px solid var(--line-soft)",
          borderRadius: 6,
          background: "var(--paper-0)",
          maxHeight: 180,
          overflowY: "auto",
        }}
      >
        {prefixes.length === 0 && (
          <span style={{ padding: "10px 12px", fontSize: 11.5, color: "var(--ink-3)" }}>
            prefix 定義がありません
          </span>
        )}
        {prefixes.map((p) => (
          <div
            key={p.prefix}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 10px",
              borderBottom: "1px solid var(--line-soft)",
            }}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 12,
                color: "var(--ink-1)",
              }}
            >
              {p.label}
              <span
                style={{
                  marginLeft: 6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--ink-3)",
                }}
              >
                {p.prefix}/
              </span>
            </span>
            <label style={TOGGLE_LABEL_STYLE}>
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
            <label style={TOGGLE_LABEL_STYLE}>
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
              style={{
                width: 22,
                height: 22,
                display: "grid",
                placeItems: "center",
                borderRadius: 4,
                border: "none",
                background: "none",
                color: "var(--ink-3)",
                cursor: isMutating ? "not-allowed" : "pointer",
              }}
            >
              <I.x size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* 新規追加 */}
      <form
        style={{ display: "flex", alignItems: "center", gap: 6 }}
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
          style={{
            flex: 1,
            minWidth: 0,
            height: 30,
            padding: "0 10px",
            background: "var(--paper-0)",
            border: "1px solid var(--line-soft)",
            borderRadius: 6,
            fontFamily: "var(--font-jp)",
            fontSize: 11.5,
            color: "var(--ink-1)",
          }}
        />
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          aria-label="表示ラベル"
          placeholder="ラベル（省略可）"
          style={{
            flex: 1,
            minWidth: 0,
            height: 30,
            padding: "0 10px",
            background: "var(--paper-0)",
            border: "1px solid var(--line-soft)",
            borderRadius: 6,
            fontFamily: "var(--font-jp)",
            fontSize: 11.5,
            color: "var(--ink-1)",
          }}
        />
        <button
          type="submit"
          disabled={!newPrefix.trim() || isMutating}
          style={{
            height: 30,
            padding: "0 12px",
            borderRadius: 6,
            border: "1px solid var(--line)",
            background: "var(--paper-1)",
            color: "var(--ink-1)",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 500,
            cursor: !newPrefix.trim() || isMutating ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          追加
        </button>
      </form>

      {/* 未登録 prefix のサジェスト */}
      {candidates.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>データ内の未登録 prefix:</span>
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
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 22,
                padding: "0 8px",
                borderRadius: 11,
                border: "1px dashed var(--line)",
                background: "var(--paper-0)",
                color: "var(--ink-2)",
                fontFamily: "var(--font-jp)",
                fontSize: 10.5,
                cursor: isMutating ? "not-allowed" : "pointer",
              }}
            >
              <I.add size={10} />
              {c.prefix}
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>
                {c.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" style={{ margin: 0, fontSize: 11, color: "var(--r-coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
