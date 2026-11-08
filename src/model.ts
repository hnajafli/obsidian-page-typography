export const MIN_SIZE = 8;
export const MAX_SIZE = 96;

export interface NoteTypography {
  font?: string;
  size?: number;
}

export interface PluginData {
  version: 1;
  notes: Record<string, NoteTypography>;
}

export function validFont(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 &&
    value.length <= 100 && !/[\x00-\x1f\x7f"'\\,;:{}<>]/.test(value);
}

export function validSize(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= MIN_SIZE && value <= MAX_SIZE;
}

export function fontFamily(font: string): string {
  return ["serif", "sans-serif", "monospace", "system-ui"].includes(font)
    ? font : `"${font}"`;
}

export function readData(raw: unknown): PluginData {
  const result: PluginData = { version: 1, notes: Object.create(null) };
  if (!raw || typeof raw !== "object" || !("notes" in raw) ||
    !raw.notes || typeof raw.notes !== "object") return result;
  for (const [path, value] of Object.entries(raw.notes)) {
    if (!path.endsWith(".md") || !value || typeof value !== "object") continue;
    const source = value as Record<string, unknown>;
    const entry: NoteTypography = {};
    if (validFont(source.font)) entry.font = source.font.trim();
    if (validSize(source.size)) entry.size = source.size;
    if (Object.keys(entry).length) result.notes[path] = entry;
  }
  return result;
}

export function updateNote(
  notes: Record<string, NoteTypography>, path: string, patch: Partial<NoteTypography>,
): void {
  const next = { ...notes[path], ...patch };
  if (next.font === undefined) delete next.font;
  if (next.size === undefined) delete next.size;
  if (Object.keys(next).length) notes[path] = next;
  else delete notes[path];
}

export function renameNotes(
  notes: Record<string, NoteTypography>, oldPath: string, newPath: string,
): boolean {
  if (oldPath === newPath) return false;
  const moved = Object.entries(notes).filter(([path]) =>
    path === oldPath || path.startsWith(oldPath + "/"));
  for (const [path] of moved) delete notes[path];
  for (const [path, value] of moved) {
    notes[newPath + path.slice(oldPath.length)] = value;
  }
  return moved.length > 0;
}

export function deleteNotes(notes: Record<string, NoteTypography>, deletedPath: string): boolean {
  let changed = false;
  for (const path of Object.keys(notes)) {
    if (path === deletedPath || path.startsWith(deletedPath + "/")) {
      delete notes[path];
      changed = true;
    }
  }
  return changed;
}
