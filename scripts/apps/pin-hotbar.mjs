import { PinManager }  from "../models/pin-manager.mjs";
import { CardPopout }  from "./card-popout.mjs";
import { confirmUnpin } from "../hooks/token-hud.mjs";

const BAR_ID = "pinned-cards-hotbar";

export class PinHotbar {
  /** Mount the hotbar strip above Foundry's #hotbar. GM only. */
  static mount() {
    if (!game.user.isGM) return;

    // Remove any previous instance.
    document.getElementById(BAR_ID)?.remove();

    const bar = document.createElement("div");
    bar.id        = BAR_ID;
    bar.className = "pinned-cards-hotbar";

    const hotbar = document.querySelector("#hotbar");
    if (hotbar?.parentElement) {
      hotbar.parentElement.insertBefore(bar, hotbar);
    } else {
      document.querySelector("#ui-bottom")?.appendChild(bar);
    }

    PinHotbar.render();
  }

  /** Re-render all slots from live scene token data. */
  static render() {
    const bar = document.getElementById(BAR_ID);
    if (!bar) return;

    bar.innerHTML = "";

    const scene = game.scenes?.active;
    if (scene) {
      for (const tokenDoc of scene.tokens.contents) {
        const pins = PinManager.getPins(tokenDoc);
        for (const pin of pins) {
          bar.appendChild(PinHotbar.#buildSlot(tokenDoc, pin));
        }
      }
    }

    // Hide when empty so it doesn't take up space.
    bar.style.display = bar.children.length ? "flex" : "none";
  }

  static #buildSlot(tokenDoc, pin) {
    const slot = document.createElement("div");
    slot.className         = "pinned-cards-hotbar-slot";
    slot.dataset.pinId     = pin.id;
    slot.dataset.tokenId   = tokenDoc.id;
    slot.title             = `${pin.label} — ${tokenDoc.name}`;

    const img = document.createElement("img");
    img.src       = pin.icon;
    img.alt       = pin.label;
    img.className = "pinned-cards-hotbar-icon";

    const lbl = document.createElement("span");
    lbl.className = "pinned-cards-hotbar-label";
    // Show token name + truncated pin label.
    lbl.textContent = tokenDoc.name.length > 8
      ? tokenDoc.name.slice(0, 7) + "…"
      : tokenDoc.name;

    slot.appendChild(img);
    slot.appendChild(lbl);

    // Left-click → open popout.
    slot.addEventListener("click", (e) => {
      e.stopPropagation();
      PinHotbar.#openPopout(tokenDoc, pin);
    });

    // Right-click → quick unpin (no confirm — fast removal from hotbar).
    slot.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      PinHotbar.#quickUnpin(tokenDoc, pin);
    });

    return slot;
  }

  // Track open popouts so we don't double-open from the hotbar.
  static #popouts = new Map();

  static #openPopout(tokenDoc, pin) {
    const key = pin.id;
    if (PinHotbar.#popouts.has(key)) {
      PinHotbar.#popouts.get(key).bringToFront?.();
      return;
    }
    const popout = new CardPopout(tokenDoc, pin);
    PinHotbar.#popouts.set(key, popout);
    popout.render({ force: true });

    const origClose = popout.close.bind(popout);
    popout.close = async (...args) => {
      PinHotbar.#popouts.delete(key);
      return origClose(...args);
    };
  }

  static async #quickUnpin(tokenDoc, pin) {
    // Hotbar unpin: quick right-click, confirm via standard confirmUnpin.
    await confirmUnpin(pin, tokenDoc);
  }
}
