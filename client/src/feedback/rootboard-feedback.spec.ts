// Brief 04 §4: the review screen lists every field on the wire; a draft
// survives a reload with the connection off; nothing is sent until Send is
// tapped again. The dialog renders `preview(input).text` verbatim (see
// feedback-dialog.jsx), so the review text is tested here, at the client
// Rootboard builds, against the request body it actually sends.
import { describe, expect, test, vi } from "vitest";
import {
  createRootboardFeedbackClient,
  FEEDBACK_DRAFT_KEY,
  hasFeedbackDraft,
  localeFromNavigator,
  localStorageDrafts,
  osFromNavigator,
} from "./rootboard-feedback";
import { APP_VERSION } from "@shared/version";
import { FEEDBACK_BASE_URL } from "@shared/feedback-endpoint";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const context = { widgets: ["calendar@1.0.0", "user-notes@0.3.1"], theme: "deep-space" };
const nav = { language: "en-US", platform: "Linux aarch64" };
const now = () => new Date("2026-11-24T10:00:00.000Z");
const input = { kind: "broken" as const, message: "The chores page froze.\nSecond line.", contact: "  owner@example.com " };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A fake service: issues a ticket, accepts the report, records each request. */
function fakeService() {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    requests.push({ url: String(url), body });
    return String(url).endsWith("/v1/ticket") ? json(201, { ticket: "CRC-RB-7KQ2M", expires_in: 900 }) : json(201, { ticket: body.ticket });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, requests, calls: fetch };
}

const offline = vi.fn(async () => {
  throw new TypeError("NetworkError when attempting to fetch resource.");
}) as unknown as typeof globalThis.fetch;

describe("Rootboard's feedback client", () => {
  test("names Rootboard, the displayed version, the kiosk platform and the browser's os and locale", () => {
    const client = createRootboardFeedbackClient({ context, drafts: localStorageDrafts(new MemoryStorage()), nav, now });
    const { payload } = client.preview(input);
    expect(payload).toMatchObject({ product: "rootboard", version: APP_VERSION, platform: "kiosk", os: "Linux aarch64", locale: "en-US", context });
  });

  test("defaults to the production service", () => {
    expect(FEEDBACK_BASE_URL).toBe("https://feedback.cruciblecreations.net");
  });

  test("the review text shows every field the request carries; only the ticket is filled in after the tap", async () => {
    const service = fakeService();
    const client = createRootboardFeedbackClient({ context, drafts: localStorageDrafts(new MemoryStorage()), nav, now, fetch: service.fetch, baseUrl: "http://service.test" });
    const { payload, text } = client.preview(input);

    const result = await client.send(input);
    expect(result).toEqual({ ok: true, ticket: "CRC-RB-7KQ2M", draftCleared: true });

    const sent = service.requests.find((r) => r.url === "http://service.test/v1/feedback")!.body;
    const { ticket, ...rest } = sent;
    expect(ticket).toBe("CRC-RB-7KQ2M");
    // The previewed payload is exactly the body on the wire, minus the ticket.
    expect(rest).toEqual(payload);
    expect(Object.keys(sent).sort()).toEqual([...Object.keys(payload), "ticket"].sort());
    expect(text).toContain("Ticket code: assigned when you tap Send");

    // Every value on the wire appears in what the owner reads.
    const reviewed: Record<string, string[]> = {
      schema_version: [`Format version: ${sent.schema_version}`],
      product: [`Product: ${sent.product}`],
      version: [`Version: ${sent.version}`],
      platform: [`Platform: ${sent.platform}`],
      os: [`System: ${sent.os}`],
      locale: [`Language: ${sent.locale}`],
      kind: [`(sent as "${sent.kind}")`],
      message: String(sent.message).split("\n").map((line) => `  ${line}`),
      contact: [`Contact: ${sent.contact}`],
      context: [`widgets: ${JSON.stringify(context.widgets)}`, `theme: ${context.theme}`],
      client_time: [`Time on your device: ${sent.client_time}`],
    };
    expect(Object.keys(reviewed).sort()).toEqual(Object.keys(rest).sort());
    for (const [field, lines] of Object.entries(reviewed)) {
      for (const line of lines) expect(text, `${field} is not on the review screen`).toContain(line);
    }
    expect(sent.contact).toBe("owner@example.com");
  });

  test("a blank contact box is neither sent nor claimed", () => {
    const client = createRootboardFeedbackClient({ context, drafts: localStorageDrafts(new MemoryStorage()), nav, now });
    const { payload, text } = client.preview({ kind: "great", message: "Love it", contact: "   " });
    expect(payload).not.toHaveProperty("contact");
    expect(text).toContain("Contact: not given");
  });

  test("opening the client and showing the review sends nothing", () => {
    const service = fakeService();
    const client = createRootboardFeedbackClient({ context, drafts: localStorageDrafts(new MemoryStorage()), nav, now, fetch: service.fetch });
    client.preview(input);
    expect(service.calls).not.toHaveBeenCalled();
  });

  test("offline: Send says it needs a connection, the draft survives a reload, and nothing goes until Send is tapped again", async () => {
    const storage = new MemoryStorage();
    const first = createRootboardFeedbackClient({ context, drafts: localStorageDrafts(storage), nav, now, fetch: offline });

    const failed = await first.send(input);
    expect(failed).toMatchObject({ ok: false, code: "no_connection" });
    expect(failed.ok === false && failed.message).toMatch(/needs a connection/);
    expect(hasFeedbackDraft(storage)).toBe(true);

    // A reload: a new client over the same storage, with the connection back.
    const service = fakeService();
    const afterReload = createRootboardFeedbackClient({ context, drafts: localStorageDrafts(storage), nav, now, fetch: service.fetch });
    const draft = await afterReload.loadDraft();
    expect(draft).toMatchObject({ kind: "broken", message: input.message, contact: input.contact });
    expect(service.calls).not.toHaveBeenCalled();

    const sent = await afterReload.send({ kind: draft!.kind, message: draft!.message, contact: draft!.contact });
    expect(sent.ok).toBe(true);
    expect(service.calls).toHaveBeenCalledTimes(2);
    expect(hasFeedbackDraft(storage)).toBe(false);
  });

  test("the draft lives under one localStorage key", async () => {
    const storage = new MemoryStorage();
    const drafts = localStorageDrafts(storage);
    await drafts.set({ kind: "idea", message: "m", contact: "", saved_at: "x" });
    expect(JSON.parse(storage.getItem(FEEDBACK_DRAFT_KEY)!)).toMatchObject({ kind: "idea" });
    await drafts.clear();
    expect(storage.getItem(FEEDBACK_DRAFT_KEY)).toBeNull();
  });
});

describe("runtime strings", () => {
  test("os comes from the browser and falls back to a plain word", () => {
    expect(osFromNavigator({ platform: "Linux aarch64" })).toBe("Linux aarch64");
    expect(osFromNavigator({ userAgentData: { platform: "Windows" }, platform: "Win32" })).toBe("Windows");
    expect(osFromNavigator({})).toBe("unknown");
    expect(osFromNavigator({ platform: "x".repeat(100) })).toHaveLength(64);
  });

  test("locale comes from the browser, capped at the service's 16 characters", () => {
    expect(localeFromNavigator({ language: "en-GB" })).toBe("en-GB");
    expect(localeFromNavigator({})).toBe("en-US");
    expect(localeFromNavigator({ language: "x".repeat(30) })).toHaveLength(16);
  });
});
