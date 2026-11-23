import type { Condition } from "@mimimilli/shared";

export const tag = (name: string): Condition => ({ type: "tag", tag: name });
export const and = (...children: Condition[]): Condition => ({ type: "and", children });
export const or = (...children: Condition[]): Condition => ({ type: "or", children });
export const not = (child: Condition): Condition => ({ type: "not", child });
