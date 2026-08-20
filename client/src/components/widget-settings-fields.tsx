import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WidgetSettingField } from "@shared/widget-manifest";

export interface WidgetSettingsFieldsProps {
  /** The owning widget's id (dashboard.json widgets[].id / manifest id) —
   *  namespaces every field's DOM id/data-testid so two widgets that both
   *  declare a setting with the same `key` (e.g. two instances of the same
   *  community widget, or two different widgets that happen to both use
   *  "label") never collide on a duplicate DOM id. */
  widgetId: string;
  /** A manifest's `settings` descriptors (shared/widget-manifest.ts) — the
   *  CONTRACT §2 promise this component closes: "the host renders these in
   *  its settings UI." */
  fields: WidgetSettingField[];
  /** This widget's current persisted settings blob
   *  (data/config/dashboard.json widgets[].settings) — read-only input;
   *  every write flows back out through `onPatch`, never mutated here. */
  values: Record<string, unknown>;
  /** Fired once per committed edit to a single field — string/number commit
   *  on blur (Enter blurs early), boolean/select commit immediately on
   *  change. The caller is expected to merge this into config as a
   *  single-key patch (app-shell.tsx's `updateWidgetSettings`/
   *  `applyWidgetSettingsPatch`), which preserves every OTHER key already
   *  in this widget's settings — this component never sees or needs to
   *  know about unrelated/unknown keys. */
  onPatch: (key: string, value: string | number | boolean) => void;
}

/** Type-guards a value against a descriptor's declared type — the same
 *  check used both to decide whether a config value is safe to display
 *  as-is and whether a descriptor `default` is safe to fall back to. */
function isTypeMatch(type: WidgetSettingField["type"], value: unknown): value is string | number | boolean {
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  // "string" and "select" (option values are always strings — see
  // widgetSettingOptionSchema in shared/widget-manifest.ts).
  return typeof value === "string";
}

/**
 * Resolves what a field should DISPLAY, per the brief's precedence: config
 * value (if present and type-correct) -> descriptor default (if
 * type-correct) -> a type-appropriate empty value.
 *
 * Type-coercion safety (deliverable #4): a config value whose type doesn't
 * match the descriptor — e.g. `data/config/dashboard.json` was hand-edited
 * and now has a string where a boolean setting expects one — is NEVER
 * surfaced as-is. It falls through to the default/empty branch exactly like
 * a missing value would. Critically, resolving to that fallback does NOT by
 * itself write anything back to config — nothing is patched until the user
 * actually commits a change to that specific field (see the per-field
 * commit-on-blur/commit-on-change handling below), so a mismatched value
 * just sits on disk unless the user chooses to touch that field.
 */
export function resolveFieldValue(
  field: WidgetSettingField,
  values: Record<string, unknown>,
): string | number | boolean {
  const raw = values[field.key];
  if (isTypeMatch(field.type, raw)) {
    // A "select" field's config value must also be one of the descriptor's
    // declared options — a hand-edited config with a value the manifest no
    // longer offers (or never did) is exactly as unsafe to surface as a
    // type-mismatched value, and falls through to the default/empty branch
    // the same way.
    if (field.type !== "select" || (field.options ?? []).some((opt) => opt.value === raw)) {
      return raw;
    }
  }
  if (isTypeMatch(field.type, field.default)) return field.default;
  return field.type === "boolean" ? false : "";
}

/** Renders every declared setting field for one widget, in manifest order.
 *  Caller (settings-menu.tsx) is responsible for gating this behind an
 *  expander and for only rendering it when `fields` is non-empty. */
export function WidgetSettingsFields({ widgetId, fields, values, onPatch }: WidgetSettingsFieldsProps) {
  return (
    <div className="space-y-2 pl-5 pt-1">
      {fields.map((field) => (
        <WidgetSettingRow
          key={field.key}
          widgetId={widgetId}
          field={field}
          value={resolveFieldValue(field, values)}
          onPatch={(value) => onPatch(field.key, value)}
        />
      ))}
    </div>
  );
}

