---
id: DRAFT-76
title: DLsite一括取得の運用を決める（結果の見返しと一括refresh）
status: Draft
assignee: []
created_date: '2026-09-23 18:23'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-63（DLsite一括取得の運用を決める）を、TASK-451の結論とTASK-461（現行コードとの前提照合）に合わせて作り直したもの。旧DRAFT-63はDRAFT-31/DRAFT-59を統合したもの。対象commitはf3920bd6。

## TASK-451で先行して決まったこと

DLsite連携の導線全体はTASK-451（Done、`docs/dlsite-flow-review-2026-09-21.md`）で調査・方針採用済み。このドラフトの論点1（結果の見返し）はTASK-451が先に検討し、ジョブID・作品別結果・専用管理ビューの方向まで具体化している。DLsite導線の残る詳細仕様（管理ビューの配置、登録時選択の既定値、サーバー再起動後の扱い、結果保持上限、一括承認の粒度）はDRAFT-74に集約されている。このドラフトはDRAFT-74と重複させず、DRAFT-74で扱う論点はDRAFT-74側に委ねる。このドラフトが固有に担うのは、一括取得結果API・失敗内訳の持たせ方、個別再取得の実装契約、一括refreshの要否という、DRAFT-74より実装契約寄りの判断である。

## 現行コードで確認できること

- 一括取得の対象選定は`selectDlsiteBulkTargets`（`server/src/adapters/real/dlsiteBulk.ts:41`）が行う。RJコードがある作品のうち、`dlsite.status`が`skipped`または`applied`のものを対象から除外する（`dlsiteBulk.ts:50-52`）。つまり適用済み（`applied`）の作品はTTLが切れても通常の一括取得の対象には入らない。旧DRAFT-63の「TTL経過で自然に取り直される」は適用済み作品には当てはまらないので、この記述を削除する。TTLが効くのは未適用（`none`など）の作品に対してだけである。
- `mode`（`DlsiteBulkMode`、"new"/"existing"）は`runDlsiteBulk`に渡されるが、現行実装では`dlsiteLogger.info`のログ出力に使われるだけで、取得対象の選定や適用内容には影響しない（`dlsiteBulk.ts:167`付近）。旧DRAFT-63が前提としていた「mode別の再適用」は現行コードには存在しないので、この記述も削除する。
- 一括取得結果（`DlsiteBulkResult`）はfetched/failed/parseErrors/skippedの合計値のみを返し、失敗理由の内訳（`DlsiteFetchErrorKind`ごとの件数）や失敗した作品のWork IDは持たない。強制再取得は`POST /dlsite/:id/fetch?force=true`による作品単位の操作のみで、複数作品をまとめて強制再取得するHTTP経路は存在しない（TASK-93.2で`includeApplied`を試みたが`DataAdapter`未対応のため2026-07-25に削除済み）。

## 論点を分けて書く

これまで「結果の見返し」に混在していた話を、対象・寿命が異なる3つとして分ける（TASK-451のF6・F8の整理に対応）。

1. 直近jobの結果を見返す: 完了したジョブ1回分の成功/失敗件数と、可能なら失敗作品の内訳。現状はトーストで一度出るだけで、後から開き直す入口がない。TASK-451はDLsite専用管理ビューをこの復帰先として採用済み。
2. 現在の取得状態を表示する: 各Workの現在のdlsite.status（未取得・取得成功で未適用・適用済み・取得失敗）を一覧できる状態。ジョブが完了したかどうかとは別に、いつでも参照できる必要がある。
3. 取得履歴を保持する: 過去に実行した複数回のジョブを遡って見られるようにするかどうか。TASK-451は「直近結果の保持上限」を未決としてDRAFT-74に送っており、全履歴の無期限保持は前提にしていない。

## このドラフトで決めること

- 一括取得結果APIに失敗内訳（`DlsiteFetchErrorKind`別件数）と対象Work IDを持たせるか。持たせる場合、`DlsiteBulkResult`の型と`dlsiteBulk.ts`の集計をどう拡張するか
- 個別再取得の導線を、既存の`POST /dlsite/:id/fetch?force=true`をそのまま使うか、結果画面から直接呼べる別経路を用意するかを判断する
- 一括での明示refresh（適用済み作品をまとめてTTL無視で再取得する操作）が必要かどうか。必要なら対象範囲・TTLの扱い・レート制限との兼ね合いを決め、不要なら「作品単位のforceで十分」と判断して閉じる

結果を見返す画面そのものの配置・レイアウトはDRAFT-74の管理ビュー検討に委ねる。このドラフトでは、その画面が必要とするAPI・データ契約側を決める。

## 旧ドラフトとの対応

旧DRAFT-63（archive済み）を全面的に作り直したもの。旧DRAFT-63はDRAFT-31/DRAFT-59を統合したものだった。TASK-451（Done）とTASK-461（現行コードとの前提照合）の成果。

## 受け入れ条件（このドラフトを昇格させるときの叩き台）

- 一括取得結果APIの失敗内訳・対象Work IDの持たせ方が決まっている
- 個別再取得の導線が決まっている
- 一括refreshの要否が判断され、必要なら対象範囲・TTL扱い・レート制限との兼ね合いが、不要ならその理由が記録されている
- 結果を見返す画面の配置・レイアウト自体はDRAFT-74に委ねる旨が明記されている
<!-- SECTION:DESCRIPTION:END -->
