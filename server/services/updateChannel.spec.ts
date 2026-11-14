import { EventEmitter } from "events";
import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { isNewerVersion, isPrereleaseVersion, parseVersion } from "@shared/release-version";
import type { GitHubRelease } from "./updateService";

// Beta-launch brief 08 / decision 0022: two update channels and the
// prerelease-aware version ordering they rely on.

describe("version ordering", () => {
  test.each([
    ["1.8.0-beta.2", "1.8.0"],
    ["1.8.0-beta.1", "1.8.0-beta.2"],
    ["1.7.3", "1.8.0-beta.1"],
    ["1.8.0-beta.9", "1.8.0-beta.10"], // numeric, not text, order
    ["1.8.0-beta", "1.8.0-beta.1"],
    ["1.8.0-alpha.3", "1.8.0-beta.1"],
    ["1.7.9", "1.7.10"],
    ["1.7", "1.7.1"],
  ])("%s < %s", (older, newer) => {
    expect(isNewerVersion(older, newer)).toBe(true);
    expect(isNewerVersion(newer, older)).toBe(false);
  });

  test("a leading v is ignored on either side", () => {
    expect(isNewerVersion("v1.7.3", "1.8.0-beta.1")).toBe(true);
    expect(isNewerVersion("1.7.3", "v1.8.0")).toBe(true);
    expect(isNewerVersion("v1.8.0", "1.8.0")).toBe(false);
    expect(isNewerVersion("1.8.0-beta.1", "v1.8.0-beta.1")).toBe(false);
  });

  test("equal versions are not newer", () => {
    expect(isNewerVersion("1.7.3", "1.7.3")).toBe(false);
    expect(isNewerVersion("1.7", "1.7.0")).toBe(false);
  });

  test("a string that is not a version is never offered", () => {
    for (const bad of ["", "latest", "1.8.0 beta", "1.8.0+build.5", "1.8.0-", "vv1.8.0"]) {
      expect(parseVersion(bad)).toBeNull();
      expect(isNewerVersion("1.7.3", bad)).toBe(false);
    }
  });

  test("isPrereleaseVersion", () => {
    expect(isPrereleaseVersion("1.8.0-beta.1")).toBe(true);
    expect(isPrereleaseVersion("v1.8.0-beta.1")).toBe(true);
    expect(isPrereleaseVersion("1.8.0")).toBe(false);
    expect(isPrereleaseVersion("nope")).toBe(false);
  });
});

function release(tag: string, extra: Partial<GitHubRelease> = {}): GitHubRelease {
  return {
    tag_name: tag,
    name: `Rootboard ${tag}`,
    body: `Notes for ${tag}`,
    published_at: "2026-11-14T00:00:00Z",
    zipball_url: `https://api.github.com/zipball/${tag}`,
    tarball_url: `https://api.github.com/tarball/${tag}`,
    html_url: `https://github.com/example/releases/tag/${tag}`,
    draft: false,
    prerelease: tag.includes("-"),
    ...extra,
  };
}

/**
 * A fake GitHub releases API. `latest` is what `/releases/latest` returns
 * (GitHub's newest non-prerelease, non-draft); `list` is `/releases`.
 * Records every URL the updater asks for.
 */
function stubGitHub(api: { latest?: GitHubRelease; list?: GitHubRelease[] }) {
  const requested: string[] = [];
  vi.spyOn(https, "get").mockImplementation(((url: string, _opts: unknown, onResponse: (res: EventEmitter) => void) => {
    requested.push(url);
    const { pathname } = new URL(url);
    const body = pathname.endsWith("/releases/latest") ? api.latest : pathname.endsWith("/releases") ? api.list : undefined;
    const res = Object.assign(new EventEmitter(), { statusCode: body === undefined ? 404 : 200, headers: {} });
    setImmediate(() => {
      onResponse(res);
      if (body !== undefined) res.emit("data", JSON.stringify(body));
      res.emit("end");
    });
    return new EventEmitter();
  }) as unknown as typeof https.get);
  return requested;
}

let dir = "";

function writeConfig(update: unknown) {
  fs.mkdirSync(path.join(dir, "data", "config"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "data", "config", "dashboard.json"),
    JSON.stringify({
      configVersion: 1,
      defaultWidget: "calendar",
      widgets: [{ id: "calendar", enabled: true, settings: {} }],
      update,
    }),
  );
}

/** Loads the updater as if the running build were `appVersion`. */
async function loadUpdater(appVersion: string) {
  vi.resetModules(); // configService resolves data/ from cwd at load time
  vi.doMock("@shared/version", () => ({ APP_VERSION: appVersion }));
  return import("./updateService");
}

