import {
  App, MarkdownView, Menu, Modal, Notice, Plugin, Setting, SuggestModal, TFile,
} from "obsidian";
import {
  MAX_SIZE, MIN_SIZE, deleteNotes, fontFamily, readData, renameNotes, updateNote,
  validFont, validSize, type NoteTypography, type PluginData,
} from "./model";

const FONTS = [
  "Arial", "Aptos", "Calibri", "Cambria", "Candara", "Consolas", "Courier New",
  "Georgia", "Helvetica", "Inter", "Noto Sans", "Noto Serif", "Palatino Linotype",
  "Segoe UI", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana",
  "sans-serif", "serif", "monospace", "system-ui",
];
const SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

export default class PageTypographyPlugin extends Plugin {
  data: PluginData = readData(null);
  private saveQueue: Promise<void> = Promise.resolve();
  private refreshTimer: number | undefined;
  private styled = new Set<HTMLElement>();
  private dialogs = new Set<Modal>();
  private decoratedMenus = new WeakSet<Menu>();
  private readingEvents = new WeakSet<MouseEvent>();
  private unloaded = false;

  async onload(): Promise<void> {
    try {
      this.data = readData(await this.loadData());
    } catch (error) {
      console.error("Page Typography: could not load settings", error);
      new Notice("Page Typography could not load its saved settings. Reload the plugin to try again.");
      return;
    }

    this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, info) => {
      if (info.file) this.addPageMenu(menu, info.file);
    }));
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (file instanceof TFile) this.addPageMenu(menu, file);
    }));
    this.registerEvent(this.app.workspace.on("file-open", () => this.refresh()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.refresh()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refresh()));
    this.registerEvent(this.app.workspace.on("css-change", () => this.refresh()));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (renameNotes(this.data.notes, oldPath, file.path)) void this.persist();
      this.refresh();
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (deleteNotes(this.data.notes, file.path)) void this.persist();
      this.refresh();
    }));

    for (const [id, name, action] of [
      ["set-page-font", "Set page font", (file: TFile) => this.openFont(file)],
      ["set-page-font-size", "Set page font size", (file: TFile) => this.openSize(file)],
      ["reset-page-typography", "Reset page typography", (file: TFile) => { void this.reset(file); }],
    ] as const) {
      this.addCommand({ id, name, checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) return false;
        if (!checking) action(view.file);
        return true;
      } });
    }

    // Reading view does not emit editor-menu. Attach to each view, including popouts.
    this.app.workspace.onLayoutReady(() => {
      if (this.unloaded) return;
      this.refresh();
    });
  }

  private addPageMenu(menu: Menu, file: TFile): void {
    if (file.extension !== "md" || this.decoratedMenus.has(menu)) return;
    this.decoratedMenus.add(menu);
    menu.addSeparator();
    const current = this.data.notes[file.path];
    menu.addItem((item) => item
      .setTitle(`Page font${current?.font ? `: ${current.font}` : ""}…`)
      .setIcon("type").onClick(() => this.openFont(file)));
    menu.addItem((item) => item
      .setTitle(`Page font size${current?.size ? `: ${current.size} px` : ""}…`)
      .setIcon("a-large-small").onClick(() => this.openSize(file)));
    menu.addItem((item) => item.setTitle("Reset page typography")
      .setIcon("rotate-ccw").setDisabled(!current)
      .onClick(() => { void this.reset(file); }));
  }

  private openFont(file: TFile): void {
    const modal = new FontPicker(this.app, file, this.data.notes[file.path]?.font,
      Object.values(this.data.notes).flatMap((note) => note.font ? [note.font] : []),
      (font) => this.change(file, { font }));
    this.trackDialog(modal);
  }

  private openSize(file: TFile): void {
    const modal = new SizePicker(this.app, file, this.data.notes[file.path],
      (size) => this.change(file, { size }));
    this.trackDialog(modal);
  }

  private trackDialog(modal: Modal): void {
    this.dialogs.add(modal);
    const close = modal.onClose.bind(modal);
    modal.onClose = () => { close(); this.dialogs.delete(modal); };
    modal.open();
  }

  async change(file: TFile, patch: Partial<NoteTypography>): Promise<void> {
    if (this.unloaded) return;
    if (this.app.vault.getAbstractFileByPath(file.path) !== file || file.extension !== "md") {
      new Notice("This note is no longer available.");
      return;
    }
    if ((patch.font !== undefined && !validFont(patch.font)) ||
        (patch.size !== undefined && !validSize(patch.size))) {
      new Notice("Enter a valid font or a font size between 8 and 96 px.");
      return;
    }
    updateNote(this.data.notes, file.path, patch);
    this.refresh();
    await this.persist();
  }

  async reset(file: TFile): Promise<void> {
    await this.change(file, { font: undefined, size: undefined });
  }

  private async persist(): Promise<void> {
    // Snapshot and serialize writes so quick successive changes cannot overwrite each other.
    const snapshot = JSON.parse(JSON.stringify(this.data)) as PluginData;
    const write = this.saveQueue.then(() => this.saveData(snapshot));
    this.saveQueue = write.catch(() => {});
    try { await write; }
    catch (error) {
      console.error("Page Typography: could not save settings", error);
      new Notice("Page Typography could not save your changes. They will last only until Obsidian closes unless a later save succeeds.");
    }
  }

  private boundViews = new Map<MarkdownView, (event: MouseEvent) => void>();

  private refresh(): void {
    if (this.unloaded) return;
    this.applyToViews();
    // A file-open can precede construction of the editor/preview DOM.
    if (this.refreshTimer !== undefined) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = undefined;
      if (!this.unloaded) this.applyToViews();
    }, 100);
  }

  private applyToViews(): void {
    const currentRoots = new Set<HTMLElement>();
    const currentViews = new Set<MarkdownView>();
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;
      currentViews.add(view);
      if (!this.boundViews.has(view)) {
        const handler = (event: MouseEvent) => {
          if (view.getMode() !== "preview" || !view.file || this.readingEvents.has(event)) return;
          this.readingEvents.add(event);
          // Keep Obsidian's own link/image menus intact; use the note/tab menu for those.
          const target = event.target as Element | null;
          if (target?.closest("a, img, audio, video, input, textarea, button, .internal-embed")) return;
          event.preventDefault();
          event.stopPropagation();
          const menu = new Menu();
          this.addPageMenu(menu, view.file);
          menu.showAtMouseEvent(event);
        };
        this.boundViews.set(view, handler);
        view.contentEl.addEventListener("contextmenu", handler);
      }
      const root = view.contentEl;
      currentRoots.add(root);
      const note = view.file ? this.data.notes[view.file.path] : undefined;
      this.clearRoot(root);
      if (!note) continue;
      if (note.font) {
        root.classList.add("pft-font");
        root.style.setProperty("--pft-family", fontFamily(note.font));
      }
      if (note.size) {
        root.classList.add("pft-size");
        root.style.setProperty("--pft-size", `${note.size}px`);
      }
      this.styled.add(root);
    }
    for (const root of this.styled) {
      if (!currentRoots.has(root)) this.clearRoot(root);
    }
    for (const [view, handler] of this.boundViews) {
      if (!currentViews.has(view)) {
        view.contentEl.removeEventListener("contextmenu", handler);
        this.boundViews.delete(view);
      }
    }
  }

  private clearRoot(root: HTMLElement): void {
    root.classList.remove("pft-font", "pft-size");
    root.style.removeProperty("--pft-family");
    root.style.removeProperty("--pft-size");
    this.styled.delete(root);
  }

  onunload(): void {
    this.unloaded = true;
    if (this.refreshTimer !== undefined) window.clearTimeout(this.refreshTimer);
    for (const dialog of this.dialogs) dialog.close();
    for (const root of this.styled) this.clearRoot(root);
    for (const [view, handler] of this.boundViews) {
      view.contentEl.removeEventListener("contextmenu", handler);
    }
    this.boundViews.clear();
  }
}

