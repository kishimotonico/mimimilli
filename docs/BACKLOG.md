# バックログ

未完了タスクの一元管理。詳細な背景・改善案は各リンク先の issue を参照する。
新しい残タスクが出たらここに追記し、着手・完了時に行を更新（完了したら削除してよい。経緯は issue と Git 履歴が持つ）。

最終更新: 2026-07-03。

## UI/UX 改善（実装済み機能の磨き）

出典は主に [issues/2026-07-03-live-ui-ux-review.md](issues/2026-07-03-live-ui-ux-review.md)（各項目の改善案の詳細あり）。

| 優先度 | 項目 | 出典 |
|---|---|---|
| 高 | 検索0件時の空状態: 原因（検索語/フィルタ）の明示と検索クリア導線 | live-review §1 |
| 高 | 全画面プレイヤーのモーダル化: 背面 `inert`・フォーカストラップ・Esc後のフォーカス復帰 | live-review §2 |
| 高 | 全画面プレイヤーのアイコンボタンに `aria-label`/`title`（状態持ちは `aria-pressed`） | live-review §3 |
| 中〜高 | タグ削除の誤操作耐性: hover時のみ強調 + undo トースト | live-review §4 |
| 中 | タグ追加ポップオーバーの幅・展開方向の改善 | live-review §5 |
| 中 | 900px幅でのスマートフォルダールール表示の折り返し・可読性 | live-review §6 |
| 中 | トラック行クリックと右端再生ボタンの役割整理 | live-review §8 |
| 低〜中 | 並び替えメニューの選択中マークの明確化 | live-review §7 |
| 低〜中 | TanStack Query Devtools ボタンとプレイヤーUIの位置競合の解消 | live-review §9 |

## プレイヤー

| 項目 | 備考 |
|---|---|
| L⇄R入替の UI 配線 | エンジン実装済み（`setChannelSwap`）、UIを繋ぐだけ |
| A-Bリピートの UI 配線 | エンジン実装済み（`setABPoint`/`clearABRepeat`） |
| 全画面プレイヤーのフォーカストラップ | 上の「モーダル化」と同件。`inert` 化まで含めて対応 |

保留: バーへの前/次トラックボタン追加（ポップアップで完結しているため判断保留）。

## 未実装機能（UI は disabled +「近日実装」表示済み）

- 通知ベル（`TopBar.tsx`、ハンドラ無し）
- スマートフォルダー条件エディタ（新規作成は `window.prompt` で名前のみ・`rules: []` 固定）
- AddressBar のビュー切替（リスト/グリッド）
- 左ナビの再生中 / 履歴 / お気に入り / ピン留め

## 開発体験・基盤

- `shell.css` の未参照クラス整理（`.mll-rtrk` 等の orphaned CSS、置換で未参照になった `.mle-icbtn` 系）
- LeftNav のラベル付与検討
- ダークテーマ（`.ml-dark`）での新コンポーネント（Button / IconButton / TagCombobox）確認
- dev サーバーの server/src 自動反映（vite.config で server workspace を watch して自動 restart。現状は手動再起動）
- SSE / WebSocket によるスキャン進捗のリアルタイム通知（requirements-v4 §9.3）
- `server-rust/` の削除判断（現状は参照実装として退避中）

## 将来構想（着手時期未定）

- 配布: Bun compile 単一 exe（ネイティブモジュール依存を避ける方針。architecture-v2 参照)
- トレイ常駐（基本機能完成後に設計）
- リモートストリーミング拡張: 認証付きアクセス等（requirements-v4 §9）
- Windows ネイティブ環境でのデバッグ対応（scripts の env 素書き禁止・cross-env 徹底）
