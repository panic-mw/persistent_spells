/**
 * e2e-m8: Custom pinnable conditions.
 */
import { launchBrowser, login, cleanup, makeCheck } from "./helpers.mjs";

const { browser, page } = await launchBrowser();
const { check, summary } = makeCheck();

try {
  await login(page);
  await cleanup(page);

  const tokenId = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "PC-Test-M8", type: "character" });
    const [token] = await game.scenes.active.createEmbeddedDocuments("Token", [{
      actorId: actor.id, name: "PC-Test-M8", x: 100, y: 100,
    }]);
    return token.id;
  });

  // Open HUD and click the "+ Custom" button.
  await page.evaluate((tid) => {
    canvas.tokens.placeables.find(t => t.document.id === tid)?._onClickRight(new MouseEvent("rightclick"));
  }, tokenId);
  await page.waitForSelector("#token-hud .pinned-cards-custom-btn", { timeout: 5_000 });

  // T8.1 — Custom button opens dialog
  await page.click("#token-hud .pinned-cards-custom-btn");
  await page.waitForSelector(".dialog .pinned-cards-custom-form", { timeout: 5_000 });
  check("T8.1 custom condition dialog opens", await page.isVisible(".dialog .pinned-cards-custom-form"));

  // T8.2 — Dialog has expected fields
  const hasLabel   = await page.isVisible('.dialog input[name="label"]');
  const hasIcon    = await page.isVisible('.dialog select[name="iconPreset"]');
  const hasSaveAbi = await page.isVisible('.dialog select[name="saveAbility"]');
  const hasDmgForm = await page.isVisible('.dialog input[name="dmgFormula"]');
  check("T8.2 dialog has label, icon, save, damage fields", hasLabel && hasIcon && hasSaveAbi && hasDmgForm);

  // T8.14 — Icon dropdown is populated with dnd5e icons
  const iconOptCount = await page.$$eval('.dialog select[name="iconPreset"] option', els => els.length);
  check("T8.14 icon picker shows dnd5e icons", iconOptCount >= 10);

  // Fill in label + save + damage.
  await page.fill('.dialog input[name="label"]', "Hexblade's Curse");
  await page.selectOption('.dialog select[name="saveAbility"]', "wis");
  await page.fill('.dialog input[name="saveDc"]', "15");
  await page.fill('.dialog input[name="dmgFormula"]', "1d6");
  await page.selectOption('.dialog select[name="dmgType"]', "necrotic");
  await page.check('.dialog input[name="perTurn"]');

  const msgCountBefore = await page.evaluate(() => game.messages.size);
  await page.click('.dialog button[data-button="add"]');
  await page.waitForTimeout(800);

  // T8.4 — Creates a chat message
  const msgCountAfter = await page.evaluate(() => game.messages.size);
  check("T8.4 dialog submission creates chat message", msgCountAfter > msgCountBefore);

  // T8.4 — Message is flagged as custom condition
  const isCustom = await page.evaluate(() => {
    const msgs = [...game.messages].reverse();
    return msgs[0]?.flags?.["pinned-cards"]?.customCondition === true;
  });
  check("T8.4 message flagged as customCondition", isCustom);

  // T8.5 — Auto-pinned to token
  const pinCount = await page.evaluate((tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    return PinManager.getPins(token).length;
  }, tokenId);
  check("T8.5 auto-pinned to token after dialog submit", pinCount === 1);

  // T8.12 — "Per turn" label suffix in pin
  const pinLabel = await page.evaluate((tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    return PinManager.getPins(token)[0]?.label;
  }, tokenId);
  check("T8.12 per-turn suffix in card label", pinLabel?.includes("per turn"));

  // T8.8/T8.9 — Open popout, check Roll Save button
  await page.evaluate((tid) => {
    canvas.tokens.placeables.find(t => t.document.id === tid)?._onClickRight(new MouseEvent("rightclick"));
  }, tokenId);
  await page.waitForSelector("#token-hud .pinned-cards-icon", { timeout: 5_000 });
  await page.click("#token-hud .pinned-cards-icon");
  await page.waitForSelector(".pinned-cards-popout", { timeout: 5_000 });

  const hasSaveBtn = await page.isVisible('.pinned-cards-popout [data-action="rollSave"]');
  check("T8.8 roll save button present in popout", hasSaveBtn);

  const hasDmgBtn = await page.isVisible('.pinned-cards-popout [data-action="rollDamage"]');
  check("T8.10 roll damage button present in popout", hasDmgBtn);

  // T8.16 — Reload and check pins persist
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });

  const persistCount = await page.evaluate((tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    return PinManager.getPins(token).length;
  }, tokenId);
  check("T8.16 pins persist after page reload", persistCount === 1);

} finally {
  await cleanup(page);
  await browser.close();
  process.exit(summary());
}
