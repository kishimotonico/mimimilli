// 作品情報ファイルの読み取り失敗を、行番号と原因つきの日本語1文にする。
import {
  findNodeAtLocation,
  getNodeValue,
  parse,
  parseTree,
  printParseErrorCode,
  type ParseError,
  type ParseErrorCode,
} from "jsonc-parser";
import type { $ZodIssue } from "zod/v4/core";

export type MetaDiagnostic =
  | { kind: "json"; line: number | null; reason: string }
  | { kind: "schema"; line: number | null; reason: string; moreIssues: number }
  | { kind: "formatVersion"; line: number | null; value: unknown }
  | { kind: "duplicateId"; id: string };

export type MetaDiagnosticKind = MetaDiagnostic["kind"];

const BOM = "﻿";

function lineOfOffset(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text[i] === "\n") line += 1;
  }
  return line;
}

function previousSignificantOffset(text: string, offset: number): number {
  let i = offset - 1;
  while (i >= 0 && /\s/.test(text[i] ?? "")) i -= 1;
  return i;
}

function syntaxReason(
  code: ParseErrorCode,
  text: string,
  offset: number,
): { reason: string; offset: number } {
  const name = printParseErrorCode(code);
  switch (name) {
    case "CommaExpected":
      return {
        reason: "カンマが足りない",
        offset: Math.max(0, previousSignificantOffset(text, offset)),
      };
    case "ColonExpected":
      return { reason: "「:」が足りない", offset };
    case "CloseBraceExpected":
      return { reason: "「}」が足りない", offset };
    case "CloseBracketExpected":
      return { reason: "「]」が足りない", offset };
    case "ValueExpected":
    case "PropertyNameExpected": {
      const prev = previousSignificantOffset(text, offset);
      if (text[prev] === ",") return { reason: "余分なカンマがある", offset: prev };
      return { reason: name === "ValueExpected" ? "値が足りない" : "項目名が足りない", offset };
    }
    case "UnexpectedEndOfString":
      return { reason: '文字列の「"」が閉じていない', offset };
    case "InvalidSymbol": {
      const char = text[offset] ?? "";
      if (char === "'") return { reason: "文字列は「'」ではなく「\"」で囲む", offset };
      if (/\p{L}/u.test(char)) return { reason: '「"」で囲まれていない文字がある', offset };
      return { reason: `使えない文字「${char}」がある`, offset };
    }
    case "InvalidCommentToken":
    case "UnexpectedEndOfComment":
      return { reason: "コメントは書けない", offset };
    case "InvalidNumberFormat":
    case "UnexpectedEndOfNumber":
      return { reason: "数値の書き方が正しくない", offset };
    case "InvalidUnicode":
    case "InvalidEscapeCharacter":
      return { reason: "「\\」の書き方が正しくない", offset };
    case "InvalidCharacter":
      return { reason: "文字列の中に改行やタブをそのまま書けない", offset };
    case "EndOfFileExpected":
      return { reason: "閉じたあとに余分な文字がある", offset };
    default:
      return { reason: "JSONとして読めない", offset };
  }
}

export function jsonSyntaxDiagnostic(text: string): MetaDiagnostic {
  if (text.startsWith(BOM)) {
    return {
      kind: "json",
      line: 1,
      reason: "先頭に BOM がある（BOM なしの UTF-8 で保存する）",
    };
  }
  if (text.trim() === "") return { kind: "json", line: null, reason: "ファイルが空" };
  const errors: ParseError[] = [];
  parse(text, errors, {
    disallowComments: true,
    allowTrailingComma: false,
    allowEmptyContent: false,
  });
  const first = errors[0];
  if (!first) return { kind: "json", line: null, reason: "JSONとして読めない" };
  const { reason, offset } = syntaxReason(first.error, text, first.offset);
  return { kind: "json", line: lineOfOffset(text, offset), reason };
}

function fieldOf(path: readonly PropertyKey[]): string {
  if (path.length === 0) return "全体";
  let out = "";
  for (const key of path) {
    out += typeof key === "number" ? `[${key}]` : out === "" ? String(key) : `.${String(key)}`;
  }
  return out;
}

