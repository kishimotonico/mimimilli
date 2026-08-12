import { z } from "zod";

declare const workspacePathBrand: unique symbol;
export type WorkspacePath = string & { readonly [workspacePathBrand]: "WorkspacePath" };

export function workspacePath(value: string): WorkspacePath {
  if (/^(?:[\\/]|[A-Za-z]:)/.test(value)) throw new Error("WorkspacePath は絶対パスにできません");
  const normalized = value.replace(/\\/g, "/").replace(/\/+$/g, "");
  if (normalized.split("/").some((part: string) => part === "." || part === "..")) {
    throw new Error("WorkspacePath は root 相対の正規化済みパスである必要があります");
  }
  return normalized as WorkspacePath;
}

export const workspacePathSchema = z.string().transform((value, ctx) => {
  try {
    return workspacePath(value);
  } catch (error) {
    ctx.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : "不正なWorkspacePathです",
    });
    return z.NEVER;
  }
});

export const mediaKindSchema = z.enum(["audio", "image", "pdf", "text", "video", "other"]);
export type MediaKind = z.infer<typeof mediaKindSchema>;

export const previewCapabilitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("available") }),
  z.object({ kind: z.literal("truncated"), limitBytes: z.number().int().positive() }),
  z.object({ kind: z.literal("unavailable"), reason: z.enum(["unsupported", "size-limit"]) }),
]);
export type PreviewCapability = z.infer<typeof previewCapabilitySchema>;

export const workspaceResourceRefSchema = z.object({
  kind: z.literal("workspace"),
  path: workspacePathSchema,
});
export type WorkspaceResourceRef = z.infer<typeof workspaceResourceRefSchema>;

export const workspaceMediaQuerySchema = workspaceResourceRefSchema.pick({ path: true });
export const TEXT_PREVIEW_LIMIT_BYTES = 1024 * 1024;
export const IMAGE_PREVIEW_LIMIT_BYTES = 64 * 1024 * 1024;
export const PDF_PREVIEW_LIMIT_BYTES = 256 * 1024 * 1024;
