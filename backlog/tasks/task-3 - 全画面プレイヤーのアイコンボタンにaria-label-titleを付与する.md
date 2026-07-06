---
id: TASK-3
title: 全画面プレイヤーのアイコンボタンにaria-label/titleを付与する
status: Done
assignee:
  - '@claude'
created_date: '2026-07-05 17:58'
updated_date: '2026-07-06 02:35'
labels:
  - ui
  - player
dependencies: []
references:
  - docs/issues/2026-07-03-live-ui-ux-review.md
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
全画面プレイヤー内の前/次/ループなどのアイコンボタンがagent-browserのスナップショットで単なるbuttonとしか認識されず、アクセシブル名がない。ポップアップ側は「前のトラック」「次のトラック」「ループ」などの名前が付いているため、全画面側だけ一貫性が弱い。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 全画面プレイヤーの各トランスポートボタン（前/次/ループ等）にaria-labelとtitleを付与する
- [x] #2 状態を持つボタン（ループなど）にはaria-pressedも付与する
- [x] #3 IconButtonコンポーネントに収まらない専用の円形ボタンにも同じアクセシブル名付与ルールを適用する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. FullScreenPlayer.tsxのトランスポートボタン（−10/前/再生・一時停止/次/+10/ループ）にaria-labelとtitleを付与
2. ループボタンにaria-pressed={loop}を付与、再生ボタンは状態でラベル切替（再生/一時停止）
3. 命名はポップアップ側（PopupContent/BarContent）の既存アクセシブル名と一貫させる
4. 音量スライダー等、同画面内の他の無名コントロールも同一ルールで対応
5. 実装はCodexへ委譲、agent-browserのスナップショットでアクセシブル名を検証、コミットはClaude

備考: TASK-22でjsx-a11yプラグイン導入済み。同じFullScreenPlayer.tsxを触るTASK-2はこのタスク完了後に着手する
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装はCodex（codex exec）へ委譲、レビュー・検証・コミットはClaude。

- 命名はポップアップ側と一貫: 10秒戻る/10秒進む/前のトラック/次のトラック/ループ/一時停止・再生
- 音量スライダーはポップアップ側が aria-label=`音量 ${volume}%`（値込み）なのに対し、全画面側は名前を「音量」で固定（値はaria-valuenowで取得可能なためこちらが適切。ポップアップ側の揃え直しはTASK-2等で検討）
- 検証: agent-browserのa11yスナップショットで全コントロールのアクセシブル名を確認、ループのaria-pressedがクリックでfalse→true→falseと切替わることを確認。pnpm check通過
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
全画面プレイヤーのトランスポートボタン6種と音量スライダーにaria-label/titleを付与（ループはaria-pressed対応、再生は状態でラベル切替）。命名はポップアップ側と統一。a11yツリーとpnpm checkで検証済み（コミット ce7ed8c）
<!-- SECTION:FINAL_SUMMARY:END -->
