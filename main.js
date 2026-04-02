const { Plugin, Notice } = require("obsidian");

module.exports = class TaskStatsUpdater extends Plugin {

  async onload() {
    console.log("Task Stats Updater: caricato");

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

  async updateActiveFile() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("⚠️ Nessun file attivo.");
      return;
    }
    await this.updateStats(file);
  }

  async updateStats(file) {
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