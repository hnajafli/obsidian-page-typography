import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { zipSync, strToU8 } from "fflate";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const files = {};
for (const name of ["main.js", "manifest.json", "styles.css", "README.md", "LICENSE"]) {
  files[`${manifest.id}/${name}`] = new Uint8Array(readFileSync(name));
}
files[`${manifest.id}/INSTALL.txt`] = strToU8(
  "Extract the page-typography folder into YOUR VAULT/.obsidian/plugins/.\n" +
  "Restart Obsidian, then enable Page Typography in Settings > Community plugins.\n" +
  "Right-click a note: Page font... / Page font size... / Reset page typography.\n" +
  "See README.md for Azerbaijani instructions and usage details.\n",
);
mkdirSync("dist", { recursive: true });
const output = `dist/${manifest.id}-${manifest.version}.zip`;
writeFileSync(output, zipSync(files, { level: 9 }));
console.log(`Created ${output}`);
