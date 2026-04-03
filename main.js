const { Plugin, Notice, PluginSettingTab, Setting } = require("obsidian");

// ──────────────────────────────────────────────
//  Default settings
// ──────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  excludedFolders: [],  // array of { pattern: string, isRegex: boolean }
  excludedFiles:   [],  // array of { pattern: string, isRegex: boolean }
};

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

/** Render a section (folders OR files) inside the settings tab */
function renderSection(containerEl, plugin, key, {
  heading,
  emptyText,
  addLabel,
  addDesc,
  addPlaceholder,
  badgeExact,
  matchLabel,
}) {
  containerEl.createEl("h3", { text: heading });

  // ── Existing rules list ───────────────────
  const listEl = containerEl.createDiv(`task-stats-rules task-stats-rules-${key}`);

  const renderList = () => {
    listEl.empty();
    const rules = plugin.settings[key];

    if (rules.length === 0) {
      listEl.createEl("p", { text: emptyText, cls: "setting-item-description" });
      return;
    }

    rules.forEach((rule, idx) => {
      new Setting(listEl)
        .setName(rule.pattern)
        .setDesc(rule.isRegex ? "🔤 Espressione regolare" : `${badgeExact} ${matchLabel}`)
        .addButton((btn) =>
          btn.setIcon("trash")
            .setTooltip("Rimuovi")
            .onClick(async () => {
              plugin.settings[key].splice(idx, 1);
              await plugin.saveSettings();
              renderList();
            })
        );
    });
  };

  renderList();

  // ── Add new rule ──────────────────────────
  let newPattern = "";
  let newIsRegex = false;
  let inputEl    = null;
  let toggleRef  = null;

  new Setting(containerEl)
    .setName(addLabel)
    .setDesc(addDesc)
    .addText((text) => {
      text.setPlaceholder(addPlaceholder)
        .onChange((v) => { newPattern = v.trim(); });
      inputEl = text.inputEl;
    })
    .addToggle((toggle) => {
      toggle
        .setTooltip("Attiva per trattare il valore come RegExp")
        .setValue(false)
        .onChange((v) => { newIsRegex = v; });
      toggleRef = toggle;
    })
    .addButton((btn) => {
      btn.setButtonText("Aggiungi")
        .setCta()
        .onClick(async () => {
          if (!newPattern) {
            new Notice("⚠️ Inserisci un valore.");
            return;
          }
          if (newIsRegex) {
            try { new RegExp(newPattern); }
            catch (e) {
              new Notice("⚠️ RegExp non valida: " + e.message);
              return;
            }
          }

          plugin.settings[key].push({ pattern: newPattern, isRegex: newIsRegex });
          await plugin.saveSettings();

          // reset
          newPattern = "";
          newIsRegex = false;
          if (inputEl)   inputEl.value = "";
          if (toggleRef) toggleRef.setValue(false);

          renderList();
        });
    });
}

// ──────────────────────────────────────────────
//  Settings Tab
// ──────────────────────────────────────────────
class TaskStatsSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Task Stats Updater – Impostazioni" });

    containerEl.createEl("p", {
      text: "Configura cartelle e file da escludere dall'aggiornamento delle statistiche. Puoi usare percorsi/nomi esatti oppure espressioni regolari.",
      cls: "setting-item-description",
    });

    // ── Excluded FOLDERS ──────────────────────
    renderSection(containerEl, this.plugin, "excludedFolders", {
      heading:        "📁 Cartelle escluse",
      emptyText:      "Nessuna cartella esclusa.",
      addLabel:       "Percorso cartella / RegExp",
      addDesc:        "Prefisso cartella (es. \"Archivio\") oppure RegExp sul percorso completo (es. \"^Privato/.*\").",
      addPlaceholder: "es. Archivio  o  ^Privato/.*",
      badgeExact:     "📁",
      matchLabel:     "Prefisso cartella",
    });

    containerEl.createEl("hr");

    // ── Excluded FILES ────────────────────────
    renderSection(containerEl, this.plugin, "excludedFiles", {
      heading:        "📄 File esclusi",
      emptyText:      "Nessun file escluso.",
      addLabel:       "Nome file / RegExp",
      addDesc:        "Nome esatto con estensione (es. \"Indice.md\") oppure RegExp sul percorso completo (es. \".*template.*\\.md$\").",
      addPlaceholder: "es. Indice.md  o  .*template.*\\.md$",
      badgeExact:     "📄",
      matchLabel:     "Nome file esatto",
    });
  }
}

