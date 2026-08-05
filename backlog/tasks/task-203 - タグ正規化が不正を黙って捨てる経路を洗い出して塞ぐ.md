---
id: TASK-203
title: タグの正規化済み不変条件を型で表明する
status: In Progress
assignee:
  - impl-182
created_date: '2026-08-05 14:58'
updated_date: '2026-08-05 16:09'
labels: []
dependencies: []
priority: high
ordinal: 213000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ライブラリ再設計で予約文字契約（ADR-0012 §2）を導入した結果、同じ系統のバグが TASK-198・TASK-201・TASK-202 と3回にわたって別経路で見つかった。症状はいずれも「チップは表示されているのに絞り込みが効かず結果が空」だった。

根本原因は、タグが素の string であり「この値は正規化済みか」がコード上に現れないこと。各関数が正規化を忘れないという規律に依存しており、実際に3回破られた。

## 方針: 境界で正規化し、内部は正規化済みの型だけを扱う

parse, don't validate の原則に従う。

- normalizeTag / normalizeTags の戻り値を NormalizedTag（branded type）にする
- 正規化済みを前提とする関数（parseBuiltinAxisTag・splitSelectedTags・tagEquals・タグ比較や擬似タグ判定を行うもの）は NormalizedTag を受け取る
- 素の string を受け取るのは境界だけにする。境界とは、HTTP スキーマ（tagSchema）・URL 復元・ファイル読み込み（metaFileSchema）・外部連携（DLsite）の入口を指す

## この方針で得られるもの

1. TASK-202 の系統（正規化前の値で判定する）がコンパイルエラーになる
2. normalizeTags の呼び出し元22箇所のうち、検証を通っていない経路を型検査が自動的に洗い出す。人力での分類が不要になる
3. 各述語関数が内部で防御的に正規化する必要がなくなり、正規化の重複が消える

## あわせて整理するもの

normalizeTags は正規化後に空になるタグと重複を警告なしに捨てる。呼び出し元は22箇所あり、DLsite 連携のタグマージ経路が中心である。型の導入で入力が正規化済みに揃ったあと、この黙った除去が必要かを判断する。不要なら廃止し、必要なら前提と理由をコメントに残す。

AGENTS.md は「エラーは正しくハンドリングし問題を隠蔽しない」「過度なフォールバックは禁止」としており、黙って捨てる実装は本来これに反する。

## 進め方の注意

型を入れると多くの箇所がコンパイルエラーになる。それは想定どおりで、エラーの一つひとつが「ここで正規化されていない」という情報である。エラーを潰すために as でキャストして回避してはならない。境界であれば正規化を追加し、境界でなければ呼び出し元まで遡って NormalizedTag を受け取る形に直す。

## 検討して採らなかった案

述語関数が内部で毎回正規化する防御的な方式（TASK-202 の方針を全関数へ広げるもの）も考えられる。単純だが、値が正規化済みかどうかがコード上に現れず、正規化が各所で重複し、「忘れない」という規律への依存が残る。3回破られた規律に再び依存する形なので採らない。

対象: shared/src/work.ts / shared/src/pseudoTag.ts / shared/src/api.ts / shared/src/meta.ts / client と server の normalizeTags 呼び出し元
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 normalizeTag / normalizeTags の戻り値が NormalizedTag 型になっている
- [x] #2 正規化済みを前提とする関数が NormalizedTag を受け取り、素の string を渡すとコンパイルエラーになる
- [x] #3 素の string を受け取るのが境界（HTTPスキーマ・URL復元・ファイル読み込み・外部連携の入口）だけになっている
- [x] #4 型エラーの回避目的の as キャストが導入されていない
- [x] #5 型導入で洗い出された未正規化の経路がすべて塞がれている
- [x] #6 normalizeTags の黙った除去が廃止されているか、前提と理由がコメントに明記されている
- [x] #7 pnpm check と pnpm test と pnpm test:visual が通る
<!-- AC:END -->
