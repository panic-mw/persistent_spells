import { PinManager } from "../models/pin-manager.mjs";
import { pickIcon }   from "../models/icon-picker.mjs";

export function registerChatCardHook() {
  // dnd5e.renderChatMessage fires after dnd5e has fully processed the card.
  // renderChatMessageHTML (new v14 hook) covers plain messages; html is always HTMLElement.
  Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  Hooks.on("renderChatMessageHTML",   onRenderChatMessage);
}

async function onRenderChatMessage(message, html) {
  if (!game.user.isGM && !message.isAuthor) return;
  // Guard: dnd5e.renderChatMessage + renderChatMessageHTML both fire for dnd5e cards.
  if (html.querySelector('[data-action="pin-card"]')) return;

  const btn = document.createElement("button");
  btn.type           = "button";
  btn.dataset.action = "pin-card";
  btn.className      = "pinned-cards-pin-btn";
  btn.title          = game.i18n.localize("PINNEDCARDS.PinToToken");
  btn.innerHTML      = '<i class="fa-solid fa-thumbtack"></i>';

  btn.addEventListener("click", (e) => { e.stopPropagation(); onPinClick(message); });

  const footer = html.querySelector(".card-footer, .message-footer, .chat-card");
  (footer ?? html).appendChild(btn);
}

async function onPinClick(message) {
  const controlled  = canvas.tokens?.controlled ?? [];
  const sceneTokens = canvas.scene?.tokens?.contents ?? [];

  if (sceneTokens.length === 0) {
    return ui.notifications.warn(game.i18n.localize("PINNEDCARDS.NoTokensWarning"));
  }

  if (controlled.length === 1) {
    await iconPickerThenPin(controlled[0].document, message);
  } else {
    // Zero selected or multiple — let user pick the token first.
    await showTokenPickerDialog(sceneTokens, message);
  }
}

async function iconPickerThenPin(tokenDoc, message) {
  // Determine a sensible default icon from the message flags.
  const dnd5e = message.flags?.dnd5e ?? {};
  let defaultIcon = "icons/svg/anchor.svg";
  if (dnd5e.item?.uuid) {
    try {
      const item = await fromUuid(dnd5e.item.uuid);
      if (item?.img) defaultIcon = item.img;
    } catch { /* ignore */ }
  }

  const label = message.flavor || message.alias
    || game.i18n.localize("PINNEDCARDS.Pin.Default");

  const chosenIcon = await pickIcon(
    defaultIcon,
    `Pin "${label}" to ${tokenDoc.name}`
  );
  if (chosenIcon === null) return; // cancelled

  const pin = {
    id:           foundry.utils.randomID(),
    messageId:    message.id,
    label,
    icon:         chosenIcon,
    itemUuid:     dnd5e.item?.uuid     ?? null,
    activityUuid: dnd5e.activity?.uuid ?? null,
  };

  await PinManager.addPin(tokenDoc, pin);
  ui.notifications.info(
    game.i18n.format("PINNEDCARDS.PinnedNotification", {
      label: pin.label,
      token: tokenDoc.name,
    })
  );

  // Refresh the HUD if it's open, and the hotbar.
  canvas.hud?.token?.render();
  const { PinHotbar } = await import("../apps/pin-hotbar.mjs");
  PinHotbar.render();
}

async function showTokenPickerDialog(tokenDocs, message) {
  const options = tokenDocs
    .map(t => `<option value="${t.id}">${t.name}</option>`)
    .join("");

  const content = `
    <form>
      <div class="form-group">
        <label>${game.i18n.localize("PINNEDCARDS.PickToken")}</label>
        <select name="tokenId">${options}</select>
      </div>
    </form>`;

  new Dialog({
    title:   game.i18n.localize("PINNEDCARDS.PinToToken"),
    content,
    buttons: {
      pin: {
        icon:     '<i class="fa-solid fa-thumbtack"></i>',
        label:    game.i18n.localize("PINNEDCARDS.Pin"),
        callback: async (html) => {
          const tokenId  = html.querySelector('[name="tokenId"]')?.value;
          const tokenDoc = tokenDocs.find(t => t.id === tokenId);
          if (tokenDoc) await iconPickerThenPin(tokenDoc, message);
        },
      },
      cancel: { label: game.i18n.localize("Cancel") },
    },
    default: "pin",
  }).render(true);
}
