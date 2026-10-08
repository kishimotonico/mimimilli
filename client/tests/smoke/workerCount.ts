// playwright.config.ts の workers と fixtures.ts のポート導出（block割当）が同じ値を
// 参照するための単一の情報源。並列度は12スレッド機材での実測に基づく。
export const SMOKE_WORKERS = 4;
