/**
 * e2e-m3: Token HUD shows pin row.
 */
import { launchBrowser, login, cleanup, makeCheck } from "./helpers.mjs";

const { browser, page } = await launchBrowser();
const { check, summary } = makeCheck();

try {
  await login(page);
  await cleanup(page);

  const tokenId = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "PC-Test-M3", type: "character" });
    const [token] = await game.scenes.active.createEmbeddedDocuments("Token", [{
      actorId: actor.id, name: "PC-Test-M3", x: 100, y: 100,
    }]);
    // Pre-seed 2 pins.
    const { PinManager } = game.modules.get("pinned-cards").api;
    await PinManager.addPin(token, {
      id: "p1", messageId: "fake-1", label: "Spirit Guardians", icon: "icons/svg/anchor.svg",
    });
    await PinManager.addPin(token, {
      id: "p2", messageId: "fake-2", label: "Bless", icon: "icons/svg/anchor.svg",
    });
    return token.id;
  });

  // Open the token HUD by right-clicking the token on canvas.
  await page.evaluate((tid) => {
    const token = canvas.tokens.placeables.find(t => t.document.id === tid);
    token?._onClickRight(new MouseEvent("rightclick"));
  }, tokenId);
  await page.waitForSelector("#token-hud", { timeout: 5_000 });

  // T3.1 — Pin row present
  const rowPresent = await page.isVisible("#token-hud .pinned-cards-row");
  check("T3.1 pin row present in HUD", rowPresent);

  // T3.2 — Correct icon count
  const iconCount = await page.$$eval("#token-hud .pinned-cards-row .pinned-cards-icon", els => els.length);
  check("T3.2 correct icon count", iconCount === 2);

  // T3.4 — Tooltip text
  const firstTitle = await page.$eval(
    "#token-hud .pinned-cards-row .pinned-cards-icon",
    el => el.title
  );
  check("T3.4 icon tooltip matches label", firstTitle === "Spirit Guardians");

  // T3.5 — Pin row below status effects
  const order = await page.evaluate(() => {
    const hud = document.querySelector("#token-hud");
    const children = [...hud.children].map(c => c.className);
    const statusIdx = children.findIndex(c => c.includes("status-effects"));
    const rowIdx    = children.findIndex(c => c.includes("pinned-cards-row"));
    return { statusIdx, rowIdx };
  });
  check("T3.5 pin row follows status effects", order.rowIdx > order.statusIdx);

  // T3.6 — Zero pins → row is hidden
  const tokenNoPin = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "PC-Test-M3-Empty", type: "character" });
    const [token] = await game.scenes.active.createEmbeddedDocuments("Token", [{
      actorId: actor.id, name: "PC-Test-M3-Empty", x: 200, y: 100,
    }]);
    return token.id;
  });

  await page.evaluate((tid) => {
    const token = canvas.tokens.placeables.find(t => t.document.id === tid);
    token?._onClickRight(new MouseEvent("rightclick"));
  }, tokenNoPin);
  await page.waitForTimeout(500);

  const emptyRowHidden = await page.evaluate(() => {
    const row = document.querySelector("#token-hud .pinned-cards-row--empty");
    if (!row) return true; // row absent is also fine
    const style = getComputedStyle(row);
    return style.display === "none";
  });
  check("T3.6 empty pin row is hidden", emptyRowHidden);

} finally {
  await cleanup(page);
  await browser.close();
  process.exit(summary());
}
