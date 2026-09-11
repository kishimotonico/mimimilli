// 設定モーダル内の「タグ設定」セクション（ADR-0005）。
// prefix 定義の一覧・ラベル/色/並び順の編集・削除・新規追加と、データ中の未登録 prefix からの
// ワンクリック登録（candidates）を提供する。データ取得・更新はこのコンポーネントで完結させる。
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TAG_PREFIX_COLOR_KEYS, type TagPrefix, type TagPrefixColorKey } from "@mimimilli/shared";
import {
  createTagPrefix,
  deleteTagPrefix,
  listTagPrefixCandidates,
  listTagPrefixes,
  reorderTagPrefixes,
  updateTagPrefix,
} from "../../../entities/tag/api";
import { TAG_QUERY_KEYS } from "../../../entities/tag/queryKeys";
import { tagPrefixColorToCss } from "../../../entities/work/tagPrefixColor";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import IconButton from "../../../shared/ui/IconButton";
import { useToast } from "../../../shared/ui/useToast";
import { I } from "../../../shared/ui/Icon";

const SECTION_LABEL_CLASS =
  "font-sans text-label font-semibold tracking-[0.08em] text-ink-2 uppercase";

const TOGGLE_LABEL_CLASS =
  "inline-flex items-center gap-1 font-sans text-secondary text-ink-2 cursor-pointer whitespace-nowrap";

const INPUT_CLASS =
  "h-[30px] min-w-0 flex-1 rounded-[6px] border border-line-soft bg-paper-0 px-2.5 font-jp text-secondary text-ink-1 focus-visible:border-line-strong";

/** 行の上移動・下移動・削除ボタン共通。通常時は控えめな色、hover/focus時だけ濃くする */
const ROW_ICON_CLASS = "text-ink-3 hover:text-ink-1 focus-visible:text-ink-1";

/** 保護中の prefix を削除できない理由。削除ボタンの title に出す */
const PROTECTED_DELETE_TITLE =
  "保護中のprefixは削除できません。削除するには「保護」のチェックを外してください";

function ColorSwatches({
  value,
  onChange,
  disabled,
}: {
  value: TagPrefixColorKey | null;
  onChange: (color: TagPrefixColorKey | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="色なし"
        aria-pressed={value === null}
        title="色なし"
        disabled={disabled}
        onClick={() => onChange(null)}
        className="grid h-4 w-4 shrink-0 cursor-pointer place-items-center rounded-full border border-dashed border-line bg-transparent p-0 disabled:cursor-not-allowed"
      >
        {value === null && <I.check size={9} className="text-ink-2" />}
      </button>
      {TAG_PREFIX_COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={`色: ${key}`}
          aria-pressed={value === key}
          title={key}
          disabled={disabled}
          onClick={() => onChange(key)}
          style={{ backgroundColor: tagPrefixColorToCss(key) }}
          className="grid h-4 w-4 shrink-0 cursor-pointer place-items-center rounded-full border border-line-soft p-0 disabled:cursor-not-allowed"
        >
          {value === key && <I.check size={9} className="text-paper-1" />}
        </button>
      ))}
    </div>
  );
}

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
        {prefixes.map((p, index) => {
          const moveUpDisabled = isMutating || index === 0;
          const moveDownDisabled = isMutating || index === prefixes.length - 1;
          const deleteDisabled = isMutating || p.protected;
          return (
            <div
              key={p.prefix}
              className="flex items-center gap-2 border-b border-line-soft px-2.5 py-1.5 last:border-b-0"
            >
              <div className="flex shrink-0 flex-col">
                <IconButton
                  icon={I.chevD}
                  label={`「${p.label}」を上へ移動`}
                  size="xs"
                  className={`h-[13px] rotate-180${moveUpDisabled ? "" : ` ${ROW_ICON_CLASS}`}`}
                  disabled={moveUpDisabled}
                  onClick={() => swapOrder(index, index - 1)}
                />
                <IconButton
                  icon={I.chevD}
                  label={`「${p.label}」を下へ移動`}
                  size="xs"
                  className={`h-[13px]${moveDownDisabled ? "" : ` ${ROW_ICON_CLASS}`}`}
                  disabled={moveDownDisabled}
                  onClick={() => swapOrder(index, index + 1)}
                />
              </div>

              {editingPrefix === p.prefix ? (
                <input
                  ref={editingLabelInputRef}
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  onBlur={() => commitEditLabel(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEditLabel(p);
                    if (e.key === "Escape") setEditingPrefix(null);
                  }}
                  aria-label={`「${p.prefix}」のラベル`}
                  className="h-[24px] min-w-0 flex-1 rounded-1 border border-line bg-paper-0 px-1.5 font-jp text-body text-ink-1 focus-visible:border-line-strong"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEditLabel(p)}
                  title="クリックしてラベルを編集"
                  className="min-w-0 flex-1 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded-1 px-1 py-0.5 text-left text-body text-ink-1 hover:bg-paper-2"
                >
                  {p.label}
                  <span className="ml-1.5 font-mono text-caption text-ink-2">{p.prefix}/</span>
                </button>
              )}

              <ColorSwatches
                value={p.color}
                disabled={isMutating}
                onChange={(color) => updateMutation.mutate({ prefix: p.prefix, patch: { color } })}
              />

              <label className={TOGGLE_LABEL_CLASS} title="軸レールにこのprefixの軸を表示する">
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
              <label
                className={TOGGLE_LABEL_CLASS}
                title="このprefixのタグを削除・編集するとき確認を挟む"
              >
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
              <IconButton
                icon={I.x}
                label={`prefix「${p.prefix}」を削除`}
                title={p.protected ? PROTECTED_DELETE_TITLE : undefined}
                size="xs"
                className={deleteDisabled ? undefined : ROW_ICON_CLASS}
                disabled={deleteDisabled}
                onClick={() => setDeleteTarget(p)}
              />
            </div>
          );
        })}
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
        <ColorSwatches value={newColor} onChange={setNewColor} disabled={isMutating} />
        <button
          type="submit"
          disabled={!newPrefix.trim() || isMutating}
          className="h-[30px] cursor-pointer rounded-[6px] border border-line bg-paper-1 px-3 font-sans text-control font-medium whitespace-nowrap text-ink-1 disabled:cursor-not-allowed"
        >
          追加
        </button>
      </form>

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
