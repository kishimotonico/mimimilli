---
id: TASK-502
title: 一覧のスクロールを派生値のeffectで動かさず、明示的なきっかけでだけ選択作品へ寄せる
status: Done
assignee: []
created_date: '2026-10-07 03:04'
updated_date: '2026-10-07 03:23'
labels:
  - bug
  - client
dependencies: []
priority: high
ordinal: 560000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ライブラリで作品を選択して分割ペインの詳細を閉じる（閉じるボタン・戻る・ブラウザバック・Esc）と、一覧が先頭へスクロールする。原因は useRovingIndex（client/src/features/library/ui/useRovingIndex.ts）の useEffect で、targetRowIndex が変わるたびに scrollToIndex を呼んでいること。呼び出し側が「選択なし」を0番に変換するため、選択解除で0番へ追従スクロールしてしまう。同じ理由で、グリッドの列数変化（ウィンドウ幅・タイルサイズ・ジャスティファイド再計算）でも、選択行または先頭へ勝手にスクロールしうる（AxisValueGrid も同様）。roving tabindex の対象決定と、選択作品を画面内へ出すスクロールを分離し、スクロールは意味のあるきっかけでだけ起こす。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 useRovingIndex は副作用を持たない純粋な計算になり、targetIndex に null（対象なし）を受け取れる。null のときは描画中の先頭行の先頭項目を roving 対象にする（Tab で一覧に入れる性質は維持する）
- [x] #2 選択解除・列数やタイルサイズの変化・追加ページの読み込みでは、作品一覧のスクロール位置が変わらない
- [x] #3 resetKey 変化時は、選択作品が一覧にあればそこへ、なければ先頭へスクロールし、先頭リセットと選択追従の effect の実行順に依存しない
- [x] #4 AxisValueGrid・AxisValueRows・AxisValueQuickList もスクロールを伴わない useRovingIndex に合わせ、resetKey での先頭リセットとキーボード移動時のスクロールは従来どおり動く
- [x] #5 選択解除でスクロールが保たれること、列数変化でスクロールしないことをテストで縛る。fixture(large) のブラウザ実測で、詳細を閉じる4経路すべてで位置が保たれることを確認する
- [x] #6 pnpm check && pnpm test と pnpm test:smoke が通る
- [x] #7 作品一覧（WorkGrid・WorkListPane）は、mount 時に選択がある場合、selectedWorkId が別の非null値へ変わった場合、一覧の resetKey が変わった場合にだけ、選択作品を画面内へ寄せる。一覧にある作品の行位置が未計算（ジャスティファイド未計算・寸法未確定）のときは保留して解決時に一度だけ寄せ、一覧に無い（未取得の追加ページ等）選択作品への要求はレイアウト確定後に取り下げる
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
useRovingIndexからスクロールのeffectを除いて純粋な計算にし、選択作品への寄せをuseRevealSelectedWork（mount時の選択・選択変更・worksQueryKey変化のときだけ）に分離した。詳細を閉じる4経路でスクロール位置が保たれることをfixture(large)で実測。pnpm check・pnpm test・pnpm test:smoke通過。Astra(Codex)最終レビュー済み。master 905f0c11。
<!-- SECTION:FINAL_SUMMARY:END -->
