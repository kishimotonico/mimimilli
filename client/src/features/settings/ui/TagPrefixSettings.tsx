// 設定モーダル内の「タグ設定」セクション（ADR-0005）。
// prefix 定義の一覧・ラベル/色/並び順の編集・削除・新規追加と、データ中の未登録 prefix からの
// ワンクリック登録（candidates）を提供する。データ取得・更新はこのコンポーネントで完結させる。
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TagPrefix, TagPrefixColorKey } from "@mimimilli/shared";
import {
  createTagPrefix,
  deleteTagPrefix,
  listTagPrefixCandidates,
  listTagPrefixes,
  reorderTagPrefixes,
  updateTagPrefix,
} from "../../../entities/tag/api";
import { TAG_QUERY_KEYS } from "../../../entities/tag/queryKeys";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import { useToast } from "../../../shared/ui/useToast";
import { I } from "../../../shared/ui/Icon";
import TagPrefixAddForm from "./TagPrefixAddForm";
import TagPrefixRow from "./TagPrefixRow";

const SECTION_LABEL_CLASS =
  "font-sans text-label font-semibold tracking-[0.08em] text-ink-2 uppercase";

export default function TagPrefixSettings() {
  const queryClient = useQueryClient();
  const [newPrefix, setNewPrefix] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<TagPrefixColorKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const [editingPrefix, setEditingPrefix] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TagPrefix | null>(null);
  const editingLabelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingPrefix !== null) editingLabelInputRef.current?.focus();
  }, [editingPrefix]);

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
    mutationFn: (input: Parameters<typeof createTagPrefix>[0]) => createTagPrefix(input),
    onSuccess: async (created) => {
      setError(null);
      setNewPrefix("");
      setNewLabel("");
      setNewColor(null);
      toast.show({
        message: `prefix「${created.label}」を追加しました`,
        variant: "info",
        priority: "action",
      });
      await invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, "prefix を追加できませんでした")),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      prefix,
      patch,
    }: {
      prefix: string;
      patch: Parameters<typeof updateTagPrefix>[1];
    }) => updateTagPrefix(prefix, patch),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, "prefix を更新できませんでした")),
  });

  // 全 prefix の順序を一括・アトミックに送る（PUT /tag-prefixes/order）。
  // 隣接2件だけPATCHで交換する方式は片方だけ失敗すると order が重複したまま残るため採らない。
  const reorderMutation = useMutation({
    mutationFn: (order: string[]) => reorderTagPrefixes(order),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, "並び順を変更できませんでした")),
  });

  const deleteMutation = useMutation({
    mutationFn: (prefix: string) => deleteTagPrefix(prefix),
    onSuccess: async (_void, prefix) => {
      setError(null);
      toast.show({
        message: `prefix「${prefix}」を削除しました`,
        variant: "info",
        priority: "action",
      });
      await invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, "prefix を削除できませんでした")),
  });

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    reorderMutation.isPending ||
    deleteMutation.isPending;
  const prefixes = prefixesQuery.data ?? [];
  const candidates = candidatesQuery.data ?? [];

  const swapOrder = (index: number, otherIndex: number) => {
    const order = prefixes.map((p) => p.prefix);
    [order[index], order[otherIndex]] = [order[otherIndex]!, order[index]!];
    reorderMutation.mutate(order);
  };

  const submitNew = () => {
    const prefix = newPrefix.trim();
    if (!prefix) return;
    createMutation.mutate({
      prefix,
      label: newLabel.trim() || prefix,
      color: newColor,
      showAsAxis: true,
      protected: false,
    });
  };

  const startEditLabel = (p: TagPrefix) => {
    setEditingPrefix(p.prefix);
    setEditingLabel(p.label);
  };

  const commitEditLabel = (p: TagPrefix) => {
    const label = editingLabel.trim();
    setEditingPrefix(null);
    if (!label || label === p.label) return;
    updateMutation.mutate({ prefix: p.prefix, patch: { label } });
  };

  return (
    <div className="flex flex-col gap-2">
      <span className={SECTION_LABEL_CLASS}>タグ設定（prefix 定義）</span>

      {/* 定義一覧（設定モーダルの本文スクロールに一本化。ここでは内側スクロールを持たない） */}
      <div className="flex flex-col rounded-[6px] border border-line-soft bg-paper-0">
        {prefixes.length === 0 && (
          <span className="px-3 py-2.5 text-secondary text-ink-2">prefix 定義がありません</span>
        )}
        {prefixes.map((p, index) => (
          <TagPrefixRow
            key={p.prefix}
            prefix={p}
            isEditing={editingPrefix === p.prefix}
            editingLabel={editingLabel}
            editingLabelInputRef={editingLabelInputRef}
            isMutating={isMutating}
            moveUpDisabled={isMutating || index === 0}
            moveDownDisabled={isMutating || index === prefixes.length - 1}
            onMoveUp={() => swapOrder(index, index - 1)}
            onMoveDown={() => swapOrder(index, index + 1)}
            onStartEditLabel={() => startEditLabel(p)}
            onEditingLabelChange={setEditingLabel}
            onCommitEditLabel={() => commitEditLabel(p)}
            onCancelEditLabel={() => setEditingPrefix(null)}
            onColorChange={(color) => updateMutation.mutate({ prefix: p.prefix, patch: { color } })}
            onShowAsAxisChange={(showAsAxis) =>
              updateMutation.mutate({ prefix: p.prefix, patch: { showAsAxis } })
            }
            onProtectedChange={(isProtected) =>
              updateMutation.mutate({ prefix: p.prefix, patch: { protected: isProtected } })
            }
            onRequestDelete={() => setDeleteTarget(p)}
          />
        ))}
      </div>

      {/* 新規追加 */}
      <TagPrefixAddForm
        prefix={newPrefix}
        label={newLabel}
        color={newColor}
        isMutating={isMutating}
        onPrefixChange={setNewPrefix}
        onLabelChange={setNewLabel}
        onColorChange={setNewColor}
        onSubmit={submitNew}
      />

      {/* 未登録 prefix のサジェスト */}
      {candidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-caption text-ink-2">データ内の未登録 prefix:</span>
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
              className="inline-flex h-[22px] cursor-pointer items-center gap-1 rounded-[11px] border border-dashed border-line bg-paper-0 px-2 font-jp text-control text-ink-2 disabled:cursor-not-allowed"
            >
              <I.add size={10} />
              {c.prefix}
              <span className="font-mono text-ink-2">{c.count}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mll-selectable m-0 text-secondary text-[var(--r-coral)]">
          {error}
        </p>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`prefix「${deleteTarget.label}」を削除`}
          message={`この prefix 定義を削除します。作品に付いた ${deleteTarget.prefix}/ タグ自体は消えませんが、軸レールへの表示・専用色・保護設定は失われます。`}
          confirmLabel="削除する"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            deleteMutation.mutate(deleteTarget.prefix);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}