// ──────────────────────────────────────────────
//  Plugin
// ──────────────────────────────────────────────
module.exports = class TaskStatsUpdater extends Plugin {

  async onload() {
    console.log("Task Stats Updater: caricato");

    await this.loadSettings();
    this.addSettingTab(new TaskStatsSettingTab(this.app, this));

    this.addCommand({
      id: "update-task-stats",
      name: "Aggiorna statistiche task (file attivo)",
      callback: () => this.updateActiveFile(),
    });

    this.addRibbonIcon("check-circle", "Aggiorna Task Stats", () => {
      this.updateActiveFile();
    });

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        const active = this.app.workspace.getActiveFile();
        if (active && active.path === file.path) {
          clearTimeout(this._debounce);
          this._debounce = setTimeout(() => {
            this.updateStats(file);
          }, 500);
        }
      })
    );
  }

  onunload() {
    clearTimeout(this._debounce);
    console.log("Task Stats Updater: scaricato");
  }

  // ── Settings persistence ───────────────────
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // Ensure both arrays exist even on old saved data (migration safety)
    this.settings.excludedFolders ??= [];
    this.settings.excludedFiles   ??= [];
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // ── Exclusion checks ───────────────────────

  isFolderExcluded(filePath) {
    const normalised = filePath.replace(/\\/g, "/");
    for (const rule of this.settings.excludedFolders) {
      if (rule.isRegex) {
        try { if (new RegExp(rule.pattern).test(normalised)) return true; }
        catch (_) { /* skip invalid */ }
      } else {
        const prefix = rule.pattern.replace(/\\/g, "/").replace(/\/$/, "") + "/";
        if (normalised.toLowerCase().startsWith(prefix.toLowerCase())) return true;
      }
    }
    return false;
  }

  isFileExcluded(filePath) {
    const normalised = filePath.replace(/\\/g, "/");
    const fileName   = normalised.split("/").pop(); // bare filename

    for (const rule of this.settings.excludedFiles) {
      if (rule.isRegex) {
        // RegExp tested against the full vault-relative path
        try { if (new RegExp(rule.pattern).test(normalised)) return true; }
        catch (_) { /* skip invalid */ }
      } else {
        // Exact match on the filename only (case-insensitive)
        if (fileName.toLowerCase() === rule.pattern.toLowerCase()) return true;
      }
    }
    return false;
  }

  isExcluded(filePath) {
    return this.isFolderExcluded(filePath) || this.isFileExcluded(filePath);
  }

  // ── Core logic ─────────────────────────────
  async updateActiveFile() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("⚠️ Nessun file attivo.");
      return;
    }
    await this.updateStats(file);
  }

  async updateStats(file) {
    if (this.isExcluded(file.path)) {
      console.log(`Task Stats Updater: file escluso → ${file.path}`);
      return;
    }

    const content = await this.app.vault.read(file);
    const lines   = content.split("\n");

    let done  = 0;
    let doing = 0;
    let todo  = 0;
    let late  = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reDone  = /^\s*- \[x\] /i;
    const reDoing = /^\s*- \[\/\] /;
    const reTodo  = /^\s*- \[( |\?)\] /;
    const reDue   = /📅\s(\d{4}-\d{2}-\d{2})/;

    for (const line of lines) {
      const isDone  = reDone.test(line);
      const isDoing = reDoing.test(line);
      const isTodo  = reTodo.test(line);

      if (!isDone && !isDoing && !isTodo) continue;

      const dueMatch = line.match(reDue);
      let dueDate = null;
      if (dueMatch) {
        dueDate = new Date(dueMatch[1]);
        dueDate.setHours(0, 0, 0, 0);
      }

      if (isDone) { done++; continue; }
      if (isDoing) doing++;
      if (isTodo)  todo++;

      if (dueDate && dueDate < today) late++;
    }

    const total       = done + doing + todo;
    const progress    = total > 0 ? Math.round((done / total) * 100) : 0;
    const latePercent = total > 0 ? Math.round((late / total) * 100) : 0;

    const status =
      total === 0              ? "—"
      : done === total         ? "✅ Completato"
      : late > 0               ? "🔴 In ritardo"
      : done > 0 || doing > 0  ? "🟡 In corso"
      :                          "⚪ Non iniziato";

    await this.app.fileManager.processFrontMatter(
      this.app.vault.getAbstractFileByPath(file.path),
      (fm) => {
        fm.tasks_done         = done;
        fm.tasks_doing        = doing;
        fm.tasks_todo         = todo;
        fm.tasks_total        = total;
        fm.tasks_progress     = progress;
        fm.tasks_late         = late;
        fm.tasks_late_percent = latePercent;
        fm.tasks_status       = status;
      }
    );

    new Notice(`✅ Task Stats aggiornate: ${done}/${total} (${progress}%)`);
  }
};
