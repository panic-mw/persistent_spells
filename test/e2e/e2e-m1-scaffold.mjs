/**
 * e2e-m1: Module loads, PinManager CRUD in Foundry.
 * Run against a world that has pinned-cards enabled.
 *   node test/e2e/e2e-m1-scaffold.mjs [--world wf-test]
 */
import { launchBrowser, login, cleanup, makeCheck } from "./helpers.mjs";

const { browser, page } = await launchBrowser();
const { check, summary } = makeCheck();

try {
  await login(page);
  await cleanup(page);

  // T1.1 — Module registers
  const active = await page.evaluate(() => game.modules.get("pinned-cards")?.active === true);
  check("T1.1 module active", active);

  // T1.2 — API exposed
  const apiOk = await page.evaluate(() =>
    typeof game.modules.get("pinned-cards")?.api?.PinManager === "function"
  );
  check("T1.2 PinManager in API", apiOk);

  // Create a test actor and place a token.
  const tokenId = await page.evaluate(async () => {
    const scene = game.scenes.active;
    const actor = await Actor.create({ name: "PC-Test-M1", type: "character" });
    const [token] = await scene.createEmbeddedDocuments("Token", [{
      actorId: actor.id, name: "PC-Test-M1", x: 100, y: 100,
    }]);
    return token.id;
  });

  // T1.3 — addPin persists
  await page.evaluate(async (tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    await PinManager.addPin(token, {
      id: "test-pin-1", messageId: "fake-msg", label: "Test", icon: "icons/svg/anchor.svg",
    });
  }, tokenId);

  const pinCount = await page.evaluate((tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    return PinManager.getPins(token).length;
  }, tokenId);
  check("T1.3 addPin persists", pinCount === 1);

  // T1.4 — getPin retrieves by id
  const retrievedId = await page.evaluate((tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    return PinManager.getPins(token)[0]?.id;
  }, tokenId);
  check("T1.4 getPins retrieves", retrievedId === "test-pin-1");

  // T1.5 — removePin removes
  await page.evaluate(async (tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    await PinManager.removePin(token, "test-pin-1");
  }, tokenId);

  const afterRemove = await page.evaluate((tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    return PinManager.getPins(token).length;
  }, tokenId);
  check("T1.5 removePin removes", afterRemove === 0);

  // T1.6 — addPin deduplicates
  await page.evaluate(async (tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    const pin = { id: "dup", messageId: "x", label: "Dup", icon: "icons/svg/anchor.svg" };
    await PinManager.addPin(token, pin);
    await PinManager.addPin(token, pin);
  }, tokenId);

  const dupCount = await page.evaluate((tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    return PinManager.getPins(token).length;
  }, tokenId);
  check("T1.6 addPin deduplicates", dupCount === 1);

  // T1.7 — no cross-token bleed
  const tokenBId = await page.evaluate(async () => {
    const scene = game.scenes.active;
    const actor = await Actor.create({ name: "PC-Test-M1-B", type: "character" });
    const [token] = await scene.createEmbeddedDocuments("Token", [{
      actorId: actor.id, name: "PC-Test-M1-B", x: 200, y: 100,
    }]);
    return token.id;
  });

  const bleedCount = await page.evaluate((tid) => {
    const { PinManager } = game.modules.get("pinned-cards").api;
    const token = game.scenes.active.tokens.get(tid);
    return PinManager.getPins(token).length;
  }, tokenBId);
  check("T1.7 no cross-token bleed", bleedCount === 0);

} finally {
  await cleanup(page);
  await browser.close();
  process.exit(summary());
}
