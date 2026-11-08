import { strict as assert } from "node:assert";
import { test } from "node:test";
import { deleteNotes, fontFamily, readData, renameNotes, updateNote, validFont, validSize } from "../src/model.ts";

test("loading ignores invalid entries while preserving each note's independent choices", () => {
  const data = readData({ notes: {
    "A.md": { font: " Georgia ", size: 18 },
    "B.md": { font: "Consolas", size: 24.5 },
    "Bad.md": { font: "Arial; color:red", size: Infinity },
    "Size only.md": { font: 15, size: 20 },
    "Other.canvas": { font: "Georgia", size: 20 },
    "Null.md": null,
  } });
  assert.deepEqual(data.notes["A.md"], { font: "Georgia", size: 18 });
  assert.deepEqual(data.notes["B.md"], { font: "Consolas", size: 24.5 });
  assert.deepEqual(data.notes["Size only.md"], { size: 20 });
  assert.deepEqual(Object.keys(data.notes).sort(), ["A.md", "B.md", "Size only.md"]);
  assert.equal(Object.keys(readData(null).notes).length, 0);
});

test("font and size can independently return to vault defaults", () => {
  const notes = readData(null).notes;
  updateNote(notes, "A.md", { font: "Georgia", size: 18 });
  updateNote(notes, "B.md", { size: 24 });
  updateNote(notes, "A.md", { font: undefined });
  assert.deepEqual(notes["A.md"], { size: 18 });
  assert.deepEqual(notes["B.md"], { size: 24 });
  updateNote(notes, "A.md", { size: undefined });
  assert.equal(notes["A.md"], undefined);
});

test("folder rename moves descendants but does not touch similarly named siblings", () => {
  const notes = readData({ notes: {
    "Notes/A.md": { font: "Georgia" },
    "Notes/Sub/B.md": { size: 24 },
    "Notes-extra/C.md": { size: 16 },
  } }).notes;
  assert.equal(renameNotes(notes, "Notes", "Archive/Notes"), true);
  assert.deepEqual(notes["Archive/Notes/A.md"], { font: "Georgia" });
  assert.deepEqual(notes["Archive/Notes/Sub/B.md"], { size: 24 });
  assert.deepEqual(notes["Notes-extra/C.md"], { size: 16 });
  assert.equal(notes["Notes/A.md"], undefined);
  assert.equal(renameNotes(notes, "Absent", "New"), false);
});

test("single note rename and folder deletion preserve unrelated notes", () => {
  const notes = readData({ notes: { "A.md": { size: 18 }, "A.md-copy/B.md": { size: 20 } } }).notes;
  renameNotes(notes, "A.md", "Moved/A renamed.md");
  assert.deepEqual(notes["Moved/A renamed.md"], { size: 18 });
  assert.equal(deleteNotes(notes, "Moved"), true);
  assert.equal(deleteNotes(notes, "Moved"), false);
  assert.deepEqual(notes["A.md-copy/B.md"], { size: 20 });
});

test("unsafe font names and nonfinite or out of range sizes never become CSS", () => {
  for (const font of ["", " ", 'A"; color:red', "A\nB", "Arial, serif", "var(--font)", "A\\B"]) {
    // Parentheses are valid in a family name; var(...) is harmless because it is quoted.
    if (font.startsWith("var(")) assert.equal(fontFamily(font), '"var(--font)"');
    else assert.equal(validFont(font), false, font);
  }
  assert.equal(validFont("Azərbaycan şrifti"), true);
  assert.equal(fontFamily("Times New Roman"), '"Times New Roman"');
  assert.equal(fontFamily("serif"), "serif");
  for (const size of [NaN, Infinity, -1, 0, 7.9, 96.1, "18", null]) assert.equal(validSize(size), false);
  for (const size of [8, 16, 18.5, 96]) assert.equal(validSize(size), true);
});

test("saved preferences survive JSON round trips and malformed root data is harmless", () => {
  const data = readData({ notes: { "Qeydlər/Əlifba.md": { font: "Segoe UI", size: 19.5 } } });
  assert.deepEqual(readData(JSON.parse(JSON.stringify(data))), data);
  for (const value of [null, [], 12, "text", { notes: null }]) assert.equal(Object.keys(readData(value).notes).length, 0);
});
