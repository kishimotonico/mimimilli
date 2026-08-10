---
id: TASK-291
title: dlsite-cacheにexport --dirを追加しキャッシュを長期アーカイブ可能にする
status: To Do
assignee: []
created_date: '2026-08-10 09:31'
updated_date: '2026-08-10 09:46'
labels: []
dependencies: []
priority: high
ordinal: 301000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 背景

DLsiteキャッシュのCLI（server/src/dlsiteCacheCli.ts）は import に --dir があるのに export は --product-code 単体しかなく、"生HTMLをディレクトリへ書き出して長期保管し、必要なら import --dir で丸ごと戻す" 運用の出す側だけが欠けている。

数千件規模の作品を管理する想定では、カタログDBを作り直すたびに同じ件数の作品HTMLをDLsiteへ取りに行くことになる。実HTTPなしでキャッシュを復元できる手段があれば、これを丸ごと避けられる。

生HTMLのディレクトリはDBファイルのバックアップと違い、スキーマ変更を跨いで生き残る。また import はHTML snapshotを成功記録として書くため、取り込み時点からTTLが振り直され、実質無期限のアーカイブになる。これによりTTLの可変化（TASK-99で意図的に定数化した経緯がある）を再導入せずに済む。

## スコープ（この機能で削減できるリクエスト）

削減対象は**作品HTMLのリクエストのみ**。次の2つは対象外で、復元後も実HTTPが発生しうる。

- 取得失敗記録（dlsite_fetch_failures、dlsiteCache.ts:182-190）。404・通信失敗の作品は復元後に再取得される。TTLが3日・1時間と短くどのみち期限切れになるため、アーカイブする価値が薄い
- カバー画像。ローカルにカバーがない作品は、HTMLがcache hitしても一括適用でカバー取得へ進む（dlsiteBulk.ts:197-210）。適用済み作品のカバーは作品フォルダーへ保存されるため、通常は再取得されない

docsにもこの範囲を明記する。

## 設計メモ

- DlsiteCache#exportHtml はTTLを見ない（dlsiteCache.ts:387）。期限切れでもcleanup前なら書き出せる。この挙動をそのまま使う
- DBにはgzip圧縮済みBLOBで入っている（gzipSync、dlsiteCache.ts:223-234）ため、--dir出力は展開せず .html.gz でそのまま書くのが速くて小さい（作品HTMLは概ね10分の1程度になる）
- import側はheaderのmagic byte（0x1f 0x8b）でgzipを判定するので、.html.gz はそのまま読み戻せる
- 命名規約は import --dir と同じ <RJまたはVJコード>.html[.gz]
- **representation**: snapshotの主キーは (store, product_code, representation) で複数行を許す（dlsiteCache.ts:169-179）が、ファイル名はproduct codeだけなので旧representationの行があると衝突する。かつ import は常に現行representationへ書き戻すため、旧HTMLの復元はrepresentation更新によるキャッシュ無効化を破る。**export対象は現行representationの行だけに限定する**
- **出力先**: 上書きだけでは、前回export後にDBから消えたproduct codeのファイルが残り、import --dir が削除済みsnapshotを復活させてしまう。出力先は存在しないか空のディレクトリのみ許可する
- **importのサイズ上限**: 現在 readImportFile はファイルサイズを転送上限2 MiBで弾く（dlsiteCacheCli.ts:44-50）が、DBには展開後最大8 MiBの本文がgzipで入りうるため、圧縮率が低いHTMLでBLOBが2 MiBを超えると往復できない。転送上限はHTTP由来のガードでローカルファイルには不適切なので、import側の判定を展開後サイズ基準へ統一する
- 単体の export --product-code --file は非圧縮のまま変更しない
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 export --dir <path> が現行representationのHTML snapshotのみを全件 <PRODUCTCODE>.html.gz として書き出す（gzip済みBLOBを無展開、TTL切れの行も対象）
- [ ] #2 出力先は存在しないか空のディレクトリのみ許可し、非空ならエラーで中断する
- [ ] #3 結果を import --dir と同形式のJSON（成功件数・失敗ファイル名と理由）で返し、1件の失敗で全体を止めない
- [ ] #4 ローカルファイルimportのサイズ判定を展開後サイズ基準に統一し、転送サイズ由来の2 MiB判定を外す
- [ ] #5 export --dir → import --dir の往復で全件が同一HTMLとして復元されることをテストで確認する（展開後8 MiB近傍の行を含む）
- [ ] #6 CLIのusage文字列と docs/dlsite.md を更新する（バックアップ・復元手順、復元対象がHTML snapshotのみである旨を含む）
- [ ] #7 pnpm check && pnpm test が通る
<!-- AC:END -->
