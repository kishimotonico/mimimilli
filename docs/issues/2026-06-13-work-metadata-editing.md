# 作品メタデータ編集 UI

Status: done

## 目的

作品詳細から、ブックマーク、タイトル、タグを更新できるようにする。

## 方針

- `PATCH /api/works/:id` は `LibraryView` の mutation から呼び出す。
- 更新後の作品を詳細キャッシュへ即時反映し、一覧、総件数、ファセット、スマートフォルダー評価を invalidate する。
- タイトルとタグは通常表示から明示的に編集モードへ切り替える。
- タグ編集ではフラットタグだけを追加・削除できるようにする。
- 構造化タグは表示のみとし、保存時に元の作品から保持してフラットタグと再合成する。
- タグ合成は純粋関数へ切り出し、`parseTag` による分類と重複排除を単体テストする。

## 検証

- `pnpm check`: 成功
- `pnpm test`: server 11 件、client 56 件が成功
- `cd client && pnpm exec playwright test --update-snapshots`: sandbox が `127.0.0.1:4175` の listen を `EPERM` で拒否し、webServer 起動前に失敗
- `cd client && pnpm exec playwright test`: 同じ sandbox 制約で失敗
- `agent-browser --session codex-edit`:
  - ブックマーク解除でお気に入り一覧が 4 件から 3 件、再追加で 4 件へ戻ることを確認
  - タイトル変更が詳細と作品一覧へ反映されることを確認
  - フラットタグ追加でタグファセットが 21 件から 22 件へ増え、該当作品 1 件へ絞り込めることを確認
  - タグ削除後にファセットが消え、構造化タグが保持されることを確認
  - 確認用のタイトル、タグ、ブックマークは元データへ復元済み

## 実装結果

- ブックマークボタンを実働化し、選択状態を塗りで表示する。
- タイトルはインライン入力で Enter 保存、Esc キャンセル、空文字保存不可とする。
- タグ編集では構造化タグを表示専用、フラットタグを追加・削除可能とする。
- タグ候補は `/api/tags` から取得し、`datalist` で補完する。
- 更新成功時は詳細キャッシュを更新し、works、libraryTotal、facets、smartFolderWorks、workDetail、tags を invalidate する。
- 更新失敗は `console.error` と詳細内のエラーメッセージで通知する。
- Playwright にはタグ編集モードのパネルスナップショットテストを追加したが、この環境ではベースライン画像を生成できていない。
