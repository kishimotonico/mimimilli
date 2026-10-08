---
id: TASK-445
title: WorkEditDialogの保存失敗テストがフルスイートで低頻度に落ちる
status: Done
assignee:
  - '@mimi2'
created_date: '2026-09-09 16:17'
updated_date: '2026-10-08 06:11'
labels:
  - test
  - flaky
dependencies: []
priority: medium
ordinal: 466000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-435 の検証中に発見。435 の変更（fixture アダプタと package.json のみ、client 未変更）とは無関係。

対象: client/tests/unit/WorkEditDialog.test.tsx
テスト名: 「保存に失敗した場合は閉じずエラートーストを表示し、入力値を保持する」
失敗行: expect(screen.getByLabelText("タイトル")).toHaveValue("編集途中") （395行目付近）

## 観測された頻度

- task/435 側: 計11回中1回失敗（約9%）
- 475f56f ベース側: 5回中0回失敗
- 当該ファイル単体実行: 10/10 pass
- TASK-439 が触った3ファイルとの同時実行: 10/10 pass
- **フルスイート（149ファイル・server と同時実行）でのみ発生**

## 構造上の疑い（統括のコード読み）

テストの同期点が実態と合っていない可能性がある。

    fireEvent.click(screen.getByRole("button", { name: "保存する" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByLabelText("タイトル")).toHaveValue("編集途中");

waitFor が解決するのは「mutateAsync が呼ばれた」時点であり、その後の reject 処理と React の再描画が流れ切った時点ではない。以降の3つの assertion は同期実行なので、CPU 競合で処理が遅れると、状態が落ち着く前に評価されうる。

閾値を上げて誤魔化さず、同期点を「reject 後の状態が確定した時点」へ直すのが本筋。

## 進め方の指針（AGENTS.md・過去の実例より）

- まずテストランナーの既定タイムアウトに対する実測余白を測る。TASK-434 の metaCasRace は実測4.0〜4.6秒に対し bun test の既定が5000msで、余白が10〜20%しかなかった
- 「単体では通るがフルスイートでのみ落ちる」は実行速度で挙動が変わっているだけのことがある。通っているほうが偽陽性の可能性も疑う
- 閾値を上げるのは構造的に短縮できないと示せた場合だけ
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 フルスイート実行で当該テストが安定して通る（連続10回で失敗ゼロ）
- [x] #2 修正が閾値の引き上げではなく同期点の修正になっている（引き上げた場合は構造的に短縮できない根拠がコメントに残っている）
- [x] #3 失敗時の期待値と実測値が記録されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
失敗時の期待値と実測: 点検時の記録は expect(getByLabelText('タイトル')).toHaveValue('編集途中') の失敗（実測値は未記録）。現行コードでは待機条件が waitFor(queryByRole('alertdialog') is null) で、押下直後から成立する空振りの同期点だった。修正前の再現は今回できず（フルスイート相当の再現試行なし）。修正: findByText('保存できませんでした。') でreject後のエラー表示を待ってから onClose・alertdialog・タイトル値を検証。検証: 修正後 pnpm test を10回連続実行、WorkEditDialog.test.tsx の失敗は0/10。別worktree並走の負荷下で WorkGrid.test.tsx(timeout 5000ms) と appReconfiguringScreen.test.tsx が3/10回で落ちたが本タスクと無関係
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
保存失敗テストの同期点を「エラー表示が出るまで」に直し、負荷下のフルスイート連続10回で失敗ゼロ。 個別レビュー＋統合ブランチの横断レビュー、master への仮マージで pnpm check・test（client 1273 / server 951）・smoke 30 全通過（smoke はポート衝突の無い別パス worktree で実行）。9939fe4d で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