function WidgetSettingRow({
  widgetId,
  field,
  value,
  onPatch,
}: {
  widgetId: string;
  field: WidgetSettingField;
  value: string | number | boolean;
  onPatch: (value: string | number | boolean) => void;
}) {
  const inputId = `widget-setting-${widgetId}-${field.key}`;

  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <Label htmlFor={inputId} className="text-xs flex-1 truncate">
          {field.label}
        </Label>
        <label className="touch-button flex items-center justify-center flex-shrink-0">
          <Switch
            id={inputId}
            checked={value === true}
            onCheckedChange={(checked) => onPatch(checked)}
            data-testid={inputId}
          />
        </label>
      </div>
    );
  }

  if (field.type === "select") {
    const selected = typeof value === "string" ? value : "";
    return (
      <div className="space-y-1">
        <Label htmlFor={inputId} className="text-xs">
          {field.label}
        </Label>
        <Select value={selected} onValueChange={(next) => onPatch(next)}>
          <SelectTrigger id={inputId} className="h-12 text-sm" data-testid={inputId}>
            <SelectValue placeholder={field.label} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === "number") {
    return <NumberSettingField inputId={inputId} field={field} value={value} onPatch={onPatch} />;
  }

  return <StringSettingField inputId={inputId} field={field} value={value} onPatch={onPatch} />;
}

/** String field: plain OSK-eligible text input. Commits on blur (Enter
 *  blurs early via onKeyDown) rather than on every keystroke, so typing a
 *  value doesn't fire a PUT per character — matches the number field's
 *  commit model below for consistency, even though a string has no invalid-
 *  parse case to guard against. */
function StringSettingField({
  inputId,
  field,
  value,
  onPatch,
}: {
  inputId: string;
  field: WidgetSettingField;
  value: string | number | boolean;
  onPatch: (value: string) => void;
}) {
  const resolved = typeof value === "string" ? value : "";
  const [draft, setDraft] = useState(resolved);
  // Re-sync when the resolved (config-derived) value changes out from under
  // us — including immediately after our own commit, where it's a no-op
  // (draft already equals the new resolved value).
  useEffect(() => setDraft(resolved), [resolved]);

  return (
    <div className="space-y-1">
      <Label htmlFor={inputId} className="text-xs">
        {field.label}
      </Label>
      <Input
        id={inputId}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== resolved) onPatch(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="h-12 text-sm"
        data-testid={inputId}
      />
    </div>
  );
}

/** Number field: the app's touch-friendly pattern for numeric entry outside
 *  the brightness slider — type="text" + inputMode="numeric" (a real
 *  type="number" spinner is not OSK-friendly on the kiosk's touch
 *  keyboard), with parse-on-blur. An invalid or empty parse reverts the
 *  draft back to the last resolved value and never calls `onPatch` —
 *  deliverable #3's "rejects garbage without writing." */
function NumberSettingField({
  inputId,
  field,
  value,
  onPatch,
}: {
  inputId: string;
  field: WidgetSettingField;
  value: string | number | boolean;
  onPatch: (value: number) => void;
}) {
  const resolvedDraft = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const [draft, setDraft] = useState(resolvedDraft);
  useEffect(() => setDraft(resolvedDraft), [resolvedDraft]);

  return (
    <div className="space-y-1">
      <Label htmlFor={inputId} className="text-xs">
        {field.label}
      </Label>
      <Input
        id={inputId}
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const trimmed = draft.trim();
          if (trimmed === "") {
            setDraft(resolvedDraft); // empty is not a valid number — revert, no write
            return;
          }
          const parsed = Number(trimmed);
          if (!Number.isFinite(parsed)) {
            setDraft(resolvedDraft); // garbage — revert, no write
            return;
          }
          if (typeof value === "number" && parsed === value) return; // unchanged — skip the write
          onPatch(parsed);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="h-12 text-sm"
        data-testid={inputId}
      />
    </div>
  );
}
