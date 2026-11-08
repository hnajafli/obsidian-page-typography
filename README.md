# Page Typography

Set a separate font and text size for each Markdown note in Obsidian. All menu items and dialogs are in English.

## Installation

1. Download and extract the installation archive. [page-typography-1.0.0.zip](https://github.com/hnajafli/obsidian-page-typography/releases/download/1.0.0/page-typography-1.0.0.zip)
2. Move the extracted `page-typography` folder into your vault's `.obsidian/plugins/` folder. Create the `plugins` folder if needed.
3. Restart Obsidian.
4. Go to **Settings → Community plugins** and enable **Page Typography**. If Restricted mode is active, allow community plugins first.

Your vault should have this folder structure.

```text
Your vault/
  .obsidian/
    plugins/
      page-typography/
        main.js
        manifest.json
        styles.css
```

## Usage

Right-click the note's text, its tab, or its name in File explorer.

- **Page font…** — Choose a font from the list or type the name of an installed font. Each font name appears in its own typeface when available.
- **Page font size…** — Pick a preset or enter a size from 8 to 96 px. Preview the result and click **Apply**.
- **Reset page typography** — Restore the vault's default font and size for this note.

Choose **Use vault default** in either picker to reset that setting independently. These commands are also available in the command palette.

## Behavior

- Works in Reading view, Live Preview, and Source mode. Two notes open side by side can have different typography.
- Applies to the whole note, not only selected text. Heading hierarchy and code fonts retain their normal roles.
- Uses fonts already installed on the device; it does not download fonts. The list includes common fonts, which may not all be installed. An unavailable font falls back to a device font. Custom font names should identify a single family, such as `JetBrains Mono`.
- Choices are stored by note path in `.obsidian/plugins/page-typography/data.json`. The Markdown note content is not changed.
- Remembers settings after restarting Obsidian. Renaming or moving a note or folder **inside Obsidian** carries the settings with it. Renames made while Obsidian is closed cannot be tracked.
- In Reading view, right-click ordinary note text or blank space. Links, images, and embedded notes keep Obsidian's own menus; use the note tab or File explorer menu for those cases.
- Custom themes or snippets that force their own font styles can interfere. Fonts must be installed separately on each device. To sync these preferences, include this plugin's `data.json` in your sync setup.
- Disabling the plugin restores the normal view without deleting saved choices.

## Development

Requires Node.js 22.6+ and pnpm or npm.

```sh
pnpm install
pnpm build
pnpm test
pnpm package
```

`main.js` is the bundled Obsidian plugin. Only `main.js`, `manifest.json`, and `styles.css` are required at runtime. `pnpm package` creates an installation ZIP in `dist/`.

Built using the official [Obsidian plugin API](https://github.com/obsidianmd/obsidian-api) and [context menu hooks](https://docs.obsidian.md/Plugins/User+interface/Context+menus).

Verified on Windows with Obsidian 1.15.0: 6 data-model tests and 19 checks in an isolated Obsidian vault, including native editor/File explorer menus, Reading view, Live Preview, Source mode, split panes, persistence, renaming, and reset. Mobile and third-party themes have not been tested.
