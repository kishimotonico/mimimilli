---
id: TASK-511.3
title: 追加の契約を候補登録とFiles作品登録で共通化する
status: Done
assignee: []
created_date: '2026-11-19 00:23'
updated_date: '2026-11-19 05:15'
labels:
  - scan
  - dlsite
dependencies:
  - TASK-511.1
  - TASK-511.2
references:
  - 'https://claude.ai/artifact/GbuEuRQyKeD9xN4CM3Fv1k'
documentation:
  - docs/adr/0033-dlsite-fetch-before-register.md
  - docs/adr/0034-scan-modal-restructure.md
parent_task_id: TASK-511
priority: high
ordinal: 572000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0033の「新しい候補は『追加』を承認とする」「追加と適用の契約」を、未登録の候補の追加とFilesの作品登録で実装する。既存クライアント（Filesの RegisterWorkDialog、未登録タブの登録）の呼び出し元もこのタスクで追随させる（互換レイヤーは作らない）。

現状: 候補登録（ScanCandidateSession.registerCandidates → scanner.registerWork、server/src/adapters/real/scanCandidateSession.ts）はタイトルとRJコードしか渡さない。Filesの作品登録（client/src/features/files/ui/RegisterWorkDialog.tsx、server/src/adapters/real/workRegister.ts の buildMetaFromDlsiteApply）はクライアントが送ったDLsite情報（DlsiteApplyBody の info、shared/src/dlsite.ts）で組み立て、カバーをその場で取得する。

決めてあること（ADR-0033）:
- 未登録の候補の追加は、候補のパスと、反映項目のフラグ（タイトル・カバー・タグ・URLの真偽値）だけを受け取る。RJコードは、サーバーの候補一覧が持つ値（直した値、なければフォルダー名から検出した値）を使う（TASK-511.2で登録リクエストから rjCode を除く）。タイトルを反映するときはDLsiteのタイトルに置き換える。
- Filesの作品登録のbodyは、rjCode・title・tags（ユーザー入力）・applyCover・applyUrl。DLsite由来のカバーとURLはサーバーがキャッシュから読む。dlsite.appliedTags はサーバーが「キャッシュ上のDLsiteのタグ」と「ユーザー入力のタグ」の共通部分として決める。クライアントから info を受け取らない。
- 追加時にDLsite情報を使うのは、DlsiteCache.resolve がTTL内で outcome が ok のsnapshotを返したときだけ（parse_error のsnapshotは失敗扱いで使わない）。TTL切れ・キャッシュに無い・取得中・該当なし・失敗・RJコードなしの候補は、DLsite情報なし（フォルダー名のまま）で追加する。
- 追加の処理でDLsiteへHTTPを出さない。キャッシュにカバーが無いときは、カバーだけ反映せずほかの項目は反映して続行する。
- 大量の追加はクライアントが分割して送る。1リクエストの件数の上限をリクエストのschemaに持たせる（上限値はこのタスクで決める）。
- 予約（追加後の自動反映）と取り消しは作らない。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Filesの作品登録が rjCode・title・tags・applyCover・applyUrl を受け取り、カバーとURLをサーバーがキャッシュから読み、dlsite.appliedTags をキャッシュ上のDLsiteタグと入力タグの共通部分で決める。どちらの入口もクライアントから取得結果（info）を受け付けない
- [x] #2 追加の処理でDLsiteへHTTPを出さないことをテストで縛っている。キャッシュにカバーが無いときは、カバー以外を反映して追加が成功する
- [x] #3 TTL切れ・キャッシュに無い・該当なし・失敗・RJコードなしの候補は、フォルダー名のまま登録される
- [x] #4 追加リクエストの件数上限がschemaにあり、上限を超えると400になる。クライアントは上限ごとに分割して送り、1000件の追加が完了する
- [x] #5 real/fixture両アダプタで契約を満たし、RegisterWorkDialogと未登録タブの呼び出し元が追随していて、pnpm check・pnpm test・pnpm test:smoke が通る
- [x] #6 未登録の候補の追加が、候補のパスと反映項目のフラグだけを受け取り、RJコードとDLsite情報をサーバーが候補一覧とキャッシュから読む。タイトルを反映するときはDLsiteのタイトルになる
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
候補の追加を{paths(1〜20), apply}に、Filesの作品登録をrjCode・title・tags・applyCover・applyUrlにし、どちらもinfoを受けずにTTL内で解析できたキャッシュの情報だけを使う（planDlsiteRegistrationを共有）。カバーはカバーキャッシュだけから一時ファイルにし（stageCachedDlsiteCover）、追加・作品詳細の適用・未設定項目の適用でHTTPを出さない。カバーが無いときはカバーだけ外して続行、登録失敗時は書いたカバーを消す。候補で明示的になしにしたRJコードは""で書く。クライアントは上限ごとに分割送信し、途中停止時も追加分を記録とキャッシュへ渡す。1件あたり約14ms（小さい作品で実測）。
<!-- SECTION:FINAL_SUMMARY:END -->