const TYPE_LABEL: Record<string, string> = {
  string: "文字列",
  number: "数値",
  int: "整数",
  boolean: "true か false",
  array: "配列",
  object: "オブジェクト",
};

const FORMAT_LABEL: Record<string, string> = {
  uuid: "UUID",
  datetime: "日時（ISO 8601）",
  url: "URL",
};

function boundReason(issue: $ZodIssue & { code: "too_small" | "too_big" }, field: string): string {
  const small = issue.code === "too_small";
  const bound = small
    ? (issue as { minimum: unknown }).minimum
    : (issue as { maximum: unknown }).maximum;
  if (small && bound === 1 && issue.origin === "string") return `${field} が空`;
  if (issue.origin === "string") {
    return `${field} が${small ? "短すぎる" : "長すぎる"}（${bound}文字${small ? "以上" : "以下"}）`;
  }
  if (issue.origin === "array") {
    return `${field} が${small ? "少なすぎる" : "多すぎる"}（${bound}件${small ? "以上" : "以下"}）`;
  }
  return `${field} が${small ? "小さすぎる" : "大きすぎる"}（${bound}${small ? "以上" : "以下"}）`;
}

export function schemaIssueDiagnostic(text: string, issues: readonly $ZodIssue[]): MetaDiagnostic {
  const issue = issues[0];
  const moreIssues = Math.max(0, issues.length - 1);
  if (!issue) return { kind: "schema", line: null, reason: "内容が正しくない", moreIssues };
  const tree = parseTree(text);
  const path = issue.path.map((key) => (typeof key === "symbol" ? String(key) : key));
  const node = tree ? findNodeAtLocation(tree, path) : undefined;
  const line = node ? lineOfOffset(text, node.offset) : null;
  const field = fieldOf(issue.path);

  let reason: string;
  switch (issue.code) {
    case "invalid_type": {
      const expected = TYPE_LABEL[issue.expected] ?? issue.expected;
      reason = node ? `${field} が${expected}でない` : `${field} がない`;
      break;
    }
    case "too_small":
    case "too_big":
      reason = boundReason(issue, field);
      break;
    case "invalid_format":
      reason = `${field} が${FORMAT_LABEL[issue.format] ?? issue.format}の形式でない`;
      break;
    case "invalid_value":
      reason = `${field} が使えない値（${JSON.stringify(node ? getNodeValue(node) : undefined)}）`;
      break;
    case "custom":
      reason = `${field}: ${issue.message}`;
      break;
    default:
      reason = `${field} の値が正しくない`;
  }
  return { kind: "schema", line, reason, moreIssues };
}

export function formatVersionDiagnostic(text: string, value: unknown): MetaDiagnostic {
  const tree = parseTree(text);
  const node = tree ? findNodeAtLocation(tree, ["formatVersion"]) : undefined;
  return {
    kind: "formatVersion",
    line: node ? lineOfOffset(text, node.offset) : null,
    value,
  };
}

/** invalidMetaFiles・作品のエラー表示・ログで共通に使うユーザー向けの1文 */
export function describeMetaDiagnostic(fileName: string, diagnostic: MetaDiagnostic): string {
  const at = (line: number | null) => (line === null ? `${fileName}:` : `${fileName} ${line}行目:`);
  switch (diagnostic.kind) {
    case "json":
      return `${at(diagnostic.line)} ${diagnostic.reason}`;
    case "schema": {
      const more = diagnostic.moreIssues > 0 ? `（ほか${diagnostic.moreIssues}件）` : "";
      return `${at(diagnostic.line)} ${diagnostic.reason}${more}`;
    }
    case "formatVersion":
      return `${at(diagnostic.line)} formatVersion ${JSON.stringify(diagnostic.value)} には未対応`;
    case "duplicateId":
      return `${fileName}: 作品ID ${diagnostic.id} が別の作品情報ファイルと重複している`;
  }
}
