import { PinManager } from "../models/pin-manager.mjs";

const AUTO_TAG = "concentration";

export function registerConcentrationHooks() {
  Hooks.on("dnd5e.beginConcentrating", onBeginConcentrating);
  Hooks.on("dnd5e.endConcentration",   onEndConcentration);
}

async function onBeginConcentrating(actor, item, effect, activity) {
  // Find the token for this actor on the active scene.
  const tokenDoc = findTokenForActor(actor);
  if (!tokenDoc) return;

  // Find the chat message that created this concentration effect.
  // dnd5e stores the effect id in message.system.concentration.
  const message = game.messages.contents
    .slice()
    .reverse()
    .find(m => m.system?.concentration === effect.id);

  if (!message) return;

  const pin = {
    ...PinManager.pinFromMessage(message),
    label:        `${item.name}`,
    icon:         item.img ?? "icons/svg/anchor.svg",
    itemUuid:     item.uuid     ?? null,
    activityUuid: activity?.uuid ?? null,
    auto:         AUTO_TAG,
  };

  // Store the pinId on the effect so we can remove it later.
  await effect.setFlag("pinned-cards", "pinId", pin.id);
  await PinManager.addPin(tokenDoc, pin);
}

async function onEndConcentration(actor, effect) {
  const tokenDoc = findTokenForActor(actor);
  if (!tokenDoc) return;

  // Remove the auto-pin we created for this effect.
  const pinId = effect.getFlag("pinned-cards", "pinId");
  if (pinId) {
    const { closePopoutForPin } = await import("./token-hud.mjs");
    closePopoutForPin(pinId);
    await PinManager.removePin(tokenDoc, pinId);
  } else {
    // Fallback: remove all concentration auto-pins (handles manual unpin edge case).
    const concentrationPins = PinManager.getPins(tokenDoc, { auto: AUTO_TAG });
    for (const pin of concentrationPins) {
      const { closePopoutForPin } = await import("./token-hud.mjs");
      closePopoutForPin(pin.id);
      await PinManager.removePin(tokenDoc, pin.id);
    }
  }
}

function findTokenForActor(actor) {
  // Prefer the linked token on the active scene; fall back to the first token.
  const scene = game.scenes?.active;
  if (!scene) return null;
  const token = scene.tokens.find(t => t.actor?.id === actor.id);
  return token ?? null;
}