interface FontChoice { label: string; value?: string; custom?: boolean }

class FontPicker extends SuggestModal<FontChoice> {
  private choices: string[];

  constructor(app: App, private file: TFile, private current: string | undefined,
    savedFonts: string[], private apply: (font: string | undefined) => Promise<void>) {
    super(app);
    this.choices = [...new Set([...FONTS, ...savedFonts])].sort((a, b) => a.localeCompare(b));
    this.setPlaceholder("Search fonts or type an installed font name…");
    this.setInstructions([{ command: "↑ ↓", purpose: "navigate" },
      { command: "↵", purpose: "apply font" }, { command: "esc", purpose: "cancel" }]);
    this.limit = 50;
  }

  onOpen(): void {
    super.onOpen();
    this.modalEl.classList.add("pft-font-picker");
    this.inputEl.setAttribute("aria-label", `Font for ${this.file.basename}`);
    this.modalEl.createDiv({ cls: "pft-font-help", text:
      `Font for “${this.file.basename}”. Fonts must be installed on this device. Type a name to use a custom font.` });
  }

  getSuggestions(query: string): FontChoice[] {
    const name = query.trim();
    const choices: FontChoice[] = [
      ...(!name || "use vault default".includes(name.toLowerCase())
        ? [{ label: "Use vault default", value: undefined }] : []),
      ...this.choices.filter((font) => font.toLowerCase().includes(name.toLowerCase()))
        .map((font) => ({ label: font, value: font })),
    ];
    if (validFont(name) && !this.choices.some((font) => font.toLowerCase() === name.toLowerCase())) {
      choices.unshift({ label: `Use “${name}”`, value: name, custom: true });
    }
    return choices;
  }

