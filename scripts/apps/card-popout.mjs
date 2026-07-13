import { PinManager } from "../models/pin-manager.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CardPopout extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @param {TokenDocument} tokenDoc  @param {object} pin */
  constructor(tokenDoc, pin, options = {}) {
    super(options);
    this.tokenDoc = tokenDoc;
    this.pin      = pin;
  }

  static DEFAULT_OPTIONS = {
    id: "pinned-cards-popout",
    classes: ["pinned-cards-popout"],
    tag: "div",
    window: {
      title:       "Pinned Card",
      icon:        "fa-solid fa-thumbtack",
      minimizable: true,
      resizable:   true,
      controls: [
        {
          action: "unpin",
          icon:   "fa-solid fa-thumbtack fa-rotate-90",
          label:  "Unpin",
        },
      ],
    },
    position: {
      width:  380,
      height: "auto",
    },
    actions: {
      unpin:           CardPopout.#onUnpin,
      replaceTemplate: CardPopout.#onReplaceTemplate,
    },
  };

  static PARTS = {
    body: {
      template: "modules/pinned-cards/templates/card-popout.hbs",
    },
  };

  get title() {
    return this.pin.label ?? super.title;
  }

  /** Unique id per pin so multiple popouts can coexist. */
  get id() {
    return `pinned-cards-popout-${this.pin.id}`;
  }

  async _prepareContext(_options) {
    const message    = game.messages.get(this.pin.messageId);
    const hasTemplate = this.pin.activityUuid
      ? await this.#checkHasTemplate()
      : false;

    return {
      messageFound: !!message,
      hasTemplate,
      pin: this.pin,
    };
  }

  async _onRender(_context, _options) {
    const message = game.messages.get(this.pin.messageId);
    if (!message) return;

    const container = this.element.querySelector(".card-popout-message");
    if (!container) return;

    try {
      const msgHtml = await message.renderHTML();
      container.innerHTML = "";
      container.appendChild(msgHtml);
    } catch (err) {
      console.error("pinned-cards | CardPopout failed to render message:", err);
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  static async #onUnpin(_event, _target) {
    const confirmed = await Dialog.confirm({
      title:   game.i18n.localize("PINNEDCARDS.UnpinTitle"),
      content: `<p>${game.i18n.format("PINNEDCARDS.UnpinConfirm", { label: this.pin.label })}</p>`,
    });
    if (!confirmed) return;
    await PinManager.removePin(this.tokenDoc, this.pin.id);
    this.close();
    canvas.hud?.token?.render();
  }

  static async #onReplaceTemplate(_event, _target) {
    try {
      const activity = await fromUuid(this.pin.activityUuid);
      if (!activity) return;
      // Re-run just the template placement: no resource cost, no new message.
      await activity.use({ consumeResources: false, createMessage: false });
    } catch (err) {
      console.error("pinned-cards | Re-place template failed:", err);
      ui.notifications.error(game.i18n.localize("PINNEDCARDS.TemplateFailed"));
    }
  }

  async #checkHasTemplate() {
    if (!this.pin.activityUuid) return false;
    try {
      const activity = await fromUuid(this.pin.activityUuid);
      return !!(activity?.target?.template?.type);
    } catch {
      return false;
    }
  }
}
