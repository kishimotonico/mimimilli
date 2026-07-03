# TypeScript API 実装の事後レビュー

Status: done — レビュー指摘は修正・回帰テスト追加済み

## 対象

- `1f7ea21 feat: API契約v2のsharedパッケージとTSサーバー骨格を実装`
- `9e63a34 feat: realアダプタを実装（SQLite + スキャナー + メディア配信 + DLsite）`

設計文書、共有契約、Hono ルート、fixture / real アダプタ、SQLite、スキャナー、メディア配信、DLsite 連携、既存テストを確認した。

## Findings

### High: メタファイル書き戻し失敗時に DB だけ更新される

`patchWork` と `dlsiteApply` は `repo.patchWork` で DB を先に更新し、その後 `patchMetaFile` を実行する。メタファイルが削除済み、読み取り専用、壊れた JSON などの場合、API は 500 になる一方で DB の title / tags / coverImage は更新済みになる。

これは `.meta.json` を Source of Truth とし、DB 編集とメタ更新を同一操作として扱う要件に反する。実際にメタファイル削除後の PATCH を実行し、例外後も DB の title が変更済みであることを確認した。

修正時は、更新後メタを検証・アトミック書き込みしてから DB を更新するか、失敗時に DB を確実にロールバックする。title / tags の DB 更新と `work_tags` 置換も DB トランザクションにまとめる。

### High: Windows で作品ルートの親子判定が壊れる

スキャナーの祖先判定が `parent + "/"` と `other + "/"` を使用している。Windows の `node:path` が返すパスは `\\` 区切りなので、既存メタ作品を飲み込むかの判定と、重複した候補ルートの統合が機能しない。

Windows を主要配布対象としているため、誤った祖先へ `.meta.json` を自動生成し、複数作品を一作品として扱う可能性がある。`relative` または区切り文字を意識しない共通の `isWithin` ヘルパーへ置き換え、`path.win32` を使った単体テストを追加する。

### Medium: 壊れた既存メタが `error` ではなく `missing` になる

スキャン開始時に全作品を `missing` にした後、`MetaParseError` は件数を増やすだけで DB 行をエラー状態へ戻さない。正常メタで一度登録した作品の JSON を壊して再スキャンすると、結果は `errors: 1, missing: 1` となり、作品は `status: "missing"`, `errorMessage: null` になった。

物理ファイルが存在するのに「行方不明」と表示され、ユーザーが直すべきメタ不正が隠れる。メタパスまたは読める範囲の ID / physicalPath で既存行を特定し、`status: "error"` と解析エラーを保存する。スキャン全体も、先に全件を破壊的に変更せず、検出結果確定後に未検出 ID だけを missing にする方が安全。

### Medium: DLsite 適用で販売ページ URL が保存されない

旧 Rust 実装は DLsite URL が未登録なら `{ label: "DLsite", url: info.url }` を追加していたが、real アダプタの `dlsiteApply` は title / tags / coverImage しか更新しない。`urls` はメタ形式の正式フィールドであり、移植後は DLsite 適用を実行しても販売ページへの導線が残らない。

`urls` を重複排除して追加し、DB とメタファイルの両方へ書き戻すテストを追加する。

### Medium: スマートフォルダーの `sort` が評価結果に反映されない

スマートフォルダー作成・更新では `sort` を保存するが、`evalSmartFolder` は rules のフィルター結果をそのまま返す。fixture / real の双方で同じため、`title-asc` や `duration-desc` を指定しても DB / fixture の元順のままになる。

作品検索と共通のソート関数を使用し、各 sort 値を指定した API テストを追加する。

## Verification

- `pnpm check`: 成功
- `pnpm test:server`: 成功（8 test files）
- 追加の障害系確認:
  - メタ削除後の PATCH が失敗しても DB title が変更済み
  - 登録済みメタを壊した再スキャンで `status: missing`, `errorMessage: null`

既存テストは正常系と主要な結合経路を押さえているが、ファイル書き込み失敗、再スキャン時のメタ破損、Windows パス、DLsite URL、スマートフォルダー sort の回帰をカバーしていない。

## 修正方針

- SQLite トランザクション内で DB 更新と同期的なメタ書き戻しを実行し、メタ更新失敗時は DB をロールバックする
- スキャン開始時の全件 `missing` 更新を廃止し、走査完了後に未検出 ID のみを `missing` にする
- 壊れたメタは JSON 内の ID または既存の完全一致 physicalPath で作品を特定し、解析エラーを `status: "error"` として保存する。推測による作品特定は行わない
- OS ネイティブパスの親子判定と相対化を `node:path.relative` ベースの共通関数へ統一し、Windows パスを `path.win32` で検証する
- API が返す Windows 絶対パスに対して、client の Files パンくず操作も `\\` 区切りを明示的に扱う
- DLsite URL を重複なく `urls` へ保存し、スマートフォルダー評価時に保存済み sort を必ず適用する

## 実装結果

- `patchWork` / `dlsiteApply` は SQLite トランザクション内でメタファイルを書き戻す。書き戻し例外時は DB 更新もロールバックされる
- スキャナーは走査完了後に未検出 ID のみを `missing` にし、既存作品の壊れたメタは ID または完全一致 physicalPath で `error` として記録する
- パス親子判定を `node:path.relative` ベースへ統一し、スキャナー、FS 所有作品判定、トラバーサル検証、相対トラック生成で共用する
- client の Files パス操作は POSIX / Windows の区切り形式をルートから明示的に判定する
- DLsite 適用時に販売ページ URL を DB / メタへ保存する
- スマートフォルダーは保存済み sort を適用し、未対応 field/operator は shared 契約と評価処理の双方で拒否する
- 明示された `defaultPlaylist` が存在しない場合の先頭プレイリストへの暗黙切替を廃止した

## 最終検証

- `pnpm check`: 成功
- `pnpm test:server`: 成功（9 test files）
- `client/ pnpm test`: 成功（38 tests）
- `client/ pnpm build`: 成功
