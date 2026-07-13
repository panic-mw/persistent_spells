import { addPin, removePin, getPins, validatePin } from "./pin-logic.mjs";

const SCOPE = "pinned-cards";
const KEY   = "pins";

/**
 * Foundry-aware wrapper around pin-logic.mjs.
 * All methods are async because token.setFlag() sends a server update.
 */
export class PinManager {
  /** Read pins from a TokenDocument, with optional filter. */
  static getPins(token, filter = {}) {
    const pins = token.getFlag(SCOPE, KEY) ?? [];
    return getPins(pins, filter);
  }

  /** Append a pin to a TokenDocument (deduplicated by id). */
  static async addPin(token, pin) {
    const validation = validatePin(pin);
    if (!validation.ok) throw new Error(`PinManager.addPin: ${validation.error}`);
    const current = token.getFlag(SCOPE, KEY) ?? [];
    const updated  = addPin(current, pin);
    if (updated === current) return; // already present
    await token.setFlag(SCOPE, KEY, updated);
  }

  /** Remove a pin by id from a TokenDocument. */
  static async removePin(token, id) {
    const current = token.getFlag(SCOPE, KEY) ?? [];
    const updated  = removePin(current, id);
    if (updated.length === current.length) return; // nothing changed
    await token.setFlag(SCOPE, KEY, updated);
  }

  /** Build a pin descriptor from a ChatMessage. */
  static pinFromMessage(message) {
    const dnd5e  = message.flags?.dnd5e ?? {};
    const itemImg = dnd5e.item ? null : null; // resolved below
    // Prefer item image from flags; fall back to generic pin icon
    const icon = message.flags?.["pinned-cards"]?.icon
      ?? dnd5e.item?.img
      ?? "icons/svg/anchor.svg";

    return {
      id:           foundry.utils.randomID(),
      messageId:    message.id,
      label:        message.flavor || message.alias || game.i18n.localize("PINNEDCARDS.Pin.Default"),
      icon,
      itemUuid:     dnd5e.item?.uuid     ?? null,
      activityUuid: dnd5e.activity?.uuid ?? null,
    };
  }
}
