import { PinManager }            from "../models/pin-manager.mjs";
import { CardPopout }            from "../apps/card-popout.mjs";
import { CustomConditionDialog } from "../apps/custom-condition-dialog.mjs";

// Track open popouts keyed by pinId so we don't open duplicates.
const openPopouts = new Map();

export function registerTokenHudHook() {
  Hooks.on("renderTokenHUD", onRenderTokenHUD);
}

function onRenderTokenHUD(app, html) {
  const tokenDoc = app.object?.document;
  if (!tokenDoc) return;

  const pins = PinManager.getPins(tokenDoc);

  // Always inject the row container; hide it via CSS when empty.
  const row = buildPinRow(pins, tokenDoc);
  html.appendChild(row);

  // "+ Custom" button — GM or token owner only.
  if (game.user.isGM || tokenDoc.isOwner) {
    const customBtn = buildCustomButton(tokenDoc);
    html.appendChild(customBtn);
  }
}

// ── Pin row ──────────────────────────────────────────────────────────────────

function buildPinRow(pins, tokenDoc) {
  const row = document.createElement("div");
  row.className = "pinned-cards-row";
  if (pins.length === 0) row.classList.add("pinned-cards-row--empty");

  for (const pin of pins) {
    row.appendChild(buildPinIcon(pin, tokenDoc));
  }

  return row;
}

function buildPinIcon(pin, tokenDoc) {
  const img = document.createElement("img");
  img.src    = pin.icon;
  img.alt    = pin.label;
  img.title  = pin.label;
  img.dataset.pinId = pin.id;
  img.className = "pinned-cards-icon";

  img.addEventListener("click", (e) => {
    e.stopPropagation();
    openPopout(pin, tokenDoc);
  });

  img.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showUnpinMenu(e, pin, tokenDoc);
  });

  return img;
}

// ── Popout management ────────────────────────────────────────────────────────

function openPopout(pin, tokenDoc) {
  if (openPopouts.has(pin.id)) {
    openPopouts.get(pin.id).bringToFront?.();
    return;
  }
  const popout = new CardPopout(tokenDoc, pin);
  openPopouts.set(pin.id, popout);
  popout.render({ force: true });

  // Remove from tracking when the window closes.
  const origClose = popout.close.bind(popout);
  popout.close = async (...args) => {
    openPopouts.delete(pin.id);
    return origClose(...args);
  };
}

export function closePopoutForPin(pinId) {
  if (openPopouts.has(pinId)) {
    openPopouts.get(pinId).close();
    openPopouts.delete(pinId);
  }
}

// ── Unpin context menu ───────────────────────────────────────────────────────

function showUnpinMenu(event, pin, tokenDoc) {
  // Only the GM or the token owner may unpin.
  if (!game.user.isGM && !tokenDoc.isOwner) return;

  const menu = document.createElement("nav");
  menu.className = "pinned-cards-context-menu";
  menu.style.cssText = `position:fixed;left:${event.clientX}px;top:${event.clientY}px;z-index:10000`;

  const unpinItem = document.createElement("a");
  unpinItem.className = "pinned-cards-context-item";
  unpinItem.innerHTML = '<i class="fa-solid fa-thumbtack fa-rotate-90"></i> Unpin';
  unpinItem.addEventListener("click", () => {
    document.body.removeChild(menu);
    confirmUnpin(pin, tokenDoc);
  });

  menu.appendChild(unpinItem);
  document.body.appendChild(menu);

  const dismiss = (e) => {
    if (!menu.contains(e.target)) {
      if (document.body.contains(menu)) document.body.removeChild(menu);
      document.removeEventListener("click", dismiss, { capture: true });
    }
  };
  // Delay so this click doesn't immediately dismiss.
  setTimeout(() => document.addEventListener("click", dismiss, { capture: true }), 0);
}

async function confirmUnpin(pin, tokenDoc) {
  const confirmed = await Dialog.confirm({
    title: game.i18n.localize("PINNEDCARDS.UnpinTitle"),
    content: `<p>${game.i18n.format("PINNEDCARDS.UnpinConfirm", { label: pin.label })}</p>`,
  });
  if (!confirmed) return;

  closePopoutForPin(pin.id);
  await PinManager.removePin(tokenDoc, pin.id);
  // Re-render the HUD so the icon disappears immediately.
  canvas.hud?.token?.render();
}

// ── Custom condition button ──────────────────────────────────────────────────

function buildCustomButton(tokenDoc) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pinned-cards-custom-btn";
  btn.title = game.i18n.localize("PINNEDCARDS.NewCustomCondition");
  btn.innerHTML = '<i class="fa-solid fa-circle-plus"></i>';

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    CustomConditionDialog.prompt(tokenDoc);
  });

  return btn;
}
