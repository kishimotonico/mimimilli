---
id: TASK-92
title: トラックの解決済み再生時間をDTOで提供しdurationchange後追いを撤廃する
status: To Do
assignee: []
created_date: '2026-07-24 15:03'
updated_date: '2026-07-24 15:27'
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
- [ ] #1 Track(またはPlaylist経由のDTO)に解決済み durationSec が含まれる。end-start、end未指定は audio_probe_cache から解決。Zod契約を更新
- [ ] #2 client がサーバー提供の durationSec を初期表示から使い、durationchange 待ちによる 0:00 フラッシュが起きない
- [ ] #3 audioEngine の durationchange 依存と durationSec=0 フォールバック/リセットが、確定データ利用に置き換わる（過度なフォールバック解消）
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
型名で未解決トラックをplayerへ渡す誤りを防ぐ。既存 Track の意味をどちらにするかは影響大なので実装冒頭で確定。

## duration解決式(共通関数をserver側に)
startSec = track.start ?? 0
durationSec = track.end !== undefined ? track.end - startSec : (fileDurationSec != null ? fileDurationSec - startSec : null)
DTO・totalDurationSec・resume検証で同一式を使う。現行scannerの不整合(start有end無でファイル全長を加算、end有start無が不要probe等)も本タスクで是正。fileDurationSec(ファイル全体長) と durationSec(トラック相対長)を命名で使い分け。start/endは絶対ファイル時刻、durationSecは相対。契約コメントに明記。

## 計測失敗(ユーザー決定=明示的な未知null)
probe結果を内部で区別: 正の有限値/ファイル欠損/非対応・解析失敗/キャッシュ未取得。未知を0にしない。DTOは durationSec: number|null。null時UIは0:00でなくシーク無効等の明示的未知。Zod制約は finite かつ positive(nullは別途明示)。丸めは表示時のみ。関連: totalDurationSec も probe失敗0加算をやめ、共通probe結果型+エラーポリシーで一緒に是正(監査追加候補も本タスクに畳み込む)。

## 全プレイリストを解決対象
scannerのbuildProbeCache/registerMetaFileはデフォルトplaylistのみprobe。詳細DTOは全playlistを返すため、全playlistの全トラックを重複ファイルまとめてprobeする。デフォルトだけ解決済みの契約は避ける。

## 派生値の保存先
playlists_json(正本)には書かない。tracks関係表に duration_sec 派生列を追加し、詳細DTOは track ID で合成。getWork時は作品内全ファイルパスを一括取得してN+1回避(現 cachedFileDurationSec は1トラック用でそのまま流用不可)。

## Filesモード(ユーザー決定=従来経路を残す)
Filesモード(App.tsx handlePlayFileの即席Track)は durationchange 経路を残す。TASK-92のACは『登録作品のplaylist』に限定。audioEngineのdurationchangeは完全撤廃せず、Filesモード専用の明示経路として残す(一般フォールバックにはしない)。登録トラック=サーバーdurationSec、Filesトラック=durationchange、と経路を型/分岐で明確に分ける。

## client
playerControllerの startRequested/withTrackIndex で選択trackのdurationSecを即設定(stopRequestedの0はOK)。getCurrentPlaybackContext/seekクランプ/MediaSession position state/同一音源の区間切替/resume復元/ABリピート/WorkTrackListの時間表示をDTO基準へ。WorkTrackListは現在start&end両有のみ時間表示だが解決後は全トラックでdurationSec使用。audioDurationChangedイベント/callback/reducer inputはFiles経路を除き撤廃し権威を一本化。

## fixture/テスト
fixtureの各Trackにも決定的 durationSec を付与しrealと同一契約。テストケース: end-start / end有start無 / start有end無 / 両無 / 同一ファイル複数区間 / デフォルト外playlist / probe失敗 / Filesモード。real/fixture両方。
<!-- SECTION:NOTES:END -->
