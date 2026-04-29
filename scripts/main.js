Hooks.on("init", () => {
  console.log("PF2e Advanced Wounds | Initialized");
});

/**
 * Add button to PF2e actor sheet
 */
Hooks.on("renderActorSheet", (app, html, data) => {
  // Vérifie que c'est une fiche PF2e
  if (app.actor?.type === "character" || app.actor?.type === "npc") {
    
    // Évite d'ajouter plusieurs fois le bouton
    if (html.find(".pf2eaw-button").length > 0) return;

    const button = $(`
      <a class="pf2eaw-button">
        <i class="fas fa-heart-broken"></i> ${game.i18n.localize("PF2EAW.Wounds")}
      </a>
    `);

    button.on("click", () => {
      new WoundsApp(app.actor).render(true);
    });

    // On ajoute le bouton en haut de la fiche
    const header = html.find(".window-title");
    header.after(button);
  }
});

/**
 * Basic Wounds App
 */
class WoundsApp extends Application {
  constructor(actor) {
    super();
    this.actor = actor;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "pf2eaw",
      title: "Wounds",
      template: "modules/pf2e-advanced-wounds/templates/wound-app.hbs",
      width: 400,
      height: 300,
      resizable: true
    });
  }

  getData() {
    return {
      actor: this.actor
    };
  }
}