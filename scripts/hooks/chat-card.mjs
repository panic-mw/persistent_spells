import { PinManager } from "../models/pin-manager.mjs";

export function registerChatCardHook() {
  // dnd5e.renderChatMessage fires after dnd5e has finished processing,
  // guaranteeing button visibility is already set correctly.
  Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);

  // Fall back for non-dnd5e messages.
  Hooks.on("renderChatMessage", onRenderChatMessage);
}

async function onRenderChatMessage(message, html) {
  // Show the Pin button only to the message owner or GM.
  if (!game.user.isGM && !message.isAuthor) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.action = "pin-card";
  btn.className = "pinned-cards-pin-btn";
  btn.title = game.i18n.localize("PINNEDCARDS.PinToToken");
  btn.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';

  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    onPinClick(message);
  });

  // Append to the card footer, or directly to the message content if no footer.
  const footer = html.querySelector(".card-footer, .message-footer, .chat-card");
  if (footer) {
    footer.appendChild(btn);
  } else {
    html.appendChild(btn);
  }
}

async function onPinClick(message) {
  const controlled = canvas.tokens?.controlled ?? [];

  if (controlled.length === 1) {
    await pinToToken(controlled[0].document, message);
  } else if (controlled.length > 1) {
    await showTokenPickerDialog(controlled.map(t => t.document), message);
  } else {
    // No token selected — pick from all tokens on the scene.
    const sceneTokens = canvas.scene?.tokens?.contents ?? [];
    if (sceneTokens.length === 0) {
      return ui.notifications.warn(game.i18n.localize("PINNEDCARDS.NoTokensWarning"));
    }
    await showTokenPickerDialog(sceneTokens, message);
  }
}

async function pinToToken(tokenDoc, message) {
  const pin = PinManager.pinFromMessage(message);

  // Use item image from the actor if we have an itemUuid.
  if (pin.itemUuid) {
    try {
      const item = await fromUuid(pin.itemUuid);
      if (item?.img) pin.icon = item.img;
      if (item?.name) pin.label = item.name;
    } catch { /* item may not be accessible */ }
  }

  await PinManager.addPin(tokenDoc, pin);
  ui.notifications.info(
    game.i18n.format("PINNEDCARDS.PinnedNotification", { label: pin.label, token: tokenDoc.name })
  );
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
    title: game.i18n.localize("PINNEDCARDS.PinToToken"),
    content,
    buttons: {
      pin: {
        icon: '<i class="fa-solid fa-thumbtack"></i>',
        label: game.i18n.localize("PINNEDCARDS.Pin"),
        callback: async (html) => {
          const tokenId = html.querySelector('[name="tokenId"]')?.value;
          const tokenDoc = tokenDocs.find(t => t.id === tokenId);
          if (tokenDoc) await pinToToken(tokenDoc, message);
        },
      },
      cancel: { label: game.i18n.localize("Cancel") },
    },
    default: "pin",
  }).render(true);
}
