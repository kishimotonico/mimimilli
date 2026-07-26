---
id: TASK-93.3
title: DLsiteリクエストのレート制限とリトライを一元化しオフラインフラグを追加する
status: Done
assignee:
  - '@codex'
created_date: '2026-07-25 08:40'
updated_date: '2026-07-26 02:03'
labels: []
dependencies:
  - TASK-93.2
parent_task_id: TASK-93
priority: high
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## やること

キャッシュミスで実際にDLsiteへ出るときのリクエスト制御を整える。あわせて、実ファイルを対象にしたデバッグ中にDLsiteへ出ないことを保証するフラグを1つ用意する。

### オフラインフラグ

環境変数のbooleanを1つだけ追加する（既定オフ）。モードを3種類に分けたりはしない。real adapterで実ファイルを扱いつつDLsiteだけ止めたい、というのが唯一の要件で、MIMIMILLI_ADAPTER=fixture では静的データになってしまいこれを満たせない。

優先順位を次のとおり定義する。

- 通常時: cache-first、ミス時はネットワークへ
- オフライン＋キャッシュヒット: 成功（実ファイル対象の繰り返しスキャンがネットワークなしで回る）
- オフライン＋キャッシュミス: ネットワークへ出ず、明示的なofflineエラー。成功や空データを装わない
- オフライン＋強制再取得: ネットワークへ出さずエラー
- オフライン由来の失敗はキャッシュへ書かない（長期TTLに焼き付いてフラグを外した後の再取得を妨げるため）

**offline miss は通常のDLsite障害と区別し、work_dlsite.status を error に更新しない。** 現状のbulkは取得失敗をそのまま status=error に反映する（index.ts:651）が、ネットワークを自分で切っただけの結果で作品メタデータを「取得失敗」に汚すのは筋が悪い。

### レート制限の集約

現状の制御は runDlsiteBulk 内の逐次sleep（既定1000ms、server/src/adapters/real/index.ts:212 にハードコードされ本番から設定不可）だけで、カバー画像DLはこの制御の外にある。

DLsiteへ出る全リクエスト（作品ページ・カバー画像・手動fetch）を単一のスケジューラに通し、**実HTTPリクエストの開始時刻の間隔**を一元的に保証する。オフラインフラグの判定もこのスケジューラに集約し、ここを通らずにDLsiteへ出る経路が残らないようにする。

なお「1件目にもsleepを入れる」ことは要件としない。プロセス起動後に直前のリクエストがなければ即送ってもレート制限違反にはならない。守るべきは連続するリクエストの間隔であって、初回の遅延ではない。

### リトライとバックオフ

現状リトライ・バックオフが皆無で、一時的なネットワークエラーも即 status=error として記録される（server/src/adapters/real/dlsite.ts:105-111）。

- 5xx・ネットワークエラー・429 に対して指数バックオフ付きのリトライ。jitter、最大バックオフ、総試行期限を設ける
- 429/503 の Retry-After を尊重する。cooldownはその1リクエストだけでなく、同じスケジューラの後続リクエストにも効かせる
- 404 はリトライせず not_found として扱う
- パース失敗はリトライ対象にしない（再取得しても結果は変わらない）
- リクエストのAbortに対応する
- リトライを尽くした失敗はエラーとして正しく伝播させる

### 設定と観測

最小リクエスト間隔・リトライ回数・最大バックオフ・タイムアウトを環境変数で設定可能にし、既定値を1箇所に集約する。キャッシュのhit/missとDLsiteへの実リクエスト数をログに出し、デバッグ時に負荷が確認できるようにする。

### ドキュメント

