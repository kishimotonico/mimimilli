import type { QueryClientConfig } from "@tanstack/react-query";

/**
 * アプリ全体で共有する QueryClient。
 * 生成場所をここに固定し、テストや将来の SSR/複数 root でも同じ既定値を使う。
 *
 * 既定値の方針（ローカルファースト・デスクトップ的 UX 前提）:
 * - staleTime 30s: スキャンや mutation 以外でデータが頻繁に変わらないため、
 *   短時間の再マウントで無駄な refetch をしない
 * - retry 1: ローカルバックエンド前提でネットワーク失敗は実エラー扱い。
 *   失敗を素早く UI へ出すため既定の 3 回より抑える
 * - refetchOnWindowFocus false: 単一ウィンドウのアプリでフォーカス毎の再取得は不要
 *
 * ドメイン知識を持つ error handler（root_reconfiguring検知等）は
 * app層（client/src/app/model/queryClient.ts）で組み立てる。ここは最下層のため持たない。
 */
export function createBaseQueryClientOptions(): QueryClientConfig {
  return {
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  };
}
