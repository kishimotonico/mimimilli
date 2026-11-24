---
id: TASK-520
title: smoke を同時に2本走らせても互いに落とさない
status: Done
assignee: []
created_date: '2026-11-23 20:25'
updated_date: '2026-11-24 05:32'
labels:
  - test
dependencies: []
priority: medium
ordinal: 639000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-517〜519 の並行作業中、別の worktree の smoke（playwright）が同時に走ると、CPU 負荷で互いの起動待ち・テスト内の待ちが超過して結果が壊れることが何度も起きた（TASK-518 の計測を汚した）。TASK-518 で起動待ちのタイムアウトは整えたが、同時実行は未検証。ロックで直列化するか、同時に走っても通るようにするかを決めて入れる。Fable の TASK-518 レビュー（統括の scratchpad の review-518-fable.md）の起票案から。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 2つの worktree で同時に pnpm test:smoke を5回ずつ回して全部通る、または直列化の仕組みが入り、同時に起動した2本目が1本目の終了を待ってから走る
- [x] #2 採った方式と根拠（計測を含む）がタスクのメモにある
- [x] #3 Windows ネイティブでも動く仕組みになっている（POSIX 前提のロックやシェルに頼らない）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
方式: 固定ポート(23417)のbindによる直列化(client/tests/smoke/smokeLock.ts, globalSetup)。mkdir+PID方式は、死亡判定とrenameが別操作で待機側の競合に穴があること・TMPDIR依存・Windowsでの rmSync 失敗と PID 再利用があるため不採用。bind は OS が所有者の死で解放するので PID 判定・奪取処理が不要で、Node の net のみのため Windows でも同じに動く。--ui/watch はロックを取らない。待機中は SIGINT/SIGTERM で中断できる。
計測(12スレッド): 単独 73 passed/2.1m。同時2本(ロック前)は両方3.9m(約1.85倍)で1件落ち。ロック後の直列10回(2worktree×5)で待機文言が出て同時走行は0。単独の実走は約2.0m(待ちを含む表示時間が4〜5.5mになるのはロック待ちを含むため)。
残る失敗の原因: WSL2 ミラードネットワークで eth0 のアドレスが数秒おきに付け直される時間帯があり、Chromium が通信を ERR_NETWORK_CHANGED で落とす。診断(warmUp の page に console/requestfailed を仕込み)で、失敗した worker にだけ ERR_NETWORK_CHANGED が134〜138件、発生時刻(05:10:56Z/05:18:43Z/05:21:51Z)が失敗時刻と一致し、`ip -ts monitor address` の Deleted/再追加(14:21:51 JST 等)と秒まで一致。メモリ(pswpout不変、MemAvailable>=5.8GB)・CPU(同負荷で2.0m全pass)・同時実行は原因ではない。
対処: 再試行で隠さず、失敗時に ERR_NETWORK_CHANGED を検知して環境起因の注記を出す(networkChange.ts、fixtures)。環境の事情は docs/HANDOFF.md のsmokeの注意へ。Chromium側の公開フラグは見つからず深追いしない。
最終確認: pnpm check && pnpm test は通過。pnpm test:smoke は 68 passed/5 failed、5件とも ERR_NETWORK_CHANGED の注記つき(warmUp1件+テスト4件)、同時間帯に ip monitor で9回のアドレス付け直しを確認。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
smoke を固定ポートの bind で全 worktree 直列化(2本目は待機文言を出して待つ)。残る失敗はホストのネットワーク変化(ERR_NETWORK_CHANGED)で、失敗時に環境起因と分かる注記を出し、docs/HANDOFF.md に原因と見分け方を記した。check/test 通過、smoke の失敗5件は全て同注記つき。
<!-- SECTION:FINAL_SUMMARY:END -->
