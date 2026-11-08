/* Page Typography v1.0.0 | MIT License | Source: src/main.ts */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => PageTypographyPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/model.ts
var MIN_SIZE = 8;
var MAX_SIZE = 96;
function validFont(value) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 100 && !/[\x00-\x1f\x7f"'\\,;:{}<>]/.test(value);
}
function validSize(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= MIN_SIZE && value <= MAX_SIZE;
}
function fontFamily(font) {
  return ["serif", "sans-serif", "monospace", "system-ui"].includes(font) ? font : `"${font}"`;
}
function readData(raw) {
  const result = { version: 1, notes: /* @__PURE__ */ Object.create(null) };
  if (!raw || typeof raw !== "object" || !("notes" in raw) || !raw.notes || typeof raw.notes !== "object") return result;
  for (const [path, value] of Object.entries(raw.notes)) {
    if (!path.endsWith(".md") || !value || typeof value !== "object") continue;
    const source = value;
    const entry = {};
    if (validFont(source.font)) entry.font = source.font.trim();
    if (validSize(source.size)) entry.size = source.size;
    if (Object.keys(entry).length) result.notes[path] = entry;
  }
  return result;
}
function updateNote(notes, path, patch) {
  const next = { ...notes[path], ...patch };
  if (next.font === void 0) delete next.font;
  if (next.size === void 0) delete next.size;
  if (Object.keys(next).length) notes[path] = next;
  else delete notes[path];
}
function renameNotes(notes, oldPath, newPath) {
  if (oldPath === newPath) return false;
  const moved = Object.entries(notes).filter(([path]) => path === oldPath || path.startsWith(oldPath + "/"));
  for (const [path] of moved) delete notes[path];
  for (const [path, value] of moved) {
    notes[newPath + path.slice(oldPath.length)] = value;
  }
  return moved.length > 0;
}
function deleteNotes(notes, deletedPath) {
  let changed = false;
  for (const path of Object.keys(notes)) {
    if (path === deletedPath || path.startsWith(deletedPath + "/")) {
      delete notes[path];
      changed = true;
    }
  }
  return changed;
}

