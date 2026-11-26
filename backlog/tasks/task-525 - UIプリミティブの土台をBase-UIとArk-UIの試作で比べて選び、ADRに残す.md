---
id: TASK-525
title: UIプリミティブの土台をBase UIとArk UIの試作で比べて選び、ADRに残す
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25 20:40'
updated_date: '2026-11-26 03:38'
labels:
  - ui
dependencies: []
ordinal: 644000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
クライアントのUIプリミティブ（メニュー、コンテキストメニュー、ポップオーバー、ダイアログ、コンボボックス、セレクト、ツールチップ、トースト、スライダー、タブ）は shared/ui 配下で自作しており、位置決めだけ @floating-ui/react を使っている。これを信頼できるライブラリの上に載せ替えるため、土台を選ぶ。

3つの評価（Sonnet・Fable・Codex）で候補は Base UI（@base-ui/react）と Ark UI（@ark-ui/react）に絞れた。評価の全文と、試作で確かめる点の一覧は doc-9「UIプリミティブの土台 評価のまとめ（2026-11-26）」にある。争点は、多数の対象で1つのメニューを共有して対象を渡す仕組みと、motion の AnimatePresence（ADR-0014）との組み方。紙の上では決まらないので、捨てる前提の worktree で両方を同じシナリオで作って比べる。試作のコードは本番に入れない。

右クリックメニューの要件は doc-8「DRAFT-53 作品の複数選択と右クリック 要件の合意（2026-11-26）」の「右クリックの全体方針」を前提にする（アプリ全体でブラウザのコンテキストメニューを止め、入力欄と選択中のテキストの上だけ例外。サブメニュー、チェック/ラジオ項目、先頭文字移動が要る）。

受け入れ条件に入れない確認項目: メニューキー／Shift+F10 で開いたときの位置と対象、本番ビルドのバンドル増分、vitest + happy-dom で動くか、Pragmatic drag and drop との干渉、ドキュメント全体の contextmenu 抑止とライブラリの Trigger の stopPropagation の順序、Base UI のメニューの既定 modal（スクロール固定・内部バックドロップ）が dialog 内で悪さをしないか。結果は比較の doc に書く。

この結論をもとに、ボタン起点のメニューとポップアップの見た目・振る舞いの相談、メニューとポップオーバーの置き換え（同じ統合ブランチで）、残りのプリミティブの置き換え、DRAFT-53 の順で進める。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Base UI と Ark UI のそれぞれで同じ試作（仮想化された作品一覧の右クリックメニュー〈サブメニューとチェック項目付き〉、ネイティブ dialog の中の行メニュー、自作ポップオーバーの中のメニュー）を作り、比較結果を backlog doc に残している
- [x] #2 右クリックした作品（複数選択の中ならその全体）がメニューを開く前に確定し、開いたまま別の行を右クリック・スクロール・再描画しても表示と実行先がずれない。入力欄と選択中のテキストの上ではブラウザのメニューが出る
- [x] #3 Esc がレイヤーごとに一段だけ閉じ（サブメニュー → メニュー → ポップオーバー → dialog）、IME 変換中の Esc と Enter では閉じも実行もしないことを実ブラウザで確かめている
- [x] #4 motion の AnimatePresence（ADR-0014）で退出アニメーションを付けられ、退出中に中身が消えず、退出中の要素が操作を受けないことを確かめている
- [x] #5 閉じた後のフォーカス復帰をライブラリに任せるか自前で持つかを、TASK-248 の決定（フォーカス復帰は自前、FloatingFocusManager 禁止）と照らして結論を出している
- [x] #6 ダイアログをネイティブ dialog のまま残すかライブラリへ寄せるかの結論を出している
- [x] #7 採用するライブラリ、ダイアログの扱い、motion との組み方、フォーカス復帰の方針、プリミティブの置き換え順を ADR に書いている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
比較は doc-10、決定は ADR-0043（承認、Ark UI）。ADR-0014 の原則3を改訂した。試作で見つけた不具合は TASK-526〜528 として起票した。置き換えは TASK-529。AC3 は IME 確認ページ（https://claude.ai/artifact/PM8Jxhp2xNG5UfJQ46mpCx）でユーザーが実機確認する予定。

AC3: IME 確認ページで Windows の実 IME を確かめた。変換中の Esc・Enter は key=Process（keyCode 229, isComposing=true）として届き、メニュー・ポップオーバー・ダイアログ内コンボボックスとも閉じも実行もしなかった。確定後の Esc はコンボボックスの候補 → ダイアログの順に一段ずつ閉じた。試作の検証で使った CDP の合成（key=Escape かつ isComposing=true）は実機より厳しい条件だった。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Base UI と Ark UI で同じ題材の試作を作って比べ（doc-10）、UIプリミティブの土台に Ark UI を採用して ADR-0043 に残した。ADR-0014 の原則3（閉じたときの復帰）を改訂した。試作で見つけた不具合を TASK-526〜528 に起票し、置き換えを TASK-529 に起票した。Esc の層・IME・退出アニメーション・フォーカス復帰は実ブラウザと Windows の実 IME で確かめた。TASK-526・527 は実機で再現しないため対応なしとした。
<!-- SECTION:FINAL_SUMMARY:END -->
