---
id: TASK-92
title: トラックの解決済み再生時間をDTOで提供しdurationchange後追いを撤廃する
status: In Progress
assignee: []
created_date: '2026-07-24 15:03'
updated_date: '2026-07-25 10:26'
labels: []
dependencies: []
priority: high
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-91と同型のデータ不足由来アンチパターン。トラック(shared/src/work.ts trackSchema)は start/end(optional)のみで、end省略時(ファイル全体再生)の絶対長を持たない。そのため client は HTML5 Audio の durationchange イベントを待ち(audioEngine.ts:63)、待つ間シークバー・残り時間が 0:00 にフラッシュ/ジャンプする(useAudioEngineLifecycle.ts:183 が end未指定で durationSec=0 を返し、playerController が切替毎に0リセット)。曲送りのたびに発生。サーバーは既にファイル全体長を audio_probe_cache に持ち(probe.ts)、resume検証で cachedFileDurationSec として使用済み(workRepo.ts:316-322,251-254)。つまり『サーバーは知っているのにDTOに載せていない』欠損。トラック単位の解決済み durationSec(end-start、end未指定なら probe cache 解決値)を一覧/詳細DTOに露出し、client のイベント後追いと0フォールバックを撤廃、確定表示にする。設計方針・契約拡張・バックフィルの考え方は TASK-91 と共有。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Track(またはPlaylist経由のDTO)に解決済み durationSec が含まれる。end-start、end未指定は audio_probe_cache から解決。Zod契約を更新
- [x] #2 client がサーバー提供の durationSec を初期表示から使い、durationchange 待ちによる 0:00 フラッシュが起きない
- [x] #3 audioEngine の durationchange 依存と durationSec=0 フォールバック/リセットが、確定データ利用に置き換わる（過度なフォールバック解消）
- [ ] #4 probe cache 未取得トラックの扱いが過度なフォールバックにならない形で明示されている。1ファイル内マルチトラック(start/end指定)も正しい残り時間になる
- [ ] #5 pnpm check・pnpm test が通り、曲送り・シークの回帰が確認されている
<!-- AC:END -->





## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
設計確定(2026-07-24, ユーザー決定+Codexレビュー反映)。

## スキーマ分離(必須・最重要)
trackSchema/playlistSchema は metaFileSchema 経由で .meta.json 正本にも使われる(shared/src/meta.ts:14, server meta.ts:39)。ここに必須 durationSec を直接足すと正本に派生値を要求してしまい目的と逆。入力用と解決済み出力用を分ける:
- trackSchema(=TrackSpec): .meta.json/正本用。id/title/file/start/end。据え置き
- resolvedTrackSchema(=ResolvedTrack): TrackSpec + durationSec。API DTO用に新設
- playlistSchema(正本) と resolvedPlaylistSchema(API DTO)も分離

## duration解決式(共通関数をserver側に)
startSec = track.start ?? 0
durationSec = track.end !== undefined ? track.end - startSec : (fileDurationSec != null ? fileDurationSec - startSec : null)
DTO・totalDurationSec・resume検証で同一式を使う。fileDurationSec(ファイル全体長) と durationSec(トラック相対長)を命名で使い分け。start/endは絶対ファイル時刻、durationSecは相対。

## 計測失敗(ユーザー決定=明示的な未知null)
未知を0にしない。DTOは durationSec: number|null。null時UIは0:00でなくシーク無効等の明示的未知。

## Filesモード(ユーザー決定=従来経路を残す)
Filesモード(App.tsx handlePlayFileの即席Track)は durationchange 経路を残す。ACは『登録作品のplaylist』に限定。

## 派生値の保存先(2026-07-25 ユーザー決定で変更)
当初 tracks.duration_sec 派生列を追加する方針だったが、実装後のレビューで
「end指定済み=end-startで自明ゆえ列は冗長 / end未指定=読み取り時に列を無視しaudio_probe_cacheから都度解決ゆえwrite-onlyな死にデータ」
と判明したため、**列は廃止し動的解決一本に確定**。migration 0006 は audio_probe_cache.duration_sec の NULLABLE 化のみ。
getWork は end未指定トラックの参照ファイルパスを作品内一括取得して N+1 を回避する。

## 実装状況(2026-07-25)
- phase1(shared/server) 完了: コミット 26294a6
- phase2(client) 完了: コミット 0944824
- pnpm check 通過、pnpm test 全緑(server 267 / client 301)
- 残: 実機検証(dev DBリセット+dev server再起動が必要。曲送りの0:00フラッシュ消失・シーク・区間切替)、Codex敵対的レビュー反映

## 検討事項(未決)
client の Files/登録トラック判別が `"durationSec" in track` の構造チェック(trackTime.ts isResolvedTrack)。
zod検証済みDTOなので実行時は安全だが、登録トラック側で durationSec が欠落すると黙って旧 durationchange 経路へ退行する形。
Filesモード側に明示タグを持たせる案は保留中。
<!-- SECTION:NOTES:END -->
