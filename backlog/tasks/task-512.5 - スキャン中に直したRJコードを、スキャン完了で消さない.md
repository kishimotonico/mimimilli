---
id: TASK-512.5
title: スキャン中に直したRJコードを、スキャン完了で消さない
status: Done
assignee: []
created_date: '2026-11-19 15:00'
updated_date: '2026-11-19 17:25'
labels: []
dependencies: []
parent_task_id: TASK-512
ordinal: 587000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
スキャン中に候補のRJコードを直しても、完了時にスキャンのセッションが差し替わって上書きが消える。上書きをスキャンのセッションの外に持たせて解決する（完了時に引き継ぐ処理を足す形にはしない）。上書きを消すのは、そのフォルダーを登録したときと、そのフォルダーが候補から消えたときだけ。architecture.md の指摘1（候補・RJコード上書き・スキャン記録をサーバー層の1つの集約にまとめ、routes/works.ts の forgetWork 手呼びと replacedWorkId をなくす）まで広げるかは統括が判断して最終サマリーに書く。根拠は tmp/task-512/advisor-decisions.md の4と tmp/task-512/review/architecture.md。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 スキャン中に直したRJコードが、スキャン完了後も候補に残っている（テストで固定）
- [x] #2 完了時に上書きを引き継ぐ・コピーする処理が無い
- [x] #3 fixtureとrealの両adapterで同じ挙動になる
- [x] #4 check・test・smoke が通る
- [x] #5 上書きは候補から登録したとき、または次のスキャン完了で候補のプールから外れたときにだけ消える（それぞれテストで固定）
- [x] #6 候補プールと上書きと記録がサーバー層の1つの集約にあり、ScanCandidateSession・fixtureの scanCandidateRjCodeOverrides が無く（rgで0件）、effectiveRjCode が server/src/adapters 配下に無い
- [x] #7 forgetWork・replacedWorkId・duringScan.forgotten が無く（rgで0件）、記録は読むときに存在しない作品を落とす（テストで固定）
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
候補プール・RJコード上書き・root の同一性・スキャン記録をサーバー層の集約 ScanSession にまとめた（server/src/scanSession.ts）。上書きはプロセス寿命で持ち、候補から登録したときと次のスキャン完了で候補のプールから外れたときだけ消える（完了時の引き継ぎ処理は無い）。仕様変更: 前回スキャン後に直して追加しないまま再スキャンしても、プールに残っていれば値が残る。root 変更では捨て、同じ root の再構築では残す。除外では消さない。fixture は起動直後の候補を持たず、作品で覆われたフォルダー（祖先を含む）をプールから除いて real と揃えた。記録は forgetWork の手呼びをやめ、読むときに作品の実在で照合する（新たな行方不明だけは status が missing のままのもの）。duringScan の added と integrityResolved は残す（候補からの登録はスキャン結果に入らず、読み直しの成功は実在照合では判別できないため）。あわせて、real の登録側の再採番で旧IDの行が登録側を指したまま残り同じフォルダーの行が2つになっていた不具合を直した（旧IDの行はコピー側へ移し、移す先が無ければ行方不明、ユーザー状態は旧IDに残る。投影は1回の publish）。ADR-0037 を追加。bun test --parallel の失敗2回は、別の bun プロセスと同じ worktree で同時に動いた回だけで、差分由来ではないと判断した。
<!-- SECTION:FINAL_SUMMARY:END -->
