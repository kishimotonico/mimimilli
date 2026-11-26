---
id: TASK-529.2
title: ポップオーバーを Ark UI へ置き換え、旧フックを削除し、design-system.md を更新する
status: To Do
assignee: []
created_date: '2026-11-26 03:15'
updated_date: '2026-11-26 09:34'
labels:
  - ui
dependencies:
  - TASK-529.1
parent_task_id: TASK-529
priority: high
ordinal: 650000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
useAnchoredPopover・usePopoverDismissal を使うポップオーバー（約12箇所。GroupValuePopover、FilterChipAddButton、WorkEditTagsField/WorkTagEditor、RegisterFieldsPopover、BarVolumePopover など）を、TASK-529.1 の共通層で Ark のポップオーバーへ置き換える。見た目はメニューと同じ外枠で内側の余白 12px。置き換えの後、usePopoverEscape・useAnchoredPopover・usePopoverDismissal を削除し、使う箇所が無くなった @floating-ui/react の直接依存を外す。docs/design-system.md のメニュー・ポップオーバーのパネルの規定、z-index 表、Motion 節の「復帰は close ハンドラの責務」を ADR-0043 に合わせる。
ADR-0043 の帰結のうち、ポップオーバーの中のメニューで外をクリックしたときの扱いは、このタスクで決める。
関連: ADR-0043、TASK-525、doc-10。見た目の推奨案モック: https://claude.ai/artifact/RQNfTz8bxxPgvJgzChA5di 。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ポップオーバーの約12箇所が Ark のポップオーバーになり、見た目がメニューと同じ外枠（内側の余白 12px）になっている
- [ ] #2 軸A→B切替（GroupValuePopover）で、旧Aの復帰が新Bのフォーカスを奪わない。繰り返し測る
- [ ] #3 Esc でメニュー → ポップオーバー → dialog の順に一段ずつ閉じる。IME 変換中の Esc・Enter で閉じも実行もしない
- [ ] #4 ポップオーバーの中のメニューで外をクリックしたときの動作を決め、その動作になっている（決定を ADR-0043 の帰結に反映する）
- [ ] #5 usePopoverEscape・useAnchoredPopover・usePopoverDismissal が無くなり、@floating-ui/react への直接依存が不要なら外れている
- [ ] #6 docs/design-system.md のメニュー・ポップオーバーのパネルの規定、z-index 表、Motion 節が実装と ADR-0043 に一致している
- [ ] #7 pnpm check && pnpm test と pnpm test:smoke が通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
引き継ぎ資料（会話の文脈なしで読めるように書いてある）
- 参照先: docs/adr/0043-ui-primitives-ark-ui.md（承認）、backlog doc-10（試作の比較）、見た目のモック https://claude.ai/artifact/RQNfTz8bxxPgvJgzChA5di 、試作ブランチ proto/task-525-ark-ui（最新 e10318e99d5dd969dadc3d6dddb4edc27b8f5142。client/src/proto/、完了まで残す）
- 現状のポップオーバーの一覧と、試作で分かった注意（Esc の capture 段、userEvent.click、data-state、backdrop ガード）は TASK-529.1 の実装メモにある
- 軸A→B切替は、試作の ProtoArkAxis.tsx で、ホバーとクリック、復帰の設定の違いを合わせた12通りの奪い合いなしを確認済み。本番の部品でも繰り返し測る

メニューから開いた層（ポップオーバー・ダイアログ）は、閉じたらメニューのトリガーへ戻る。戻し先の解決を層の側の1か所（finalFocusEl 等）にまとめ、RegisterFieldsPopover の Esc で主ボタン→▾と2回 focus する現状を解消する

RegisterFieldsPopover の『N件を追加』で popover が unmount してフォーカスが body に落ち、行が消えたあと隣の行へ移るまで約50ms BODY を経由する（既存の経路）。Ark のポップオーバーへ置き換えるとき、確定ハンドラが移し先へ明示的に移す形にして解消する

引き継ぎ（実装担当向け。会話の文脈なしで読めるように書いてある）

