/**
 * Dashboard config persistence: a single human-editable JSON file at
 * data/config/dashboard.json (gitignored — deployment-specific, not shipped).
 * SSH hand-edits are supported: readDashboardConfig() re-reads from disk on
 * every call rather than caching, so an edit takes effect on the next poll.
 *
 * The kiosk must always boot: readDashboardConfig() never throws. A missing
 * file, unparseable JSON, or a schema-invalid file all log once and fall
 * back to defaultDashboardConfig().
 */

import fs from "fs";
import path from "path";
import { dashboardConfigSchema, defaultDashboardConfig, type DashboardConfig } from "@shared/dashboard-config";

const CONFIG_DIR = path.join(process.cwd(), "data", "config");
const CONFIG_PATH = path.join(CONFIG_DIR, "dashboard.json");

export type ReadDashboardConfigResult =
  | { config: DashboardConfig; source: "file" }
  | { config: DashboardConfig; source: "default" };

export function readDashboardConfig(): ReadDashboardConfigResult {
  let raw: string;
  try {
    raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  } catch (error) {
    // Missing file is the common/expected case (first boot); anything else
    // (permissions, etc.) is also non-fatal — fall back to defaults either way.
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error(`Failed to read dashboard config at ${CONFIG_PATH}:`, error);
    }
    return { config: defaultDashboardConfig(), source: "default" };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    console.error(`Dashboard config at ${CONFIG_PATH} is not valid JSON:`, error);
    return { config: defaultDashboardConfig(), source: "default" };
  }

  const result = dashboardConfigSchema.safeParse(parsedJson);
  if (!result.success) {
    console.error(
      `Dashboard config at ${CONFIG_PATH} failed validation:`,
      result.error.flatten()
    );
    return { config: defaultDashboardConfig(), source: "default" };
  }

  return { config: result.data, source: "file" };
}

/**
 * Validates and atomically writes the dashboard config. Throws (via the Zod
 * error) if the config is invalid — callers should validate/handle before
 * calling, or catch here. Writes to a .tmp file then renames over the target
 * so a reader never observes a partially-written file.
 */
export function writeDashboardConfig(config: DashboardConfig): void {
  const validated = dashboardConfigSchema.parse(config);
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const tmpPath = `${CONFIG_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(validated, null, 2) + "\n", "utf-8");
  fs.renameSync(tmpPath, CONFIG_PATH);
}
