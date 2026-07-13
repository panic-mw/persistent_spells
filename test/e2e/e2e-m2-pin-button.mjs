/**
 * e2e-m2: Pin button appears on chat cards.
 */
import { launchBrowser, login, cleanup, makeCheck } from "./helpers.mjs";

const { browser, page } = await launchBrowser();
const { check, summary } = makeCheck();

try {
  await login(page);
  await cleanup(page);

  // Place a token and get a spell item.
  const { tokenId, itemId, msgId } = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "PC-Test-M2", type: "character" });
    // Create a minimal spell item so we can post a card.
    const item = await actor.createEmbeddedDocuments("Item", [{
      name: "Spirit Guardians", type: "spell",
      system: { level: 3, school: "abj" },
    }]);
    const [token] = await game.scenes.active.createEmbeddedDocuments("Token", [{
      actorId: actor.id, name: "PC-Test-M2", x: 100, y: 100,
    }]);
    // Post a plain card to chat (simulating item card).
    const msg = await ChatMessage.create({
      content: `<div class="chat-card item-card" data-item-id="${item[0].id}">Test spell card</div>`,
      flags: { "pinned-cards": { e2eTest: true } },
    });
    return { tokenId: token.id, itemId: item[0].id, msgId: msg.id };
  });

  // T2.1 — Pin button visible in chat card for GM
  await page.waitForSelector(`.message[data-message-id="${msgId}"] .pinned-cards-pin-btn`, { timeout: 10_000 });
  const btnVisible = await page.isVisible(`.message[data-message-id="${msgId}"] .pinned-cards-pin-btn`);
  check("T2.1 pin button visible to GM", btnVisible);

  // T2.3 — Pin to selected token
  await page.evaluate((tid) => {
    // Simulate token selection on canvas.
    const token = canvas.tokens.placeables.find(t => t.document.id === tid);
    if (token) canvas.tokens.select(token);
  }, tokenId);

  await page.click(`.message[data-message-id="${msgId}"] .pinned-cards-pin-btn`);
  await page.waitForTimeout(500);

  const pinned = await page.evaluate((tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    return PinManager.getPins(token).length;
  }, tokenId);
  check("T2.3 pin applied to selected token", pinned === 1);

  // T2.4 — Pin data correct
  const pinData = await page.evaluate((tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    return PinManager.getPins(token)[0];
  }, tokenId);
  check("T2.4 pin.messageId correct", pinData?.messageId === msgId);

  // T2.5 — No token selected → picker dialog
  await page.evaluate(() => canvas.tokens.releaseAll());
  await page.click(`.message[data-message-id="${msgId}"] .pinned-cards-pin-btn`);
  await page.waitForTimeout(300);
  const dialogVisible = await page.isVisible('.dialog select[name="tokenId"]');
  check("T2.5 picker dialog appears when no token selected", dialogVisible);
  // Dismiss the dialog.
  await page.keyboard.press("Escape");

} finally {
  await cleanup(page);
  await browser.close();
  process.exit(summary());
}
