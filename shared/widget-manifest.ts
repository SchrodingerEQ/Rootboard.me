import { z } from "zod";

/**
 * Contract version the host implements. A manifest with `apiVersion`
 * greater than this is listed but not loadable ("built for a newer
 * Rootboard"). See docs/plans/widget-system/CONTRACT.md §2, §6.
 */
export const WIDGET_API_VERSION = 1;

const noParentTraversal = (p: string) => !p.split("/").includes("..");

export const widgetIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,40}$/, {
    message: "id must be lowercase alphanumeric/hyphen, 2-41 chars, starting with a letter or digit",
  });

const widgetSettingOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

export const widgetSettingFieldSchema = z
  .object({
    key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/, {
      message: "key must be a safe identifier, 1-40 chars, starting with a letter",
    }),
    label: z.string().min(1).max(40),
    type: z.enum(["string", "number", "boolean", "select"]),
    default: z.unknown().optional(),
    options: z.array(widgetSettingOptionSchema).optional(),
  })
  .refine(
    (field) => (field.type === "select" ? !!field.options && field.options.length > 0 : true),
    { message: '"select" fields require a non-empty options array', path: ["options"] },
  )
  .refine((field) => (field.type !== "select" ? field.options === undefined : true), {
    message: 'only "select" fields may declare options',
    path: ["options"],
  });

export type WidgetSettingField = z.infer<typeof widgetSettingFieldSchema>;

export const widgetManifestSchema = z.object({
  id: widgetIdSchema,
  name: z.string().min(1).max(40),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, { message: "version must be semver MAJOR.MINOR.PATCH" }),
  apiVersion: z.number().int().positive(),
  entry: z
    .string()
    .min(1)
    .refine(noParentTraversal, { message: "no .. segments" }),
  slots: z
    .array(z.string())
    .nonempty()
    .refine((slots) => slots.includes("section"), {
      message: 'v1 requires the "section" slot',
    }),
  description: z.string().max(200).optional(),
  icon: z
    .string()
    .refine(noParentTraversal, { message: "no .. segments" })
    .optional(),
  refresh: z.object({ intervalSeconds: z.number().int().min(30) }).optional(),
  settings: z.array(widgetSettingFieldSchema).optional(),
});

export type WidgetManifest = z.infer<typeof widgetManifestSchema>;