- この引き継ぎは、使える道具や体制を問わない前提で書いてある。完了時の報告は、作業の最後の出力に書く。
- AGENTS.md の「マルチエージェント運用」節（モデル別の体制・統括や検証担当の役割）は、この作業には当てはまらないので無視してよい（AGENTS.md 自体は編集しない）。それ以外のルール（git、実装方針、検証・テストの運用、デバッグ方法、backlog の運用）は守る。
- AC1 の「約12箇所」は、設計書（doc-11）§1 の #1〜#8（#6 の narrow 表示を除く）を指す。
- メインの作業ツリー（/home/nico/projects/mimikago）では `pnpm backlog` だけを実行する。コードは触らない。コードは worktree でだけ編集する。コミットは、後任が worktree のブランチへ行う（push しない）。

## まず読むもの
- AGENTS.md（パッチワーク禁止、互換レイヤー禁止、コメント最小、docs は書き換えで現在の状態を保つ）
- docs/adr/0043-ui-primitives-ark-ui.md（特にフォーカス・Esc・ダイアログ・帰結の節）、docs/design-system.md
- TASK-529.1 の final summary と実装メモ（pnpm backlog task view TASK-529.1 --plain）
- 設計書: doc-11「TASK-529.2 ポップオーバーの Ark 置き換え 設計（合意済み）」。ファイルは /home/nico/projects/mimikago/backlog/docs/ の中の doc-11 で始まるファイルを直接読んでよい（`pnpm backlog doc view` は TTY が要り、非対話の環境では中身が出ない）。決定と理由はすべてここにある。外れる必要があるときは理由を書いて報告する。見た目の基準は設計書の §6 と §13 が正で、モックの URL（外部のページ）を開く必要は無い
- TASK-529.1 で作った共通層: client/src/shared/ui/menu/（MotionMenu.tsx、MenuLayerItem.tsx、menuStyles.ts、usePresenceLifetime.ts）、client/src/shared/lib/focusReturnTarget.ts、client/src/shared/ui/useDialogModal.ts
- 試作（参考。本番に入れない）: ブランチ proto/task-525-ark-ui の client/src/proto/（ProtoArkPopover.tsx、ProtoArkAxis.tsx）。.worktrees/task-525-ark-ui にある。試作の軸A→Bの確認は Ark 5.40.1 で行ったもので、本番は 5.40.0。AC2 は本番の部品で改めて測る

## 作業場所とgit
- worktree: /home/nico/projects/mimikago/.worktrees/task-529.2（ブランチ task-529.2-ark-popover、統合ブランチ feat/task-529-ark-ui の 9f774ff6 から分岐）。最初に worktree のルートで pnpm install
- master・統合ブランチ・他の worktree・メインの作業ツリー（AGENTS.md の未コミット変更は無関係）には触れない。git の破壊的操作（reset --hard、checkout -- など）をしない
- コミットはこのブランチに日本語の Conventional Commits（例: feat(ui): ポップオーバーの共通層を足す（TASK-529.2））。git add はファイル個別指定（ディレクトリ単位は禁止）、push しない、AGENTS.md を編集しない
- backlog の設計書・実装メモ・メインの作業ツリー側のファイルのコミットは、後任ではなく依頼元が行う（後任は worktree のコードだけをコミットする）
- backlog の操作（check-ac など）は必ずメインの作業ツリー（/home/nico/projects/mimikago）で pnpm backlog を使う。backlog/ 配下の Markdown を直接編集しない

## 実装の順序
設計書の「実装の順序」の節のとおり。最初に、ids.trigger（Ark の ids={{ trigger: <アンカーの id> }}）が、トリガーの無い層（サイドバーの行・パンくずの値・RegisterFields の▾）で効くか（Tab の proxyTabFocus、アンカー再クリックで outside 扱いにならない、トリガーへのフォールバック）を小さく確かめる。合否は設計書 §13 の合否表（3観点×#1・#2・#7、各5回）で判定し、効かない観点だけ代替（persistentElements と手動のフォールバック。中身は §13）に切り替えて、報告に書く。