// src/main.ts
var FONTS = [
  "Arial",
  "Aptos",
  "Calibri",
  "Cambria",
  "Candara",
  "Consolas",
  "Courier New",
  "Georgia",
  "Helvetica",
  "Inter",
  "Noto Sans",
  "Noto Serif",
  "Palatino Linotype",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
  "sans-serif",
  "serif",
  "monospace",
  "system-ui"
];
var SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
var PageTypographyPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.data = readData(null);
    this.saveQueue = Promise.resolve();
    this.styled = /* @__PURE__ */ new Set();
    this.dialogs = /* @__PURE__ */ new Set();
    this.decoratedMenus = /* @__PURE__ */ new WeakSet();
    this.readingEvents = /* @__PURE__ */ new WeakSet();
    this.unloaded = false;
    this.boundViews = /* @__PURE__ */ new Map();
  }
  async onload() {
    try {
      this.data = readData(await this.loadData());
    } catch (error) {
      console.error("Page Typography: could not load settings", error);
      new import_obsidian.Notice("Page Typography could not load its saved settings. Reload the plugin to try again.");
      return;
    }
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, info) => {
      if (info.file) this.addPageMenu(menu, info.file);
    }));
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (file instanceof import_obsidian.TFile) this.addPageMenu(menu, file);
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
      ["set-page-font", "Set page font", (file) => this.openFont(file)],
      ["set-page-font-size", "Set page font size", (file) => this.openSize(file)],
      ["reset-page-typography", "Reset page typography", (file) => {
        void this.reset(file);
      }]
    ]) {
      this.addCommand({ id, name, checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
        if (!view?.file) return false;
        if (!checking) action(view.file);
        return true;
      } });
    }
    this.app.workspace.onLayoutReady(() => {
      if (this.unloaded) return;
      this.refresh();
    });
  }
  addPageMenu(menu, file) {
    if (file.extension !== "md" || this.decoratedMenus.has(menu)) return;
    this.decoratedMenus.add(menu);
    menu.addSeparator();
    const current = this.data.notes[file.path];
    menu.addItem((item) => item.setTitle(`Page font${current?.font ? `: ${current.font}` : ""}\u2026`).setIcon("type").onClick(() => this.openFont(file)));
    menu.addItem((item) => item.setTitle(`Page font size${current?.size ? `: ${current.size} px` : ""}\u2026`).setIcon("a-large-small").onClick(() => this.openSize(file)));
    menu.addItem((item) => item.setTitle("Reset page typography").setIcon("rotate-ccw").setDisabled(!current).onClick(() => {
      void this.reset(file);
    }));
  }
  openFont(file) {
    const modal = new FontPicker(
      this.app,
      file,
      this.data.notes[file.path]?.font,
      Object.values(this.data.notes).flatMap((note) => note.font ? [note.font] : []),
      (font) => this.change(file, { font })
    );
    this.trackDialog(modal);
  }
  openSize(file) {
    const modal = new SizePicker(
      this.app,
      file,
      this.data.notes[file.path],
      (size) => this.change(file, { size })
    );
    this.trackDialog(modal);
  }
  trackDialog(modal) {
    this.dialogs.add(modal);
    const close = modal.onClose.bind(modal);
    modal.onClose = () => {
      close();
      this.dialogs.delete(modal);
    };
    modal.open();
  }
  async change(file, patch) {
    if (this.unloaded) return;
    if (this.app.vault.getAbstractFileByPath(file.path) !== file || file.extension !== "md") {
      new import_obsidian.Notice("This note is no longer available.");
      return;
    }
    if (patch.font !== void 0 && !validFont(patch.font) || patch.size !== void 0 && !validSize(patch.size)) {
      new import_obsidian.Notice("Enter a valid font or a font size between 8 and 96 px.");
      return;
    }
    updateNote(this.data.notes, file.path, patch);
    this.refresh();
    await this.persist();
  }
  async reset(file) {
    await this.change(file, { font: void 0, size: void 0 });
  }
  async persist() {
    const snapshot = JSON.parse(JSON.stringify(this.data));
    const write = this.saveQueue.then(() => this.saveData(snapshot));
    this.saveQueue = write.catch(() => {
    });
    try {
      await write;
    } catch (error) {
      console.error("Page Typography: could not save settings", error);
      new import_obsidian.Notice("Page Typography could not save your changes. They will last only until Obsidian closes unless a later save succeeds.");
    }
  }
  refresh() {
    if (this.unloaded) return;
    this.applyToViews();
    if (this.refreshTimer !== void 0) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = void 0;
      if (!this.unloaded) this.applyToViews();
    }, 100);
  }
  applyToViews() {
    const currentRoots = /* @__PURE__ */ new Set();
    const currentViews = /* @__PURE__ */ new Set();
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof import_obsidian.MarkdownView)) continue;
      currentViews.add(view);
      if (!this.boundViews.has(view)) {
        const handler = (event) => {
          if (view.getMode() !== "preview" || !view.file || this.readingEvents.has(event)) return;
          this.readingEvents.add(event);
          const target = event.target;
          if (target?.closest("a, img, audio, video, input, textarea, button, .internal-embed")) return;
          event.preventDefault();
          event.stopPropagation();
          const menu = new import_obsidian.Menu();
          this.addPageMenu(menu, view.file);
          menu.showAtMouseEvent(event);
        };
        this.boundViews.set(view, handler);
        view.contentEl.addEventListener("contextmenu", handler);
      }
      const root = view.contentEl;
      currentRoots.add(root);
      const note = view.file ? this.data.notes[view.file.path] : void 0;
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
  clearRoot(root) {
    root.classList.remove("pft-font", "pft-size");
    root.style.removeProperty("--pft-family");
    root.style.removeProperty("--pft-size");
    this.styled.delete(root);
  }
  onunload() {
    this.unloaded = true;
    if (this.refreshTimer !== void 0) window.clearTimeout(this.refreshTimer);
    for (const dialog of this.dialogs) dialog.close();
    for (const root of this.styled) this.clearRoot(root);
    for (const [view, handler] of this.boundViews) {
      view.contentEl.removeEventListener("contextmenu", handler);
    }
    this.boundViews.clear();
  }
};
var FontPicker = class extends import_obsidian.SuggestModal {
  constructor(app, file, current, savedFonts, apply) {
    super(app);
    this.file = file;
    this.current = current;
    this.apply = apply;
    this.choices = [.../* @__PURE__ */ new Set([...FONTS, ...savedFonts])].sort((a, b) => a.localeCompare(b));
    this.setPlaceholder("Search fonts or type an installed font name\u2026");
    this.setInstructions([
      { command: "\u2191 \u2193", purpose: "navigate" },
      { command: "\u21B5", purpose: "apply font" },
      { command: "esc", purpose: "cancel" }
    ]);
    this.limit = 50;
  }
  onOpen() {
    super.onOpen();
    this.modalEl.classList.add("pft-font-picker");
    this.inputEl.setAttribute("aria-label", `Font for ${this.file.basename}`);
    this.modalEl.createDiv({ cls: "pft-font-help", text: `Font for \u201C${this.file.basename}\u201D. Fonts must be installed on this device. Type a name to use a custom font.` });
  }
  getSuggestions(query) {
    const name = query.trim();
    const choices = [
      ...!name || "use vault default".includes(name.toLowerCase()) ? [{ label: "Use vault default", value: void 0 }] : [],
      ...this.choices.filter((font) => font.toLowerCase().includes(name.toLowerCase())).map((font) => ({ label: font, value: font }))
    ];
    if (validFont(name) && !this.choices.some((font) => font.toLowerCase() === name.toLowerCase())) {
      choices.unshift({ label: `Use \u201C${name}\u201D`, value: name, custom: true });
    }
    return choices;
  }
  renderSuggestion(choice, el) {
    const row = el.createDiv({ cls: "pft-font-choice" });
    const label = row.createSpan({ text: choice.label });
    if (choice.value) label.style.fontFamily = `${fontFamily(choice.value)}, sans-serif`;
    if (choice.value === this.current) row.createSpan({ cls: "pft-current", text: "Current" });
    if (choice.custom) el.createDiv({ cls: "pft-custom-hint", text: "Custom installed font" });
  }
  onChooseSuggestion(choice) {
    void this.apply(choice.value);
  }
};
var SizePicker = class extends import_obsidian.Modal {
  constructor(app, file, current, apply) {
    super(app);
    this.file = file;
    this.current = current;
    this.apply = apply;
  }
  onOpen() {
    this.setTitle("Page font size");
    const { contentEl } = this;
    this.modalEl.classList.add("pft-size-picker");
    contentEl.createEl("p", { cls: "pft-muted", text: `Set the text size for \u201C${this.file.basename}\u201D.` });
    let input;
    const validation = contentEl.createDiv({ cls: "pft-validation", attr: { role: "status", "aria-live": "polite" } });
    const preview = contentEl.createDiv({ cls: "pft-preview" });
    preview.createEl("p", { text: "The quick brown fox jumps over the lazy dog." });
    preview.createEl("p", { text: "Az\u0259rbaycan dili: \u018F \u0259, \u011E \u011F, \u0130 \u0131, \xD6 \xF6, \u015E \u015F, \xDC \xFC." });
    if (this.current?.font) preview.style.fontFamily = `${fontFamily(this.current.font)}, sans-serif`;
    const updatePreview = (value) => {
      const size = value.trim() ? Number(value) : NaN;
      const valid = validSize(size);
      validation.textContent = valid ? "" : `Enter a number from ${MIN_SIZE} to ${MAX_SIZE}.`;
      input.setAttribute("aria-invalid", String(!valid));
      if (valid) preview.style.fontSize = `${size}px`;
    };
    const field = new import_obsidian.Setting(contentEl).setName("Font size (px)").setDesc(`Choose a preset or enter a value from ${MIN_SIZE} to ${MAX_SIZE}.`).addText((text) => {
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
      button.addEventListener("click", () => {
        input.value = String(size);
        updatePreview(input.value);
      });
    }
    contentEl.insertBefore(presets, preview);
    const submit = async () => {
      const size = input.value.trim() ? Number(input.value) : NaN;
      updatePreview(input.value);
      if (!validSize(size)) {
        input.focus();
        return;
      }
      await this.apply(size);
      this.close();
    };
    new import_obsidian.Setting(contentEl).addButton((button) => button.setButtonText("Use vault default").onClick(async () => {
      await this.apply(void 0);
      this.close();
    })).addButton((button) => button.setButtonText("Cancel").onClick(() => this.close())).addButton((button) => button.setButtonText("Apply").setCta().onClick(submit));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void submit();
      }
    });
    updatePreview(input.value);
    input.focus();
    input.select();
  }
  onClose() {
    this.contentEl.empty();
  }
};
