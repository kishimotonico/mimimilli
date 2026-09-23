---
id: DRAFT-75
title: 行方不明（missing）作品の除外フラグと再登録ブロック
status: Draft
assignee: []
created_date: '2026-09-23 18:23'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-66（行方不明（missing）作品の除外フラグと再登録ブロック）を、TASK-461（現行コードとの前提照合）に合わせて作り直したもの。旧DRAFT-66はさらにDRAFT-23の書き直しだった。対象commitはf3920bd6。

## 現行コードで確認できること

- 通常スキャンは未登録フォルダーを自動でWork登録しない。`ScanUpsertBatch`（`server/src/adapters/real/scanUpsertBatch.ts`）が扱うのは既存metaを持つ作品のupsertだけで、metaのないフォルダーは`collectCandidates`（`server/src/adapters/real/scanner.ts:352`）が候補として列挙するのみ。候補をWorkにするのは`ScanCandidateSession.registerCandidates`（`server/src/adapters/real/scanCandidateSession.ts:60`）を呼ぶ明示的な登録操作だけであり、スキャン自体が復活させることはない。旧DRAFT-66の「メタ削除後も音声フォルダーが残っているとscannerの自動生成で復活する」という説明は誤りなので削除する。
- `DELETE /works/:id`（`server/src/routes/works.ts:119`）は`unregisterWork`（`server/src/adapters/real/workRegister.ts:167`）経由で`catalog.deleteWorkCatalog`（`server/src/adapters/real/catalogWorkRepository.ts:123`）を呼び、works・workTags・workDlsiteの行をすべて削除する。metaファイルも退避後に削除する。旧DRAFT-66が「解消済みの前提」として書いていた「DELETEエンドポイントが存在しない」はすでに古い記述で、今回さらに「metaも消す」契約であることを明記する。
- 削除してもWorkレコードとmetaは消えるが、音声フォルダー自体は残る。次回スキャンでは、metaのないそのフォルダーが再び未登録候補として列挙される（削除がscanner側でWorkを自動生成して復活させるのではなく、候補一覧に再度現れるだけ）。これを恒久的に消すには、候補ごとに「除外」操作を別途行う必要がある。
- 候補の「除外」はすでに実装済みの機能である。`UserWorkStateRepository.listScanCandidateExclusions`/`excludeScanCandidates`（`server/src/adapters/real/userWorkStateRepository.ts:218`付近）がroot+path単位で除外パスを保持し、`ScanCandidateSession.listCandidates`（`scanCandidateSession.ts:52`）が候補一覧からその除外パスを取り除く。さらに`registerCandidates`は`listCandidates`が返す集合からしか選べないため、除外済みパスは登録もできない（`scanCandidateSession.ts:66`以降、除外パスは`byPath`に存在せず`CandidatePoolChangedError`になる）。UIは`UnregisteredTab.tsx`（`client/src/features/scan/ui/scanModal/UnregisteredTab.tsx:104`）の「除外」ボタンから呼ぶ。つまり旧DRAFT-66が未実装として挙げていた「案C: フォルダーパス単位の再登録ブロックリスト」は、候補非表示と表裏一体のものとしてすでに存在する。

## 3つの概念を分けて書く

これまで1つの「除外」に混ざっていた話を、対象・寿命・実装状況が異なる3つの仕様として分ける。

1. 候補非表示・登録禁止（実装済み）: 対象はroot+path。scan候補として二度と出さず、その状態のままでは登録もできない。ユーザーが個別候補に対して明示的に行う操作で、今回新たに設計する要素はない。UIで「除外済み一覧の確認・解除」がどこまで見えるかは別途確認する。
2. 既存Workの論理除外（未実装）: 対象はWork ID。すでに登録済みのWorkについて、「今は見つからない・使わない」を通知や欠損バッジの対象から外しつつ、Workのメタデータと再生履歴は残したい場合の仕様。外付けドライブの一時的な取り外しなど、`missing`状態が実質的に長期化するケースを想定する。DLsite連携の`skipped`ステータス（`shared/src/dlsite.ts`、`WorkStatusWarnings.tsx`）と同様に、「対象外である」という状態を明示的に持たせる方向で、DBマイグレーション（Workへの除外フラグ追加）を伴う。
3. 削除済みフォルダーの再登録ブロック（実装済み、上記1と同じ機構）: DELETEでWorkとmetaを消したあとも音声フォルダーが残っていて次回スキャンで候補に再度現れる場合、候補の「除外」操作をすれば恒久的に候補一覧から外せる。DELETE操作自体が自動でこの除外を行うわけではない点を明記する。DELETE直後に自動で除外まで行うかどうかは、削除フローの体験として別途判断が必要な論点として残す。

## 進め方

案2（既存Workの論理除外）だけが未実装の残課題である。TASK-299（ライブラリからの削除導線）と、DLsite連携のDRAFT-74・専用管理ビューの検討が先に進んでから、除外フラグの要否・UI配置（欠損バッジ・通知・専用ビューのどこから操作するか）を固める要件タスクを切るのが妥当。

## 受け入れ条件（このドラフトを昇格させるときの叩き台）

- 既存Workの論理除外フラグの対象（Work ID単位）とスコープ（通知・欠損バッジ・一覧表示のどこから除外するか）が明示されている
- 除外フラグを立てる操作・解除する操作の入口が決まっている
- 削除済みフォルダーの再登録ブロックが既存の候補除外機能で足りるのか、DELETE操作と連動させる追加実装が要るのかが判断されている

## 旧ドラフトとの対応

旧DRAFT-66（archive済み）を全面的に作り直したもの。旧DRAFT-66はDRAFT-23の書き直しだった。TASK-461（現行コードとの前提照合）の成果。
<!-- SECTION:DESCRIPTION:END -->
