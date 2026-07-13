/**
 * e2e-m5: Right-click unpin context menu.
 */
import { launchBrowser, login, cleanup, makeCheck } from "./helpers.mjs";

const { browser, page } = await launchBrowser();
const { check, summary } = makeCheck();

try {
  await login(page);
  await cleanup(page);

  const tokenId = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "PC-Test-M5", type: "character" });
    const [token] = await game.scenes.active.createEmbeddedDocuments("Token", [{
      actorId: actor.id, name: "PC-Test-M5", x: 100, y: 100,
    }]);
    const { PinManager } = game.modules.get("pinned-cards").api;
    await PinManager.addPin(token, {
      id: "m5-pin", messageId: "fake", label: "Test Condition", icon: "icons/svg/anchor.svg",
    });
    return token.id;
  });

  // Open HUD.
  await page.evaluate((tid) => {
    canvas.tokens.placeables.find(t => t.document.id === tid)?._onClickRight(new MouseEvent("rightclick"));
  }, tokenId);
  await page.waitForSelector("#token-hud .pinned-cards-icon", { timeout: 5_000 });

  // T5.1 — Right-click shows context menu
  await page.click("#token-hud .pinned-cards-icon", { button: "right" });
  await page.waitForSelector(".pinned-cards-context-menu", { timeout: 3_000 });
  check("T5.1 right-click shows context menu", await page.isVisible(".pinned-cards-context-menu"));

  // T5.2 — Menu has "Unpin" option
  const unpinText = await page.$eval(".pinned-cards-context-item", el => el.textContent.trim());
  check("T5.2 menu has Unpin option", unpinText.includes("Unpin"));

  // T5.4 — Unpin prompts confirmation
  await page.click(".pinned-cards-context-item");
  await page.waitForSelector(".dialog", { timeout: 3_000 });
  check("T5.4 confirmation dialog appears", await page.isVisible(".dialog"));

  // T5.5 — Cancel leaves pin intact
  await page.click(".dialog button.no, .dialog button[data-button='no'], .dialog button.cancel");
  await page.waitForTimeout(300);
  const stillThere = await page.evaluate((tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    return PinManager.getPins(token).length === 1;
  }, tokenId);
  check("T5.5 cancel leaves pin intact", stillThere);

  // T5.3 — Unpin removes pin (confirm this time)
  await page.evaluate((tid) => {
    canvas.tokens.placeables.find(t => t.document.id === tid)?._onClickRight(new MouseEvent("rightclick"));
  }, tokenId);
  await page.waitForSelector("#token-hud .pinned-cards-icon", { timeout: 5_000 });
  await page.click("#token-hud .pinned-cards-icon", { button: "right" });
  await page.waitForSelector(".pinned-cards-context-menu", { timeout: 3_000 });
  await page.click(".pinned-cards-context-item");
  await page.waitForSelector(".dialog", { timeout: 3_000 });
  await page.click(".dialog button.yes, .dialog button[data-button='yes']");
  await page.waitForTimeout(500);

  const pinGone = await page.evaluate((tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    return PinManager.getPins(token).length === 0;
  }, tokenId);
  check("T5.3 unpin removes pin", pinGone);

} finally {
  await cleanup(page);
  await browser.close();
  process.exit(summary());
}
