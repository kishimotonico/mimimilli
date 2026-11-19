---
id: TASK-511.2
title: 未登録の候補にDLsite取得状態とプレビュー情報を載せる
status: Done
assignee: []
created_date: '2026-11-19 00:23'
updated_date: '2026-11-19 02:19'
labels:
  - scan
  - dlsite
dependencies:
  - TASK-511.1
references:
  - 'https://claude.ai/artifact/GbuEuRQyKeD9xN4CM3Fv1k'
documentation:
  - docs/adr/0033-dlsite-fetch-before-register.md
  - docs/adr/0034-scan-modal-restructure.md
parent_task_id: TASK-511
priority: high
ordinal: 571000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
未登録タブで、取得済みの候補を追加後の姿（DLsiteのタイトルとカバー）で見せるためのサーバー側の契約。ADR-0033の「候補の状態はキャッシュから導く」とADR-0034の「未登録タブの候補の状態」「スキャン結果の寿命はサーバーのメモリだけ」に対応する。既存クライアントの呼び出し元（client/src/features/scan/ の候補一覧の取得）もこのタスクで追随させる。

- 候補はWork IDを持たないので、状態はproduct codeについて既存の DlsiteCache.resolve（server/src/adapters/real/dlsiteCache.ts）が返す結果から導く。有効な失敗の記録→該当なし・失敗、TTL内のsnapshotで outcome が ok→取得済み、outcome が parse_error→失敗（解析失敗のsnapshotを取得済みにしない。server/src/adapters/real/dlsiteFetch.ts の recordSuccess、dlsiteCache.ts の resolve）、miss（TTL切れを含む）→未取得。キャッシュの意味は変えず、TTLを無視してsnapshotを読む経路は足さない。取得中は取得ジョブ（TASK-511.1）の状態から出す。
- 候補一覧は GET /scan/candidates（ScanCandidateSession、server/src/adapters/real/scanCandidateSession.ts）。サーバーのメモリにあり、寿命は次のスキャンかサーバー再起動まで。
- 1000件規模の候補一覧を返すたびにHTMLを解析し直さないよう、解析結果（DLsiteのタイトル・カバーのURL等）は取得時にDLsiteキャッシュへsnapshotと同じ寿命で保存し、サーバーを再起動しても解析し直さない。キャッシュが変わったとき（取得の終端、TTL切れ）に正しく導き直されるようにする。
- キャッシュ済みのカバーを配信する経路を足す（今はキャッシュ済みカバーを画面に出す経路が無い。参考 server/src/routes/media.ts）。キャッシュにカバーが無ければ配信しない。
- 直したRJコードは専用の保存先を持たず、候補一覧の中だけで保持する（ADR-0033）。
- 見つからなくなった作品（catalogでmissing）と同じRJコードの候補には、その旨（該当作品のIDとタイトル）を載せる。引き継ぐ操作はDRAFT-77で契約を決めてから作るので、このタスクでは載せるところまで。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 候補一覧の各候補に、DlsiteCache.resolve から導いたDLsite状態と、取得済みならDLsiteのタイトルが載る。outcome が ok のsnapshotは取得済み、parse_error のsnapshotは失敗、TTL切れは未取得になり、取得中の候補は取得中として返る
- [x] #2 キャッシュ済みのカバーを配信する経路があり、画面がDLsiteのURLを直接読まない
- [x] #3 候補のRJコードを直すと候補一覧に保持され、その候補の状態は直したコードで導かれる。次のスキャンかサーバー再起動で破棄され、フォルダー名から検出し直される
- [x] #4 行方不明の作品と同じRJコードの候補に、その作品のIDとタイトルが載る
- [x] #5 real/fixture両アダプタで契約を満たし、既存クライアントの呼び出し元が追随していて、pnpm check・pnpm test が通る
- [x] #6 候補一覧を繰り返し返しても、同じキャッシュ内容のHTMLを毎回解析しない（解析結果は取得時にDLsiteキャッシュへ保存し、サーバーを再起動しても解析し直さない）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-19（TASK-511.1の設計確定より）: 状態の導出はTASK-511.1がsharedに置く dlsiteFetchStateOfResolution を使う。取得中・待機中のコードはDlsiteJobManagerの同期の参照口から読む。カバー先取りの失敗は取得済みに隠れる（失敗の記録が無い）ので、候補にカバーの有無を載せ、追加前に気づけるようにする。fixtureのカバーは本タスクの配信経路と同時にそろえる。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
候補一覧に実効RJコード・DLsite状態（none/fetching/fetched{title,cover}/not_found/failed）・同じRJコードの行方不明作品を載せた。解析結果はDLsiteキャッシュDBのdlsite_parsed_products（DlsiteWorkInfo全体、パーサー版つき）に取得と同じトランザクションで保存し、createDlsiteProductResolverで取得のキャッシュヒットと候補一覧が同じ解決を使う。キャッシュ済みカバーをGET /api/media/dlsite-cover/:keyで配信し、RegisterWorkDialogもDLsiteのURLを直接読まない。候補のRJコード修正API（POST /api/scan/candidates/rj-code）を追加し、登録リクエストからrjCodeを除いた。ADR-0033に解析結果の保持・追加の契約のRJコード・解析できないokの扱いを追記。
<!-- SECTION:FINAL_SUMMARY:END -->
