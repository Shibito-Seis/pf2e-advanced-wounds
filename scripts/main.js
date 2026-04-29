Hooks.on("init", () => {
  console.log("PF2e Advanced Wounds | Initialized");
});

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

const WOUND_SEVERITY_RANK = {
  healthy: 0,
  superficial: 1,
  light: 2,
  moderate: 3,
  severe: 4,
  critical: 5,
  mortal: 6
};

function getZoneStatus(actor, zoneId) {
  const wounds = foundry.utils.getProperty(actor, "flags.pf2e-advanced-wounds.wounds") ?? [];
  const zoneWounds = wounds.filter((wound) => wound.zone === zoneId);

  if (zoneWounds.length === 0) return "healthy";

  return zoneWounds.reduce((highest, wound) => {
    const currentRank = WOUND_SEVERITY_RANK[wound.severity] ?? 0;
    const highestRank = WOUND_SEVERITY_RANK[highest] ?? 0;

    return currentRank > highestRank ? wound.severity : highest;
  }, "healthy");
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
      zones: BODY_SCHEMAS.simple.map((zone) => ({
  ...zone,
  status: getZoneStatus(this.actor, zone.id)
})),
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
          view: {
            label: game.i18n.localize("PF2EAW.Dialog.View"),
            callback: () => {
              ui.notifications.info(`View zone: ${zoneId}`);
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

  async _addWound(zoneId, severity) {
    const wounds = foundry.utils.getProperty(this.actor, "flags.pf2e-advanced-wounds.wounds") ?? [];

    wounds.push({
      id: foundry.utils.randomID(),
      zone: zoneId,
      severity,
      createdAt: Date.now()
    });

    await this.actor.setFlag("pf2e-advanced-wounds", "wounds", wounds);
    this.render(false);

    ui.notifications.info(`Wound added: ${zoneId} (${severity})`);
  }
}