# Page Typography

Set a separate font and text size for each Markdown note in Obsidian. All menu items and dialogs are in English.

## Quraşdırma

1. `page-typography-1.0.0.zip` arxivini açın.
2. İçindəki `page-typography` qovluğunu vault-unuzun `.obsidian/plugins/` qovluğuna köçürün. `plugins` qovluğu yoxdursa, yaradın.
3. Obsidian-ı yenidən başladın.
4. **Settings → Community plugins** bölməsində **Page Typography** plugin-ini aktiv edin. Restricted mode aktivdirsə, əvvəlcə community plugin-lərə icazə verin.

Qovluq quruluşu belə olmalıdır:

```text
Your vault/
  .obsidian/
    plugins/
      page-typography/
        main.js
        manifest.json
        styles.css
```

## İstifadə

Səhifənin mətnində, tab başlığında və ya soldakı fayl siyahısında həmin səhifənin adında sağ klik edin:

- **Page font…** — siyahıdan font seçin və ya quraşdırılmış fontun adını yazın. Siyahıdakı font adları nümunə olaraq öz fontları ilə göstərilir.
- **Page font size…** — hazır ölçülərdən birini seçin və ya 8–96 px aralığında ölçü yazın; önizləmədən sonra **Apply** düyməsini basın.
- **Reset page typography** — həmin səhifənin fontunu və ölçüsünü vault-un ümumi ayarlarına qaytarın.

Hər iki seçim pəncərəsində **Use vault default** yalnız həmin seçimi sıfırlayır: məsələn, fontu sıfırlayıb xüsusi ölçünü saxlaya bilərsiniz. Eyni əmrlər command palette-də də mövcuddur.

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
