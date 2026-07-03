# レジューム再生

Status: done

## 目的

- 保存済みの作品再生位置を詳細画面に表示する
- 保存位置から再生する導線を既存の `playWithResume` へ接続する
- 先頭・選択トラックからの通常再生は従来どおり維持する

## 設計

- full `Work` を保持する `PreviewPane` から resume 専用コールバックを `LibraryView`、`App` へ渡す
- `App` は追加取得を行わず `player.playWithResume(work)` を呼ぶ
- resume 位置が正数かつトラック番号が範囲内の場合だけ「続きから再生」を主アクションにする
- 位置は対象トラック名と `formatTime` で表示し、対象トラック行にも控えめに示す

## 作業項目

- [x] WorkDetail の resume 表示とアクション
- [x] App から `playWithResume` への配線
- [x] visual regression test の追加
- [x] `pnpm check` / `pnpm test`
- [x] snapshot の生成・目視確認
- [x] agent-browser による UI/API 配線確認

## 検証結果

- `pnpm check`: 成功
- `pnpm test`: 成功（server 11 tests、client 52 tests）
- `pnpm exec playwright test --list`: 成功（5 tests、新規 resume ケースを含む）
- `pnpm exec playwright test --update-snapshots`: Vite の listen が `EPERM` のためテスト開始前に失敗
- `pnpm exec playwright test`: 同じく Vite の listen が `EPERM` のためテスト開始前に失敗
- 既存サーバー向け一時設定: Chromium が `sandbox_host_linux.cc` の `Operation not permitted` で起動不可
- agent-browser: resume API へ `position=201, trackIndex=2` を保存し、作品を再選択すると「続きから再生」「古い本の読み聞かせ · 3:21 から再開」「再開 3:21」が表示されることを確認
- agent-browser: 「続きから再生」で対象トラック「古い本の読み聞かせ」が選ばれることを確認
- 音声位置の実時間確認: 起動済み開発サーバーが fixture 音声 URL を 404 にするため未確認。`pendingResumeRef` の既存実装は変更していない

## スナップショット

Playwright を起動できないため、`work-detail-resume-desktop-chromium-linux.png` は agent-browser を 1440x960 viewport に合わせて `.mle-prv` 要素から生成し、目視確認した。主・副アクション、対象トラック名、3:21 の位置表示、3番トラックの resume 印が写っている。