## 環境の手順
- dev サーバーは worktree のルートで pnpm dev:fixture:new-work（フィクスチャの mock シナリオ new-work。クライアントとサーバーが両方起動する）。実データ DB で検証しない（書き込みを伴う検証はフィクスチャで行う）
- URL: http://task-529.2-ark-popover.mimi.localhost:1355 （ブランチ名がサブドメインになる。ブランチ名の最終セグメントが前置される。IP アドレス不可）。メインの作業ツリーの dev サーバーは http://mimi.localhost:1355 で別物。取り違えを避けるため、worktree 側にだけ一時マーカー（例: 画面の文言に一時的な文字列）を入れ、メイン側の URL に出ないことを最初に1回見る（マーカーは確認後に戻し、コミットしない）。HTTP 200 だけでは取り違えを排除できない
- 起動確認: portless が出力する URL を開き、一覧が描画されることを見る。起動しないまま本体の URL を開いて「正常」と判断する事故が過去にあった
- フィクスチャの状態リセット: POST /api/__test__/reset（書き込みを伴う確認の前後に呼ぶ）
- 本番ビルドで見たいとき（HMR の影響を避ける）: pnpm preview:fixture:new-work。時間経過で起きる UI の現象は、dev の HMR（別の編集による再読み込み）の交絡を疑う。編集を止めた状態で取り直す
- shared/src に新しい export を足した直後に、dev で「does not provide an export named …」と出て画面が空になったら、コードより先に dev サーバーの再起動を疑う（Vite の古い変換キャッシュ）。再起動を依頼する
- dev の StrictMode の二重マウントで ERR_ABORTED がコンソールに出ることがある。実害ではない
- Vite・dev サーバーの再起動は、自分で行ってよい。
- 終わったら、自分が起動したサーバーのプロセスを止める。止められなかった場合は ss -ltnp でポートと PID を報告する（他のプロジェクトのプロセスを巻き込まない）
- 環境障害: この WSL2 では、127.0.0.1 の未使用ポートへの接続が RST を返さず約2分ハングすることがある。ポート系のハングを見たら、curl --max-time 2 http://127.0.0.1:<ポート> で切り分ける（終了コード7なら正常、28なら発症）。wsl --shutdown では直らない。詳細は docs/adr/0020-smoke-webserver-log-wait-readiness.md
- pnpm test:smoke は専用ポートで fixture サーバーを自動起動するので、dev サーバーとは衝突しない

## ブラウザでの測り方（ツールに依らない）
- ブラウザ操作は、使える自動化ツール（Playwright、CDP、devtools のスクリプト実行など）で行う。操作ごとに記録を残し、数字で報告する
- フォーカスの記録: スクリプトはページ遷移（再読み込み・ナビゲーション）で消える。遷移のたびに再注入するか、自動化ツールの init script（例: Playwright の `page.addInitScript`、CDP の `Page.addScriptToEvaluateOnNewDocument`）で入れる。操作の前に入っていることを確かめる。繰り返しの測定はスクリプト化してよい。スクリプト:

    window.__focusLog = [];
    const rec = (tag) => window.__focusLog.push({
      t: Math.round(performance.now()), tag,
      active: document.activeElement ? (document.activeElement.tagName + ((document.activeElement.getAttribute && document.activeElement.getAttribute("aria-label")) ? "[" + document.activeElement.getAttribute("aria-label") + "]" : "")) : null,
    });
    document.addEventListener("focusin", (e) => rec("focusin:" + (e.target.tagName || "")), true);
    document.addEventListener("focusout", () => rec("focusout"), true);
    (function tick() { rec("raf"); requestAnimationFrame(tick); })();

  記録1回分の読み方の例（記録は `window.__focusLog` を JSON にして貼る）: `{"t":120,"tag":"focusout","active":"BODY"}`、`{"t":135,"tag":"raf","active":"INPUT[値を検索]"}` のように並ぶ。操作から最終 focusin までの行を貼り、BODY の行が混ざる場合は t の差（ms）も添える。

  記録を読むときは、操作の前後で activeElement が BODY になっている区間（raf の行で active が BODY）が無いこと、期待していない要素への focusin が途中に無いことを見る。ブラウザが約10ms だけ body にフォーカスを置くのはフォーカスできない領域のクリックだけで、受け入れる例外
