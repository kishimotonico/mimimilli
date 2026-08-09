// noContentAsNull の型保護をコンパイル時に確認する。実行はしない（tsc の型検査のみ）。
import { expectTypeOf } from "vitest";
import { z } from "zod";
import { deleteParsed, getParsed, patchParsed, postParsed, putParsed } from "./http";

const schema = z.object({ ok: z.boolean() });

expectTypeOf(getParsed(schema, "/x")).toEqualTypeOf<Promise<{ ok: boolean }>>();
expectTypeOf(getParsed(schema, "/x", { noContentAsNull: true })).toEqualTypeOf<
  Promise<{ ok: boolean } | null>
>();

expectTypeOf(postParsed(schema, "/x")).toEqualTypeOf<Promise<{ ok: boolean }>>();
expectTypeOf(postParsed(schema, "/x", undefined, { noContentAsNull: true })).toEqualTypeOf<
  Promise<{ ok: boolean } | null>
>();

expectTypeOf(putParsed(schema, "/x", {})).toEqualTypeOf<Promise<{ ok: boolean }>>();
expectTypeOf(putParsed(schema, "/x", {}, { noContentAsNull: true })).toEqualTypeOf<
  Promise<{ ok: boolean } | null>
>();

expectTypeOf(patchParsed(schema, "/x", {})).toEqualTypeOf<Promise<{ ok: boolean }>>();
expectTypeOf(patchParsed(schema, "/x", {}, { noContentAsNull: true })).toEqualTypeOf<
  Promise<{ ok: boolean } | null>
>();

expectTypeOf(deleteParsed(schema, "/x")).toEqualTypeOf<Promise<{ ok: boolean }>>();
expectTypeOf(deleteParsed(schema, "/x", { noContentAsNull: true })).toEqualTypeOf<
  Promise<{ ok: boolean } | null>
>();