docs/ にDLsiteキャッシュ戦略（キャッシュキー・保存形式・outcome分類・TTL・容量とクリーンアップ・レート制限・オフラインフラグ・強制再取得とimportの手順）をまとめ、docs/README.md から辿れるようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 環境変数のフラグ1つでDLsiteへの実HTTPリクエストを完全に遮断でき、既定は無効である
- [x] #2 フラグ有効時、キャッシュヒットは通常どおり動作し、実ファイルを対象にした繰り返しスキャンがネットワークなしで完走する
- [x] #3 フラグ有効時のキャッシュミスはネットワークへ出ず明示的なofflineエラーになり、成功や空データを装わない
- [x] #4 offline miss はキャッシュへ書き込まれず、フラグを外せば再取得されることをテストで確認する
- [x] #5 offline miss で work_dlsite.status が error に更新されないことをテストで確認する
- [x] #6 作品ページ・カバー画像・手動fetchを含む全DLsiteリクエストが単一のスケジューラを通り、実リクエストの開始時刻間隔が守られる
- [x] #7 スケジューラを経由せずDLsiteへ出る経路が存在しないことを確認する
- [x] #8 5xx・ネットワークエラー・429でjitter付き指数バックオフのリトライが行われ、最大バックオフと総試行期限を超えたらエラーとして伝播する
- [x] #9 429/503のRetry-Afterが尊重され、cooldownが同じスケジューラの後続リクエストにも適用される
- [x] #10 404はリトライされずnot_foundとして扱われ、パース失敗はリトライ対象にならない
- [x] #11 リクエストのAbortに対応している
- [x] #12 最小リクエスト間隔・リトライ回数・最大バックオフ・タイムアウトが環境変数で設定でき、既定値のハードコードが1箇所に集約されている
- [x] #13 キャッシュhit/missとDLsiteへの実リクエスト数がログから確認できる
- [x] #14 docs/ にDLsiteキャッシュ戦略が明文化され、docs/README.md から辿れる
- [x] #15 実HTTPを新規に打たず、ユーザー提供または既存取得済みの実ページ試料がある場合にだけ実サイズとgzip圧縮率を測定してdocsへ記録する。試料不在なら親TASK-93完了前に明示未完とする
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TASK-93.2の取得サービスが呼ぶ単一transport/schedulerを実装し、作品HTML・カバー画像・手動fetchの全実HTTPをそこへ集約する。開始時刻の最小間隔を保証し、初回には不要な待機を入れない。
2. MIMIKAGO_DLSITE_OFFLINE を既定falseのbooleanとして追加する。cache hitは返し、missおよび強制再取得はネットワークへ出ず専用offlineエラーにする。offline由来の結果はキャッシュにもwork_dlsite.status=errorにも書かない。
3. 5xx、ネットワークエラー、429をjitter付き指数バックオフで再試行する。429/503のRetry-Afterはscheduler全体のcooldownへ反映する。404とparse_errorは再試行せず、Abortを伝播する。既定値と MIMIKAGO_DLSITE_REQUEST_INTERVAL_MS、MIMIKAGO_DLSITE_RETRY_COUNT、MIMIKAGO_DLSITE_MAX_BACKOFF_MS、MIMIKAGO_DLSITE_TIMEOUT_MS を1設定モジュールに集約する。
4. cache hit/missと実HTTP開始数を構造化ログへ出す。docs/にキー、BLOB、outcome/TTL、CLI、強制再取得、scheduler、offlineを記録し、docs/README.mdから参照できるようにする。
5. fake clock、注入transport、AbortSignal、一時SQLiteで、全経路の間隔、cooldown、Retry-After、再試行分類、offline、ログを実ネットワークなしで試験する。
6. 実HTTPを新規に打たない。ユーザー提供または既存取得済みの実ページ試料がある場合だけ、その実サイズとgzip圧縮率を測定してdocsへ記録する。試料が不在なら親TASK-93を完了する前に、この観測項目が未完であることを明示する。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実測（AC#15）は実ページ試料が不在のため未実施。TASK-100として分離した。schedulerのcooldown競合（Retry-Afterがqueue解放後に反映され後続をすり抜ける）を実装後のレビューで発見し 8f1792e で修正済み。
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 受け入れ条件に対応する実装・テスト・必要なドキュメントを完了している
- [x] #2 pnpm check が通る
- [x] #3 pnpm test が通る
<!-- DOD:END -->
