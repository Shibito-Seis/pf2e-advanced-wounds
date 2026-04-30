Hooks.on("init", () => {
  console.log("PF2e Advanced Wounds | Initialized");
});

const MODULE_ID = "pf2e-advanced-wounds";

const BODY_SCHEMAS = {
  simple: [
    { id: "head", label: "PF2EAW.Body.Head", status: "healthy" },
    { id: "torso", label: "PF2EAW.Body.Torso", status: "healthy" },
    { id: "leftArm", label: "PF2EAW.Body.LeftArm", status: "healthy" },
    { id: "rightArm", label: "PF2EAW.Body.RightArm", status: "healthy" },
    { id: "leftLeg", label: "PF2EAW.Body.LeftLeg", status: "healthy" },
    { id: "rightLeg", label: "PF2EAW.Body.RightLeg", status: "healthy" }
  ],
  advanced: []
};

const WOUND_SEVERITIES = [
  "superficial",
  "light",
  "moderate",
  "severe",
  "critical",
  "mortal"
];

const AFFLICTION_TYPES = [
  "poison",
  "disease",
  "infection",
  "magic"
];

const WOUND_SEVERITY_RANK = {
  healthy: 0,
  superficial: 1,
  light: 2,
  moderate: 3,
  severe: 4,
  critical: 5,
  mortal: 6
};

function getActorWounds(actor) {
  return foundry.utils.getProperty(actor, `flags.${MODULE_ID}.wounds`) ?? [];
}

function getActorAfflictions(actor) {
  return foundry.utils.getProperty(actor, `flags.${MODULE_ID}.afflictions`) ?? [];
}

function getZoneWounds(actor, zoneId) {
  return getActorWounds(actor).filter((wound) => wound.zone === zoneId);
}

function getZoneAfflictions(actor, zoneId) {
  return getActorAfflictions(actor).filter((affliction) => affliction.zone === zoneId);
}

function getZoneStatus(actor, zoneId) {
  const zoneWounds = getZoneWounds(actor, zoneId);

  if (zoneWounds.length === 0) return "healthy";

  return zoneWounds.reduce((highest, wound) => {
    const currentRank = WOUND_SEVERITY_RANK[wound.severity] ?? 0;
    const highestRank = WOUND_SEVERITY_RANK[highest] ?? 0;

    return currentRank > highestRank ? wound.severity : highest;
  }, "healthy");
}

function buildZoneTooltip(actor, zone) {
  const wounds = getZoneWounds(actor, zone.id);
  const afflictions = getZoneAfflictions(actor, zone.id);
  const status = getZoneStatus(actor, zone.id);
  const zoneLabel = game.i18n.localize(zone.label);

  const lines = [zoneLabel];

  if (wounds.length === 0) {
    lines.push(game.i18n.localize("PF2EAW.NoWounds"));
  } else {
    const statusLabel = game.i18n.localize(`PF2EAW.Severity.${status}`);
    lines.push(`${game.i18n.localize("PF2EAW.WoundCount")}: ${wounds.length}`);
    lines.push(`${game.i18n.localize("PF2EAW.MainStatus")}: ${statusLabel}`);

    for (const wound of wounds) {
      lines.push(`- ${game.i18n.localize(`PF2EAW.Severity.${wound.severity}`)}`);
    }
  }

  if (afflictions.length > 0) {
    lines.push("");
    lines.push(`${game.i18n.localize("PF2EAW.Afflictions")}: ${afflictions.length}`);

    for (const affliction of afflictions) {
      lines.push(`* ${game.i18n.localize(`PF2EAW.Affliction.${affliction.type}`)}`);
    }
  }

  return lines.join("\n");
}

Hooks.on("renderActorSheet", (app, html, data) => {
  if (!(app.actor?.type === "character" || app.actor?.type === "npc")) return;
  if (html.find(".pf2eaw-button").length > 0) return;

  const button = $(`
    <a class="pf2eaw-button">
      <i class="fas fa-heart-broken"></i> ${game.i18n.localize("PF2EAW.Wounds")}
    </a>
  `);

  button.on("click", () => {
    new WoundsApp(app.actor).render(true);
  });

  const header = html.find(".window-title");
  header.after(button);
});