  renderSuggestion(choice: FontChoice, el: HTMLElement): void {
    const row = el.createDiv({ cls: "pft-font-choice" });
    const label = row.createSpan({ text: choice.label });
    if (choice.value) label.style.fontFamily = `${fontFamily(choice.value)}, sans-serif`;
    if (choice.value === this.current) row.createSpan({ cls: "pft-current", text: "Current" });
    if (choice.custom) el.createDiv({ cls: "pft-custom-hint", text: "Custom installed font" });
  }

  onChooseSuggestion(choice: FontChoice): void { void this.apply(choice.value); }
}

class SizePicker extends Modal {
  constructor(app: App, private file: TFile, private current: NoteTypography | undefined,
    private apply: (size: number | undefined) => Promise<void>) { super(app); }

  onOpen(): void {
    this.setTitle("Page font size");
    const { contentEl } = this;
    this.modalEl.classList.add("pft-size-picker");
    contentEl.createEl("p", { cls: "pft-muted", text: `Set the text size for “${this.file.basename}”.` });
    let input: HTMLInputElement;
    const validation = contentEl.createDiv({ cls: "pft-validation", attr: { role: "status", "aria-live": "polite" } });
    const preview = contentEl.createDiv({ cls: "pft-preview" });
    preview.createEl("p", { text: "The quick brown fox jumps over the lazy dog." });
    preview.createEl("p", { text: "Azərbaycan dili: Ə ə, Ğ ğ, İ ı, Ö ö, Ş ş, Ü ü." });
    if (this.current?.font) preview.style.fontFamily = `${fontFamily(this.current.font)}, sans-serif`;
    const updatePreview = (value: string) => {
      const size = value.trim() ? Number(value) : NaN;
      const valid = validSize(size);
      validation.textContent = valid ? "" : `Enter a number from ${MIN_SIZE} to ${MAX_SIZE}.`;
      input.setAttribute("aria-invalid", String(!valid));
      if (valid) preview.style.fontSize = `${size}px`;
    };
    const field = new Setting(contentEl).setName("Font size (px)")
      .setDesc(`Choose a preset or enter a value from ${MIN_SIZE} to ${MAX_SIZE}.`)
      .addText((text) => {
        input = text.inputEl;
        input.type = "number";
        input.min = String(MIN_SIZE);
        input.max = String(MAX_SIZE);
        input.step = "0.5";
        input.setAttribute("aria-label", "Font size in pixels");
        text.setValue(String(this.current?.size ?? 16)).onChange(updatePreview);
      });
    contentEl.insertBefore(field.settingEl, validation);
    const presets = contentEl.createDiv({ cls: "pft-presets" });
    for (const size of SIZES) {
      const button = presets.createEl("button", { text: `${size}`, attr: { type: "button", "aria-label": `${size} pixels` } });
      button.addEventListener("click", () => { input.value = String(size); updatePreview(input.value); });
    }
    contentEl.insertBefore(presets, preview);
    const submit = async () => {
      const size = input.value.trim() ? Number(input.value) : NaN;
      updatePreview(input.value);
      if (!validSize(size)) { input.focus(); return; }
      await this.apply(size);
      this.close();
    };
    new Setting(contentEl).addButton((button) => button.setButtonText("Use vault default")
      .onClick(async () => { await this.apply(undefined); this.close(); }))
      .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((button) => button.setButtonText("Apply").setCta().onClick(submit));
    input!.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); void submit(); }
    });
    updatePreview(input!.value);
    input!.focus();
    input!.select();
  }

  onClose(): void { this.contentEl.empty(); }
}
