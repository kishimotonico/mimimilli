---
id: TASK-254
title: 作品プレビューの「その他」メニューを下向きに開くようboundaryを直す
status: Done
assignee: []
created_date: '2026-08-08 11:01'
updated_date: '2026-08-08 11:16'
labels: []
dependencies: []
ordinal: 264000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-248でflipを導入した結果、作品プレビューのアクション行にある「その他」（三点リーダー）メニューが上向きに開くようになった。旧実装は常に下向きだった。ユーザーの意向は下向き。

原因は位置決めのboundaryの取り違え。useAnchoredPopover の defaultContainerResolver は .mle-prv__meta を最初に解決するが、.mle-prv__meta は display:flex の列レイアウトだけで overflow を持たずクリップしない（shell.css:2005 付近）。実際のクリップ祖先は .mle-prv__body の overflow:hidden auto（shell.css:1940 付近）。

クリップしないコンテナをboundaryにしていたため「下に余地がない」と誤判定され、flipが常に作用していた。boundaryを実際のクリップ祖先へ直せば自然に下向きへ開き、画面端で本当に余地がないときだけ反転する正しい挙動が残る。

デフォルトのresolverは WorkTagEditor も使っており、そちらは containerWidth を狭幅判定（NARROW_TAG_PANE_PX=320）に用いる。.mle-prv__meta と .mle-prv__body は幅が異なるためデフォルトを変えると判定が壊れる。よって WorkMetadataActions の呼び出し側だけ getContainer を明示する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 WorkMetadataActions が getContainer で .mle-prv__body を boundary に指定している
- [x] #2 「その他」メニューがトリガー直下（隙間6px）に下向きで開くことが getBoundingClientRect の実測で確認されている
- [x] #3 WorkTagEditor の狭幅判定（containerWidth）に影響がない
- [x] #4 pnpm check・pnpm test・pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
既定リゾルバは変更せず、WorkMetadataActionsの呼び出し側だけ getContainer を明示した。リゾルバはモジュールスコープの定数として定義している（インライン関数だと毎レンダーで識別子が変わり、フック内の setReference が useCallback の依存に getContainer を含むため参照refのdetach/attachが毎レンダー起きるため）。

実測検証: トリガー bottom=402.75、ポップオーバー top=408.75 で差は6px、下向きに開くことを確認。横方向も .mle-prv__body（left=861, right=1280）の内側に収まる。WorkTagEditor は通常幅・狭幅（420x800）とも従来どおり。pnpm check 通過、server 505 / client 777 通過、pnpm test:smoke 10件通過。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
作品プレビューの「その他」メニューが上向きに開いていた問題を、位置決めのboundaryを実際のクリップ祖先 .mle-prv__body へ直すことで解消した。既定リゾルバはWorkTagEditorの狭幅判定が依存するため変更していない。
<!-- SECTION:FINAL_SUMMARY:END -->
