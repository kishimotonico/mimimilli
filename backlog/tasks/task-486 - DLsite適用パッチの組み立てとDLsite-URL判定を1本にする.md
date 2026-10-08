---
id: TASK-486
title: DLsite適用パッチの組み立てとDLsite URL判定を1本にする
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:46'
updated_date: '2026-10-08 04:12'
labels:
  - shared
  - refactor
dependencies: []
documentation:
  - backlog/docs/doc-6
priority: medium
ordinal: 544000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
shared/src/dlsite.ts の buildDlsiteApplyPatch と buildDlsiteMissingApplyPatch は、URL組み立て（dlsite.comを除いて {label:'DLsite',url} を足す）と linkage の applied 構築が重複している。DLsite URLの判定は entry.url.includes('dlsite.com') の部分一致が3箇所ある。2つのビルダーを共通の差分→パッチ関数にまとめ、URL判定はhostname比較の1関数にする。dlsiteFetchErrorKindSchema が apiErrorSchema の code と重複しているなら導出に置き換える。ファイルを契約・ドメイン・UI述語に分割するかは、統合後の大きさを見て判断する。詳細は doc-6 の shared-6・shared-4。行番号は点検時点（1c9f033c）のもの。先に入るバグ修正で変わり得るので、着手時に現状を確認してから進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 通常適用と欠落適用のパッチが同じ組み立て関数を通る
- [x] #2 DLsite URLの判定がhostname比較の1関数で、部分一致の判定が残っていない
- [x] #3 dlsite.com を含む別ホストのURLがDLsite URLと判定されないことがテストで確認されている
- [x] #4 DLsite取得失敗の種別が他のエラーコード定義と重複して手書きされていない
- [x] #5 pnpm check && pnpm test が通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
通常適用と欠落適用のパッチを共通関数に、DLsite URL 判定を hostname 比較の isDlsiteUrl に、apiErrorSchema の code を dlsiteFetchErrorKindSchema から導出。別ホストを弾くテストを追加。 個別レビュー＋統合ブランチの横断レビュー、feat/audit-sweep 先端で pnpm check・test 全通過、smoke 29/30（失敗1件は別プロジェクトの vite とのポート衝突で、単体再実行3/3通過）。17736da3 で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
