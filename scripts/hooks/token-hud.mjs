import { PinManager }            from "../models/pin-manager.mjs";
import { CardPopout }            from "../apps/card-popout.mjs";
import { CustomConditionDialog } from "../apps/custom-condition-dialog.mjs";
import { pickIcon }              from "../models/icon-picker.mjs";

// Track open popouts keyed by pinId.
const openPopouts = new Map();

export function registerTokenHudHook() {
  Hooks.on("renderTokenHUD", onRenderTokenHUD);
}

function onRenderTokenHUD(app, html) {
  const tokenDoc = app.object?.document;
  if (!tokenDoc) return;

  const pins = PinManager.getPins(tokenDoc);
  const canEdit = game.user.isGM || tokenDoc.isOwner;

  // Inject pin row. Place it immediately AFTER .status-effects so it sits
  // in the same visual band as the condition pips rather than over the token.
  const row = buildPinRow(pins, tokenDoc, canEdit);
  const statusEl = html.querySelector(".status-effects");
  if (statusEl) {
    statusEl.insertAdjacentElement("afterend", row);
  } else {
    html.appendChild(row);
  }

  // "+ Custom condition" button — GM/owner only.
  if (canEdit) {
    const customBtn = buildCustomButton(tokenDoc);
    html.appendChild(customBtn);
  }
}

// ── Pin row ──────────────────────────────────────────────────────────────────

function buildPinRow(pins, tokenDoc, canEdit) {
  const row = document.createElement("div");
  row.className = "pinned-cards-row";
  if (pins.length === 0) row.classList.add("pinned-cards-row--empty");

  for (const pin of pins) {
    row.appendChild(buildPinWrapper(pin, tokenDoc, canEdit));
  }
  return row;
}

function buildPinWrapper(pin, tokenDoc, canEdit) {
  const wrapper = document.createElement("div");
  wrapper.className = "pinned-cards-icon-wrapper";
  wrapper.title = pin.label;

  const img = document.createElement("img");
  img.src       = pin.icon;
  img.alt       = pin.label;
  img.className = "pinned-cards-icon effect-control"; // effect-control picks up Foundry base styles
  img.dataset.pinId = pin.id;

  img.addEventListener("click", (e) => {
    e.stopPropagation();
    openPopout(pin, tokenDoc);
  });

  if (canEdit) {
    img.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showPinContextMenu(e, pin, tokenDoc);
    });

    // ✕ unpin badge — visible on hover via CSS.
    const badge = document.createElement("span");
    badge.className     = "unpin-badge";
    badge.textContent   = "✕";
    badge.title         = game.i18n.localize("PINNEDCARDS.Unpin");
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      confirmUnpin(pin, tokenDoc);
    });
    wrapper.appendChild(badge);
  }

  wrapper.appendChild(img);
  return wrapper;
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

// ── Context menu (right-click) ───────────────────────────────────────────────

function showPinContextMenu(event, pin, tokenDoc) {
  const menu = document.createElement("nav");
  menu.className = "pinned-cards-context-menu";
  menu.style.cssText =
    `position:fixed;left:${event.clientX}px;top:${event.clientY}px;z-index:10000`;

  const changeItem = makeMenuItem(
    '<i class="fa-solid fa-palette"></i>',
    game.i18n.localize("PINNEDCARDS.ChangeIcon"),
    () => { dismiss(); changeIcon(pin, tokenDoc); }
  );
  const unpinItem = makeMenuItem(
    '<i class="fa-solid fa-thumbtack fa-rotate-90"></i>',
    game.i18n.localize("PINNEDCARDS.Unpin"),
    () => { dismiss(); confirmUnpin(pin, tokenDoc); }
  );

  menu.appendChild(changeItem);
  menu.appendChild(unpinItem);
  document.body.appendChild(menu);

  function dismiss() {
    if (document.body.contains(menu)) document.body.removeChild(menu);
    document.removeEventListener("click", onClickOutside, { capture: true });
  }
  function onClickOutside(e) {
    if (!menu.contains(e.target)) dismiss();
  }
  setTimeout(() => document.addEventListener("click", onClickOutside, { capture: true }), 0);
}

function makeMenuItem(iconHtml, label, onClick) {
  const item = document.createElement("a");
  item.className = "pinned-cards-context-item";
  item.innerHTML = `${iconHtml} ${label}`;
  item.addEventListener("click", onClick);
  return item;
}

// ── Unpin ────────────────────────────────────────────────────────────────────

export async function confirmUnpin(pin, tokenDoc) {
  const confirmed = await Dialog.confirm({
    title:   game.i18n.localize("PINNEDCARDS.UnpinTitle"),
    content: `<p>${game.i18n.format("PINNEDCARDS.UnpinConfirm", { label: pin.label })}</p>`,
  });
  if (!confirmed) return;

  closePopoutForPin(pin.id);
  await PinManager.removePin(tokenDoc, pin.id);
  canvas.hud?.token?.render();

  const { PinHotbar } = await import("../apps/pin-hotbar.mjs");
  PinHotbar.render();
}

// ── Change icon ──────────────────────────────────────────────────────────────

async function changeIcon(pin, tokenDoc) {
  const chosen = await pickIcon(pin.icon, game.i18n.localize("PINNEDCARDS.ChangeIcon"));
  if (chosen === null || chosen === pin.icon) return;

  // Replace pin in-place (remove + re-add with new icon, keeping same id).
  const updated = { ...pin, icon: chosen };
  await PinManager.removePin(tokenDoc, pin.id);
  await PinManager.addPin(tokenDoc, updated);

  canvas.hud?.token?.render();
  const { PinHotbar } = await import("../apps/pin-hotbar.mjs");
  PinHotbar.render();
}

// ── Custom condition button ──────────────────────────────────────────────────

function buildCustomButton(tokenDoc) {
  const btn = document.createElement("button");
  btn.type      = "button";
  btn.className = "pinned-cards-custom-btn";
  btn.title     = game.i18n.localize("PINNEDCARDS.NewCustomCondition");
  btn.innerHTML = '<i class="fa-solid fa-circle-plus"></i>';
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    CustomConditionDialog.prompt(tokenDoc);
  });
  return btn;
}
