---
id: TASK-530
title: '@ark-ui/react を 5.40.1 へ上げ、速いクリックでの別メニューの巻き込みを解消する'
status: Done
assignee: []
created_date: '2026-11-26 06:35'
updated_date: '2026-11-27 15:38'
labels:
  - ui
dependencies: []
priority: medium
ordinal: 651000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
5.40.0（zag 1.47）は layer-stack の入れ子判定で、メニューAを開いたまま別メニューBのトリガーを素早く押すとBも閉じる。zag 1.49（Ark 5.40.1、2026-11-23 公開）で origins による親判定に変わり解消する。5.40.1 は 2026-11-30 以降に公開から7日を満たす。関連: ADR-0043、TASK-529.1
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 メニューAを開いたまま別メニューBのトリガーを押して即離す操作で、Bが開いたまま残り BODY を経由しない（10回）
- [x] #2 ADR-0043 の「5.40.0 は未対応」「メニューには finalFocusEl が無い」の記述が現状に合わせて書き換わり、useDialogModal の aria-labelledby 経由のトリガー解決を menu の finalFocusEl で置き換えられるか判断して反映されている
- [x] #3 pnpm check && pnpm test と pnpm test:smoke が通る
- [x] #4 @ark-ui/react が 5.40.1 に厳密指定で上がっている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
速いクリックで B が閉じる記録: click 560ms → B expanded 572ms → B トリガー focusin 580ms → 598ms に A と B が同時に false。A の外側 pointerdown 処理が次フレームへ遅れ、A のレイヤー除去が後から開いた B を入れ子として巻き込む。5.40.1 で解消するかを同じ手順で確かめる

Ark UI 更新時に実ブラウザで確かめる一覧（ADR-0043『Ark UI の内部挙動に依存している点』の確認手順。fixture で、各5回、focusin/out の記録で body を経由しないことも見る）
1. メニューを開いたままプログラムの focus()（⌘K で検索欄）で外へ移す: 移動先にフォーカスが残る（トリガーへ奪い返されない）
2. メニューを開いたまま別のメニューのトリガーを押す: 前のメニューが閉じ、後のトリガーにフォーカス
3. MenuLayerItem（未登録▾の『項目を選んで追加…』）: メニューを戻さず閉じ、開いた層の初期フォーカスを奪わない
4. 未登録の▾: 項目選択を開いたまま▾をポインター・Enter・Space・ArrowDown・ArrowUp で押すと項目選択だけ閉じる。▾を開いたまま行のチェックボックスをクリック／Tab してもフォーカスが▾へ戻らない。キーボードで開いたとき ArrowDown は先頭、ArrowUp は末尾をハイライト
5. 無効なトリガー（RowMenu の busy など）: フォーカスを残したまま開かない（aria-disabled・data-disabled）
6. 出現の起点: トリガーを画面下端に置き flip したとき --transform-origin が向きに合う
7. メニュー内の Tab: ダイアログの中（スキャンの行の︙・未登録の▾）と外（ソート・＋）で開いたまま動かず、body を経由しない
8. サブメニューを使い始めたら、サブメニュー → メニュー → 容器の Esc の一段（連続 Esc 0〜100ms の間隔）
9. 閉じる途中のメニューが残るあいだに別のメニューを開く（押してすぐ離す）: 後から開いた方が開いたまま残る

2026-11-27 ユーザー判断で公開7日の待ちを外し、5.40.1 にする。グローバルの pnpm 設定（~/.config/pnpm/rc の minimum-release-age=10080）が新しい版を弾くので、追加はこの1回だけ設定を外して行う: pnpm --filter @mimimilli/client add @ark-ui/react@5.40.1 --save-exact --config.minimum-release-age=0 。ADR-0043 の「本番は公開から7日以上の 5.40.0」の記述も実際の版に直す

2026-11-28 検証（fixture、http://task-530-verify.mimi.localhost:1355、5.40.1）: 速いクリック（メニューAを開いたままBのトリガーを押して即離す、CDP 間隔約1ms）10/10 で B が開いたまま、BODY 経由0。Bが expanded=true の約16ms後にAが false になり、閉じる途中のAと開いたBが並ぶ状況を通っている。更新時の確認一覧: 1 5/5、2 5/5、3 5/5、4 各5/5、5 25/25、6 は行の︙をビューポート高さ220で flip させ top-end・--transform-origin 下辺基準 5/5（ソートは画面上部固定で flip させられず）、7 20/20、8 サブメニュー未使用で対象なし、9 は速いクリックと同じで 10/10。ボタン起点メニューの finalFocusEl は 5.40.1 にあるが、MenuLayerItem は restoreFocus:false で閉じるので届かず、useDialogModal の開いた時点のトリガー解決は置き換えない。レビュー（Opus）で zag 1.47→1.49 の差分を整形比較し、client が依存する内部挙動の変化は無し（combobox・toast・focus-trap・dom-query 全体は未確認で TASK-531.1 で 5.40.1 のまま確かめる）。pnpm check・test（bun 1383、vitest 1826）・test:smoke 76 すべて成功
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
@ark-ui/react を 5.40.1（zag 1.49）へ厳密指定で上げ、速いクリックで別メニューが巻き込まれて閉じる件が解消したことを実ブラウザで確かめた。ADR-0043 を 5.40.1 の現状に合わせ、ボタン起点メニューの finalFocusEl を使わない理由と、open を制御しない理由を書き直した
<!-- SECTION:FINAL_SUMMARY:END -->
