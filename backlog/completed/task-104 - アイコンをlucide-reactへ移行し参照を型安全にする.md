---
id: TASK-104
title: アイコンをlucide-reactへ移行し参照を型安全にする
status: Done
assignee: []
created_date: '2026-07-26 13:48'
updated_date: '2026-07-26 15:41'
labels: []
dependencies: []
ordinal: 105000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
自作47アイコンのうち一般アイコンをlucide-reactへ置換し、あわせてアイコン参照の型安全化と暗黙フォールバックの廃止を行う。現状 I: Record<string, IconFC> は存在しないキーを型エラーにせず、5箇所の ?? I.folder / ?? I.file が欠落を隠している。また既存SVGの一部(search は Lucide の Search とパス座標まで一致)は出自記録がなく、出自の明確な実装へ置き換える意味がある。呼び出し側34ファイル・118参照は I をアダプタ層として維持することで無変更を保つ。選定根拠は Claude と Codex の二者で検討し、小サイズ(13px以下が40箇所)で strokeWidth による線幅補正ができること、通常のReact SVGであること、filledカタログの必要性が低いことから lucide-react を採用した。reicon は strokeWidth が無言で効かない実装のため見送り、Its Hover は演出用途として基盤セットから除外した。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 一般アイコンが lucide-react 由来のコンポーネントで描画される
- [x] #2 製品固有アイコン(ratio11・gridJustified・loopOne・swapLR・プレイヤー系)は自作のまま残る
- [x] #3 I のキーが型で確定し、存在しないキーの参照が typecheck で失敗する
- [x] #4 ?? I.folder / ?? I.file による暗黙フォールバックが存在しない
- [x] #5 呼び出し側から lucide-react を直接 import している箇所がない
- [x] #6 9px・10px・12px・13px でのアイコン視認性に現状からの退行がない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
サブタスク3件完了。visual test 6件すべて通過。9〜13pxの視認性はcanvasラスタライザで移行前後を比較し退行なしを確認。派生タスクとして TASK-105(線幅補正、完了)・TASK-106(noUncheckedIndexedAccess、完了)・TASK-108(フォント自前ホスト、未着手)。
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 client build が通り、visual test のスナップショット差分を確認済み
<!-- DOD:END -->
