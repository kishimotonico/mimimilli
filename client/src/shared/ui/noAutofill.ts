/** 資格情報ではないテキスト入力に付ける、ブラウザとパスワード管理アプリの自動入力の抑止。
 *  1Password は data-1p-ignore（新しい指定は data-op-ignore）、LastPass は data-lpignore、
 *  Bitwarden は data-bwignore、Dashlane などは data-form-type="other" を見る */
export const NO_AUTOFILL_PROPS = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-op-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const;