beforeEach(() => {
  // The request-URL assertions use the default repo; a developer's own
  // GITHUB_REPO_* override must not change them.
  vi.stubEnv("GITHUB_REPO_OWNER", "");
  vi.stubEnv("GITHUB_REPO_NAME", "");
  vi.stubEnv("UPDATE_CHANNEL", "");
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-update-"));
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.doUnmock("@shared/version");
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("channel selection", () => {
  test("stable is the default and reads releases/latest, as before channels", async () => {
    const requested = stubGitHub({ latest: release("v1.7.3"), list: [release("v1.8.0-beta.1"), release("v1.7.3")] });
    const { checkForUpdate } = await loadUpdater("1.7.2");
    const result = await checkForUpdate();
    expect(result.channel).toBe("stable");
    expect(result.updateAvailable).toBe(true);
    expect(result.latestVersion).toBe("1.7.3");
    expect(requested).toEqual(["https://api.github.com/repos/SchrodingerEQ/Rootboard.me/releases/latest"]);
  });

  test("a stable unit does not see a prerelease", async () => {
    stubGitHub({ latest: release("v1.7.3"), list: [release("v1.8.0-beta.1"), release("v1.7.3")] });
    const { checkForUpdate } = await loadUpdater("1.7.3");
    const result = await checkForUpdate();
    expect(result.updateAvailable).toBe(false);
    expect(result.latestVersion).toBe("1.7.3");
  });

  test("a beta unit is offered the prerelease, over HTTPS, from the ten newest releases", async () => {
    writeConfig({ channel: "beta" });
    const requested = stubGitHub({ latest: release("v1.7.3"), list: [release("v1.8.0-beta.1"), release("v1.7.3")] });
    const { checkForUpdate } = await loadUpdater("1.7.3");
    const result = await checkForUpdate();
    expect(result.channel).toBe("beta");
    expect(result.updateAvailable).toBe(true);
    expect(result.latestVersion).toBe("1.8.0-beta.1");
    expect(result.releaseNotes).toBe("Notes for v1.8.0-beta.1");
    expect(result.downloadUrl).toBe("https://api.github.com/tarball/v1.8.0-beta.1");
    expect(requested).toEqual(["https://api.github.com/repos/SchrodingerEQ/Rootboard.me/releases?per_page=10"]);
  });

  test("once the release is promoted, a beta unit on the beta is offered it", async () => {
    writeConfig({ channel: "beta" });
    stubGitHub({ list: [release("v1.8.0"), release("v1.8.0-beta.1"), release("v1.7.3")] });
    const { checkForUpdate } = await loadUpdater("1.8.0-beta.1");
    const result = await checkForUpdate();
    expect(result.updateAvailable).toBe(true);
    expect(result.latestVersion).toBe("1.8.0");
  });

  test("beta picks by version, not by list order", async () => {
    writeConfig({ channel: "beta" });
    // A late hotfix to the old line, published after the new beta.
    stubGitHub({ list: [release("v1.7.4"), release("v1.8.0-beta.2"), release("v1.8.0-beta.1"), release("v1.7.3")] });
    const { checkForUpdate } = await loadUpdater("1.8.0-beta.1");
    const result = await checkForUpdate();
    expect(result.latestVersion).toBe("1.8.0-beta.2");
    expect(result.updateAvailable).toBe(true);
  });

  test("beta skips drafts", async () => {
    writeConfig({ channel: "beta" });
    stubGitHub({ list: [release("v1.9.0", { draft: true }), release("v1.8.0-beta.1")] });
    const { checkForUpdate } = await loadUpdater("1.7.3");
    const result = await checkForUpdate();
    expect(result.latestVersion).toBe("1.8.0-beta.1");
  });

  test("beta skips tags that are not versions", async () => {
    writeConfig({ channel: "beta" });
    stubGitHub({ list: [release("nightly"), release("1.8.0-beta.1")] });
    const { checkForUpdate } = await loadUpdater("1.7.3");
    const result = await checkForUpdate();
    expect(result.latestVersion).toBe("1.8.0-beta.1");
  });

  test("tags with and without a leading v compare as one sequence", async () => {
    writeConfig({ channel: "beta" });
    stubGitHub({ list: [release("v1.7.3"), release("1.7.2"), release("v1.7.1")] });
    const { checkForUpdate } = await loadUpdater("1.7.2");
    const result = await checkForUpdate();
    expect(result.latestVersion).toBe("1.7.3");
    expect(result.updateAvailable).toBe(true);
  });

  test("a stable-only list without a v prefix also works on beta", async () => {
    writeConfig({ channel: "beta" });
    stubGitHub({ list: [release("1.7.2"), release("v1.7.1")] });
    const { checkForUpdate } = await loadUpdater("1.7.2");
    const result = await checkForUpdate();
    expect(result.latestVersion).toBe("1.7.2");
    expect(result.updateAvailable).toBe(false);
  });

  test("stable ignores a beta tag published without the Pre-release tick", async () => {
    stubGitHub({ latest: release("v1.8.0-beta.1", { prerelease: false }) });
    const { checkForUpdate } = await loadUpdater("1.7.3");
    const result = await checkForUpdate();
    expect(result.channel).toBe("stable");
    expect(result.updateAvailable).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("stable says so when the latest tag is not a version", async () => {
    stubGitHub({ latest: release("v1.7.3.1") });
    const { checkForUpdate } = await loadUpdater("1.7.3");
    const result = await checkForUpdate();
    expect(result.updateAvailable).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("switched back to stable, a unit on a beta build keeps it until stable catches up", async () => {
    writeConfig({ channel: "stable" });
    stubGitHub({ latest: release("v1.7.3") });
    const { checkForUpdate } = await loadUpdater("1.8.0-beta.1");
    const result = await checkForUpdate();
    expect(result.updateAvailable).toBe(false);
  });

  test("a beta list with only drafts reports no update rather than throwing", async () => {
    writeConfig({ channel: "beta" });
    stubGitHub({ list: [release("v1.9.0", { draft: true })] });
    const { checkForUpdate } = await loadUpdater("1.7.3");
    const result = await checkForUpdate();
    expect(result.updateAvailable).toBe(false);
    expect(result.channel).toBe("beta");
    expect(console.error).toHaveBeenCalled();
  });
});

describe("where the channel comes from", () => {
  test("UPDATE_CHANNEL env applies when the config has no update key", async () => {
    vi.stubEnv("UPDATE_CHANNEL", "beta");
    const { resolveUpdateChannel } = await loadUpdater("1.7.3");
    expect(resolveUpdateChannel()).toBe("beta");
  });

  test("the config wins over the env", async () => {
    vi.stubEnv("UPDATE_CHANNEL", "beta");
    writeConfig({ channel: "stable" });
    const { resolveUpdateChannel } = await loadUpdater("1.7.3");
    expect(resolveUpdateChannel()).toBe("stable");
  });

  test("a malformed config value falls back to the env, not to a broken layout", async () => {
    vi.stubEnv("UPDATE_CHANNEL", "beta");
    writeConfig({ channel: "nightly" });
    const { resolveUpdateChannel } = await loadUpdater("1.7.3");
    expect(resolveUpdateChannel()).toBe("beta");
  });

  test("an unknown env value falls back to stable and says so once", async () => {
    vi.stubEnv("UPDATE_CHANNEL", "nightly");
    const { resolveUpdateChannel } = await loadUpdater("1.7.3");
    expect(resolveUpdateChannel()).toBe("stable");
    expect(resolveUpdateChannel()).toBe("stable");
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  test("a hand-edited channel that is not valid is logged", async () => {
    writeConfig({ channel: "Beta" });
    const { resolveUpdateChannel } = await loadUpdater("1.7.3");
    expect(resolveUpdateChannel()).toBe("stable");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("update channel is invalid"));
  });

  test("a dashboard.json from v1.7.3 (no update key) still loads with its layout intact", async () => {
    const v173 = {
      configVersion: 1,
      defaultWidget: "dinner",
      theme: "deep-space",
      widgets: [
        { id: "dinner", enabled: true, settings: {} },
        { id: "calendar", enabled: true, settings: { hiddenCalendars: ["holidays"] } },
        { id: "chores", enabled: false, settings: {} },
        { id: "what-to-wear", enabled: true, settings: { zip: "" } },
      ],
    };
    fs.mkdirSync(path.join(dir, "data", "config"), { recursive: true });
    fs.writeFileSync(path.join(dir, "data", "config", "dashboard.json"), JSON.stringify(v173));
    const { resolveUpdateChannel } = await loadUpdater("1.7.3");
    const { readDashboardConfig } = await import("./configService");
    const { config, source } = readDashboardConfig();
    expect(source).toBe("file");
    expect(config).toEqual(v173);
    expect(resolveUpdateChannel()).toBe("stable");
    expect(console.error).not.toHaveBeenCalled();
  });

  test("the status endpoint reports the channel", async () => {
    writeConfig({ channel: "beta" });
    const { getUpdateStatus } = await loadUpdater("1.7.3");
    expect(getUpdateStatus()).toMatchObject({ channel: "beta", status: "idle" });
  });
});
