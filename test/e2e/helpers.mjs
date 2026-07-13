import { chromium } from "playwright";

export const BASE = "http://localhost:30000";

export async function launchBrowser() {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page    = await ctx.newPage();
  page.on("pageerror", (e) => console.error("[pageerror]", e.message));
  page.on("console",   (m) => { if (m.type() === "error") console.error("[console]", m.text()); });
  return { browser, page };
}

export async function login(page, { world = "wf-test", username = "Gamemaster" } = {}) {
  await page.goto(`${BASE}/join`, { waitUntil: "networkidle" });
  try {
    await page.locator('select[name="userid"]').selectOption({ label: username }, { timeout: 5000 });
  } catch {
    // Already on world join page, or userid is a text field.
    const inp = page.locator('input[name="userid"]');
    if (await inp.isVisible({ timeout: 2000 })) await inp.fill(username);
  }
  await page.locator('button[name="join"], button[type="submit"]').first().click();
  await page.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
}

export async function cleanup(page) {
  await page.evaluate(async () => {
    // Remove any pinned-cards actors created during tests.
    for (const actor of [...game.actors]) {
      if (actor.name?.startsWith("PC-Test")) await actor.delete().catch(() => {});
    }
    // Remove test chat messages.
    for (const msg of [...game.messages]) {
      if (msg.flags?.["pinned-cards"]?.e2eTest) await msg.delete().catch(() => {});
    }
  }).catch(() => {});
}

export const log = (...a) => console.log("[test]", ...a);

export function makeCheck() {
  let failures = 0;
  const check = (name, condition) => {
    if (condition) {
      log("ok  ", name);
    } else {
      console.error("FAIL", name);
      failures++;
    }
  };
  const summary = () => {
    log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
    return failures;
  };
  return { check, summary };
}
