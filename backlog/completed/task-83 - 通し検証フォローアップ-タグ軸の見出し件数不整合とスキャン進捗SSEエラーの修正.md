---
id: TASK-83
title: '通し検証フォローアップ: タグ軸の見出し件数不整合とスキャン進捗SSEエラーの修正'
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 10:19'
updated_date: '2026-07-19 10:47'
labels: []
dependencies: []
modified_files:
  - server/src/adapters/real/workRepo.ts
  - server/tests/real/worksQueryContract.test.ts
  - server/tests/scanProgress.test.ts
  - client/src/features/scan/useScanProgress.ts
  - client/tests/unit/scanProgress.test.ts
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0008実装チェーン（TASK-78〜81）の実機通し検証（2026-07-19）で見つかった2件の修正。

1. タグ軸の見出し件数不整合: 分類軸「タグ」を開くと、リストは「タグがありません」（無プレフィックス自由タグが実際に0件）なのに、サイドバー見出しの件数が「8件」（CV軸の件数と一致）と表示される。フルリロード後の直接クリックでも再現するためキャッシュ汚染ではない。TASK-79のファセット集計SQL化（GROUP BY移行）で、タグ軸の件数だけ別軸の値を返している退行の可能性を最優先で調査

2. スキャン進捗SSEエラー: スキャン開始後、ブラウザコンソールに「スキャン進捗のSSE接続でエラーが発生しました」（EventSource error）が毎回出る（再現率2/2）。GET /api/scan/events は200・text/event-streamで開始されるが途中でエラー。スキャン自体は正常完了する。TASK-78のBunランタイム移行（bun src/index.ts起動）でSSEストリーミングの挙動が変わった退行の可能性を最優先で調査（@hono/node-serverとBunの互換、ストリームのflush/close挙動）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 タグ軸の見出し件数がリスト内容と一致する（自由タグ0件なら0件表示）
- [x] #2 スキャン実行時にSSE接続エラーがコンソールに出ず、進捗が最後まで配信される
- [x] #3 pnpm check と pnpm test が通る（可能なら再発防止のテスト追加）
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. tag軸とprefix軸のSQLを分離し、prefixタグのみの契約テストを追加する
2. 既存のBun.serve起動経路とSSE終端を確認し、clientがterminal受信時にEventSourceを閉じる
3. serverでprogressからterminal・EOFまでの購読テストを追加し、pnpm checkとpnpm testを実行する
4. 実データ複製でtag 0件・cv 8件を確認し、受け入れ条件と作業記録を更新する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
タグ軸は動的SQL組み立てをやめ、自由タグ専用SQLとprefix軸SQLを分離。prefixタグだけのデータではtag=[]、cvは非空になるfixture/real契約テストを追加した。実データ複製のapp.requestでもtag=[]、cv=8項目を確認。
SSEはserver/src/index.tsが既にADR-0007どおりBun.serveを使用していた。serverはcomplete/error送信後に正常終了しており、EventSourceがEOFをerrorとして扱っていたため、clientがterminal受信時にcloseするよう修正。serverテストはprogress→complete→EOFを読み切り、clientテストはcomplete/errorでcloseすることを確認。
pnpm check成功。pnpm test成功（server 183件、client 246件）。実行環境がTCP listenを許可しないためcurl通し検証は未実施だが、Hono app境界とSSE Response読み切りで検証した。

ブラウザ再検証: タグ軸0件表示・CV軸8件・スキャンSSEエラー解消（前回100%再現→0件）・作品件数不変を確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
タグ軸の自由タグ集計をprefix軸から分離し、0件ケースの契約テストを追加した。SSEはterminal受信時にclientがEventSourceを閉じ、正常EOFを接続エラーとして扱わないよう修正。serverのterminal/EOFテストを追加し、pnpm checkとpnpm testを完走した。
<!-- SECTION:FINAL_SUMMARY:END -->