- 繰り返し: 各ケース10〜20回。操作ごとに記録を空にしてから行う。1回でも失敗したらその回の記録を報告に貼る
- 状態の巻き戻り・競合・放置系は、推測より先に計装して実測する。陰性対照（効かないはずの操作）と陽性対照も取る
- IME の合成確認の手順（対象・送り方・期待結果）は設計書 §15。Windows の実 IME では、変換中の Esc・Enter は keydown が key="Process"、keyCode 229、isComposing=true で届く。CDP（`Input.imeSetComposition` と、`Input.dispatchKeyEvent` の key="Process"・windowsVirtualKeyCode 229）で合成して確かめる。合成は実機の IME ではなく、実機より厳しい条件になることがある。報告には「CDP 合成での確認」と書く。実機での確認はユーザーに任せる
- Ark の Esc は document の capture 段で処理される。キー入力は1キーずつ送る（zag の highlightedValue 等は描画時点の値を読むため、複数キーを同時に送ると古い値で処理される）

## TASK-529.1 で分かった Ark / zag の落とし穴
設計書と ADR-0043 にある。要点:
- 層の中の自作の Esc 処理（React の onKeyDown）は defaultPrevented を見ないと、Esc 1回で両方閉じる
- present 方式では退出中も data-state="open" のまま。スタイルやテストの条件に data-state を使わない。退出中は inert
- Ark の項目・トリガーは vitest で fireEvent.click では動かず、userEvent.click が要る
- happy-dom は矩形が0。配置は実ブラウザで確かめる
- onFocusOutside で閉じるときは、移動先が自分のツリー（自分の content の中にトリガーを持つ子孫）なら閉じない
- ネイティブ dialog の中に出す層は Portal の container を dialog にし、strategy: fixed
- 外側の pointerdown の処理は次フレームに遅れる。5.40.0 では速いクリックで別の層のトリガーを押すと後から開いた層も閉じうる（TASK-530 で 5.40.1 に上げて解消予定）。設計はそれに依存しない形にしてある
- 処理中の操作要素は disabled 属性でなく aria-disabled＋ハンドラのガード

## 受け入れ条件のチェックと報告
- 受け入れ条件を満たすたびに、メインの作業ツリーで pnpm backlog task edit TASK-529.2 --check-ac <n>
- 検証の全体（到達手順は設計書 §14、見た目の合格基準は §13）。AC3・AC4 の「ポップオーバーの中のメニュー」は、client/tests/unit/ の常設の vitest テストで確かめる（設計書 §5。本番コードに専用画面は足さない）。vitest で確かめられない部分だけ、設計書 §5 の「ハーネス」（client/tests/smoke/harness/ のテスト専用ページ）に回す。実在する画面の Esc の段は #5 の WorkEditDialog のタグ追加で実ブラウザ測定する
- 設計書の「実装時に確かめる」項目で想定と違ったときの既定の進み方は、設計書 §13 の表に1行ずつ書いてある。それに従い、報告に書く
- docs（design-system.md と ADR-0043）の更新は、実装順序の「docs」の段階で行う（設計書 §9・§12）
- 実装中は変更範囲のテストだけを実行する。完了時に worktree で pnpm check && pnpm test と pnpm test:smoke を1回ずつ実行する。smoke が落ちたら、落ちたテスト名と内容を記録する（再実行で通っても報告する）
- 失敗しているテストを放置しない。直すか、その場で起票する
- 完了報告は、作業の最後の出力に書く。書くこと: コミット一覧、AC ごとの証拠（測定の回数と結果）、テスト期待値の削除・緩和とその理由（削除したテストの題名の行き先）、ユーザーに見える挙動の変化、未確認事項
- 完了後、別の担当が統合ブランチ全体の最終レビューを行う。master へのマージはしない（ユーザーの判断）

## 関連
- TASK-530（Ark を 5.40.1 へ上げる。2026-11-30 以降）、TASK-528（ネイティブ dialog を閉じた後の BODY）
<!-- SECTION:NOTES:END -->
