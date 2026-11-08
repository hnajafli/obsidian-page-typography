// Run against the isolated .test-vault at port 19347. Never runs as part of `pnpm test`.
import { strict as assert } from "node:assert";
import { mkdirSync } from "node:fs";
import { connect } from "./cdp.mjs";

const client = await connect();
const evaluate = client.evaluate;
const pause = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (condition, description) => { assert.ok(condition, description); console.log(`PASS ${description}`); };
mkdirSync("dist/qa", { recursive: true });
try {
  await evaluate(`(async () => {
    window.qa = { p: app.plugins.plugins['page-typography'] };
    if (!qa.p) throw new Error('Plugin is not enabled in the isolated vault');
    qa.a = app.vault.getAbstractFileByPath('Typography test.md');
    qa.b = app.vault.getAbstractFileByPath('Unchanged note.md');
    for(const path of ['Moved fixture','Rename fixture']) {
      const folder=app.vault.getAbstractFileByPath(path);
      if(folder && folder.children?.length===0) await app.vault.trash(folder,false);
    }
    app.workspace.getLeavesOfType('markdown').slice(1).forEach(leaf=>leaf.detach());
    qa.left = app.workspace.getLeavesOfType('markdown')[0] ?? app.workspace.getLeaf(false);
    app.workspace.setActiveLeaf(qa.left,{focus:true});
    await qa.left.openFile(qa.a);
    await qa.left.setViewState({type:'markdown',state:{file:qa.a.path,mode:'source'}});
    qa.right = app.workspace.getLeaf('split');
    await qa.right.openFile(qa.b);
    await qa.right.setViewState({type:'markdown',state:{file:qa.b.path,mode:'source'}});
    await Promise.all([qa.p.change(qa.a,{font:'Georgia',size:24}), qa.p.change(qa.b,{font:'Consolas',size:18})]);
  })()`);
  await pause();
  const panes = await evaluate(`[qa.left,qa.right].map(l => {
    const e=l.view.contentEl.querySelector('.cm-scroller'); const s=getComputedStyle(e);
    return {font:s.fontFamily,size:s.fontSize};
  })`);
  check(panes[0].font.includes("Georgia") && panes[0].size === "24px" &&
    panes[1].font.includes("Consolas") && panes[1].size === "18px", "Split panes keep independent fonts and sizes in the editor");

  await evaluate(`(async()=>{
    await qa.right.openFile(qa.a);
    await qa.right.setViewState({type:'markdown',state:{file:qa.a.path,mode:'preview'}});
  })()`);
  await pause(400);
  const reader = await evaluate(`(()=>{
    const root=qa.right.view.contentEl;
    return {font:getComputedStyle(root.querySelector('.markdown-preview-view p')).fontFamily,
      size:getComputedStyle(root.querySelector('.markdown-preview-view p')).fontSize,
      heading:getComputedStyle(root.querySelector('h2')).fontSize,
      code:getComputedStyle(root.querySelector('code')).fontFamily};
  })()`);
  check(reader.font.includes("Georgia") && reader.size === "24px", "The same note uses its preferences in Reading view");
  check(parseFloat(reader.heading) > 24 && !reader.code.includes("Georgia"), "Headings keep their hierarchy and code keeps its code font");

  await evaluate(`(()=>{
    const el=qa.right.view.contentEl.querySelector('.markdown-preview-view p');
    el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,clientX:620,clientY:300}));
  })()`);
  await pause();
  const menu = await evaluate(`Array.from(document.querySelectorAll('.menu .menu-item-title')).map(e=>e.textContent)`);
  check(menu.some(s=>s.startsWith("Page font:")) && menu.some(s=>s.startsWith("Page font size:")) &&
    menu.filter(s=>s.startsWith("Page font:")).length === 1, "Reading-view right-click opens the English typography menu once");
  await client.screenshot("dist/qa/reading-context-menu.png");
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });

  // Exercise the actual editor context event, rather than only the command palette.
  const editorPoint = await evaluate(`(()=>{
    app.workspace.setActiveLeaf(qa.left,{focus:true});
    const r=qa.left.view.contentEl.querySelector('.cm-content').getBoundingClientRect();
    return {x:r.left+30,y:Math.max(r.top,100)+25};
  })()`);
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "right", clickCount: 1, ...editorPoint });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "right", clickCount: 1, ...editorPoint });
  await pause();
  check(await evaluate(`Array.from(document.querySelectorAll('.menu-item-title')).some(e=>e.textContent.startsWith('Page font:'))`), "Native editor right-click includes the typography commands");
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });

  const filePoint = await evaluate(`(()=>{
    const r=document.querySelector('.nav-file-title[data-path="Unchanged note.md"]').getBoundingClientRect();
    return {x:r.left+60,y:r.top+r.height/2};
  })()`);
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "right", clickCount: 1, ...filePoint });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "right", clickCount: 1, ...filePoint });
  await pause();
  check(await evaluate(`Array.from(document.querySelectorAll('.menu-item-title')).some(e=>e.textContent.startsWith('Page font: Consolas'))`), "File explorer right-click targets the clicked note, even when another note is active");
  await evaluate(`Array.from(document.querySelectorAll('.menu-item-title')).find(e=>e.textContent.startsWith('Page font: Consolas')).closest('.menu-item').click()`);
  await pause();
  check(await evaluate(`document.querySelector('.pft-font-help')?.textContent.includes('Unchanged note')`), "The context menu opens a font picker for the intended note");
  await client.screenshot("dist/qa/font-picker.png");
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });

  await evaluate(`(async()=>{
    await qa.left.setViewState({type:'markdown',state:{file:qa.a.path,mode:'source',source:true}});
  })()`);
  await pause();
  check(await evaluate(`qa.left.view.getState().source === true && getComputedStyle(qa.left.view.contentEl.querySelector('.cm-scroller')).fontSize==='24px'`), "Source mode also respects the note size");

  await evaluate(`(()=>{
    app.workspace.setActiveLeaf(qa.left,{focus:true});
    app.commands.executeCommandById('page-typography:set-page-font');
  })()`);
  await pause();
  check(await evaluate(`!!document.querySelector('.pft-font-picker .prompt-input')`), "The font command opens the searchable font picker");
  await evaluate(`(()=>{
    const input=document.querySelector('.pft-font-picker .prompt-input');
    input.value='Verdana'; input.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await pause();
  check(await evaluate(`document.querySelector('.pft-font-picker .suggestion-item')?.textContent === 'Verdana'`), "Typing an exact font selects that font rather than the default");
  await evaluate(`document.querySelector('.pft-font-picker .suggestion-item').click()`);
  await pause();
  check(await evaluate(`qa.p.data.notes[qa.a.path].font === 'Verdana'`), "Choosing a font saves the note preference");

  await evaluate(`app.commands.executeCommandById('page-typography:set-page-font-size')`);
  await pause();
  await evaluate(`(()=>{
    const input=document.querySelector('.pft-size-picker input');
    input.value='120'; input.dispatchEvent(new Event('input',{bubbles:true}));
    Array.from(document.querySelectorAll('.pft-size-picker button')).find(e=>e.textContent==='Apply').click();
  })()`);
  await pause();
  check(await evaluate(`!!document.querySelector('.pft-size-picker input[aria-invalid="true"]') && qa.p.data.notes[qa.a.path].size===24`), "Invalid sizes stay in the dialog and do not overwrite the saved size");
  await evaluate(`(()=>{
    const input=document.querySelector('.pft-size-picker input');
    input.value='23.5'; input.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  check(await evaluate(`getComputedStyle(document.querySelector('.pft-preview')).fontSize==='23.5px'`), "The font size dialog previews custom fractional sizes");
  await client.screenshot("dist/qa/font-size-dialog.png");
  await evaluate(`Array.from(document.querySelectorAll('.pft-size-picker button')).find(e=>e.textContent==='Apply').click()`);
  await pause();
  check(await evaluate(`qa.p.data.notes[qa.a.path].size===23.5 && !document.querySelector('.pft-size-picker')`), "Apply saves the size and closes the dialog");

  await evaluate(`(async()=>{
    await app.vault.createFolder('Rename fixture');
    await app.fileManager.renameFile(qa.a,'Rename fixture/Renamed note.md');
    await app.fileManager.renameFile(app.vault.getAbstractFileByPath('Rename fixture'),'Moved fixture');
  })()`);
  await pause();
  check(await evaluate(`qa.p.data.notes['Moved fixture/Renamed note.md']?.font==='Verdana' && !qa.p.data.notes['Typography test.md']`), "Renaming a note and its parent folder preserves the choices");
  await evaluate(`(async()=>{
    await app.fileManager.renameFile(qa.a,'Typography test.md');
    await app.vault.trash(app.vault.getAbstractFileByPath('Moved fixture'),false);
    await qa.p.change(qa.a,{font:undefined});
  })()`);
  check(await evaluate(`qa.p.data.notes[qa.a.path].font===undefined && qa.p.data.notes[qa.a.path].size===23.5`), "Returning the font to default preserves the custom size");
  await evaluate(`(async()=>{
    await qa.p.change(qa.a,{font:'Georgia',size:24});
    await app.plugins.unloadPlugin('page-typography');
  })()`);
  check(await evaluate(`document.querySelectorAll('.pft-font,.pft-size').length===0`), "Disabling removes all view overrides");
  await evaluate(`(async()=>{
    await app.plugins.loadPlugin('page-typography');
    qa.p=app.plugins.plugins['page-typography'];
  })()`);
  await pause();
  check(await evaluate(`qa.p.data.notes[qa.a.path].font==='Georgia' && qa.left.view.contentEl.classList.contains('pft-font')`), "Reloading the plugin restores preferences from disk");

  await evaluate(`(async()=>{
    await qa.p.reset(qa.a);
    await qa.left.openFile(qa.b);
    await qa.p.reset(qa.b);
  })()`);
  await pause();
  check(await evaluate(`!qa.p.data.notes[qa.a.path] && !qa.p.data.notes[qa.b.path] && document.querySelectorAll('.pft-font,.pft-size').length===0`), "Reset clears saved overrides and reused panes do not leak typography");
  console.log("All Obsidian integration checks passed.");
} finally {
  client.close();
}
