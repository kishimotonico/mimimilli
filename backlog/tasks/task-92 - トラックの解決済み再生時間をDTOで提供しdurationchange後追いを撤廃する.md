---
id: TASK-92
title: トラックの解決済み再生時間をDTOで提供しdurationchange後追いを撤廃する
status: To Do
assignee: []
created_date: '2026-07-24 15:03'
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