class WoundsApp extends Application {
  constructor(actor) {
    super();
    this.actor = actor;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "pf2eaw",
      title: game.i18n.localize("PF2EAW.Wounds"),
      template: "modules/pf2e-advanced-wounds/templates/wound-app.hbs",
      width: 520,
      height: 420,
      resizable: true
    });
  }

  getData() {
    return {
      actor: this.actor,
      zones: BODY_SCHEMAS.simple.map((zone) => {
        const wounds = getZoneWounds(this.actor, zone.id);
        const afflictions = getZoneAfflictions(this.actor, zone.id);

        return {
          ...zone,
          status: getZoneStatus(this.actor, zone.id),
          woundCount: wounds.length,
          afflictionCount: afflictions.length,
          tooltip: buildZoneTooltip(this.actor, zone)
        };
      }),
      canEdit: game.user.isGM
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".pf2eaw-zone").on("click", (event) => {
      const zoneId = event.currentTarget.dataset.zoneId;

      if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("PF2EAW.ReadOnly"));
        return;
      }

      new Dialog({
        title: game.i18n.localize("PF2EAW.Dialog.Title"),
        content: `<p>${game.i18n.localize("PF2EAW.Dialog.Content")}</p>`,
        buttons: {
          add: {
            label: game.i18n.localize("PF2EAW.Dialog.Add"),
            callback: () => {
              this._openAddWoundDialog(zoneId);
            }
          },
          affliction: {
            label: game.i18n.localize("PF2EAW.Dialog.AddAffliction"),
            callback: () => {
              this._openAddAfflictionDialog(zoneId);
            }
          },
          view: {
            label: game.i18n.localize("PF2EAW.Dialog.View"),
            callback: () => {
              this._openViewZoneDialog(zoneId);
            }
          },
          cancel: {
            label: game.i18n.localize("PF2EAW.Dialog.Cancel")
          }
        },
        default: "add"
      }).render(true);
    });
  }

  _openAddWoundDialog(zoneId) {
    const options = WOUND_SEVERITIES.map((severity) => {
      const label = game.i18n.localize(`PF2EAW.Severity.${severity}`);
      return `<option value="${severity}">${label}</option>`;
    }).join("");

    new Dialog({
      title: game.i18n.localize("PF2EAW.AddWoundTitle"),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("PF2EAW.SelectSeverity")}</label>
            <select id="pf2eaw-severity">
              ${options}
            </select>
          </div>
        </form>
      `,
      buttons: {
        confirm: {
          label: game.i18n.localize("PF2EAW.Confirm"),
          callback: async (html) => {
            const severity = html.find("#pf2eaw-severity").val();
            await this._addWound(zoneId, severity);
          }
        },
        cancel: {
          label: game.i18n.localize("PF2EAW.Cancel")
        }
      },
      default: "confirm"
    }).render(true);
  }

  _openAddAfflictionDialog(zoneId) {
    const options = AFFLICTION_TYPES.map((type) => {
      const label = game.i18n.localize(`PF2EAW.Affliction.${type}`);
      return `<option value="${type}">${label}</option>`;
    }).join("");

    new Dialog({
      title: game.i18n.localize("PF2EAW.AddAfflictionTitle"),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("PF2EAW.SelectAffliction")}</label>
            <select id="pf2eaw-affliction">
              ${options}
            </select>
          </div>
        </form>
      `,
      buttons: {
        confirm: {
          label: game.i18n.localize("PF2EAW.Confirm"),
          callback: async (html) => {
            const type = html.find("#pf2eaw-affliction").val();
            await this._addAffliction(zoneId, type);
          }
        },
        cancel: {
          label: game.i18n.localize("PF2EAW.Cancel")
        }
      },
      default: "confirm"
    }).render(true);
  }

  async _addWound(zoneId, severity) {
    const wounds = getActorWounds(this.actor);

    wounds.push({
      id: foundry.utils.randomID(),
      zone: zoneId,
      severity,
      createdAt: Date.now()
    });

    await this.actor.setFlag(MODULE_ID, "wounds", wounds);
    this.render(false);

    ui.notifications.info(`Wound added: ${zoneId} (${severity})`);
  }

  async _addAffliction(zoneId, type) {
    const afflictions = getActorAfflictions(this.actor);

    afflictions.push({
      id: foundry.utils.randomID(),
      zone: zoneId,
      type,
      createdAt: Date.now()
    });

    await this.actor.setFlag(MODULE_ID, "afflictions", afflictions);
    this.render(false);

    ui.notifications.info(`${type} applied to ${zoneId}`);
  }

  _openViewZoneDialog(zoneId) {
    const wounds = getZoneWounds(this.actor, zoneId);

    const zoneLabel = game.i18n.localize(
      BODY_SCHEMAS.simple.find((zone) => zone.id === zoneId)?.label ?? zoneId
    );

    const content = wounds.length
      ? `
        <div class="pf2eaw-zone-wounds">
          ${wounds.map((wound) => `
            <div class="pf2eaw-wound-row">
              <strong>${game.i18n.localize(`PF2EAW.Severity.${wound.severity}`)}</strong>
              <button type="button" class="pf2eaw-remove-wound" data-wound-id="${wound.id}">
                ${game.i18n.localize("PF2EAW.Remove")}
              </button>
            </div>
          `).join("")}
        </div>
      `
      : `<p>${game.i18n.localize("PF2EAW.NoWounds")}</p>`;

    new Dialog({
      title: `${game.i18n.localize("PF2EAW.ViewZoneTitle")} — ${zoneLabel}`,
      content,
      buttons: {
        close: {
          label: game.i18n.localize("PF2EAW.Close")
        }
      },
      render: (html) => {
        html.find(".pf2eaw-remove-wound").on("click", async (event) => {
          const woundId = event.currentTarget.dataset.woundId;
          await this._removeWound(woundId);
          html.closest(".dialog").find(".close").click();
          this._openViewZoneDialog(zoneId);
        });
      }
    }).render(true);
  }

  async _removeWound(woundId) {
    const wounds = getActorWounds(this.actor);
    const updatedWounds = wounds.filter((wound) => wound.id !== woundId);

    await this.actor.setFlag(MODULE_ID, "wounds", updatedWounds);
    this.render(false);

    ui.notifications.info(game.i18n.localize("PF2EAW.WoundRemoved"));
  }
}