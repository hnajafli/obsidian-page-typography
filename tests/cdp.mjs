// Development-only connection to an isolated Obsidian instance, never a personal vault.
import { writeFileSync } from "node:fs";

export async function connect() {
  const targets = await (await fetch("http://127.0.0.1:19347/json/list")).json();
  const target = targets.find((t) => t.title.includes(".test-vault") && t.url === "app://obsidian.md/index.html");
  if (!target) throw new Error("The isolated .test-vault window is not open on port 19347.");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (request) {
      pending.delete(message.id);
      message.error ? request.reject(message.error) : request.resolve(message.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    pending.set(key, { resolve, reject });
    ws.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const base = await evaluate("app.vault.adapter.getBasePath()");
  if (!base.replaceAll("\\", "/").endsWith("/page-typography/.test-vault")) {
    ws.close();
    throw new Error(`Refusing to test in an unexpected vault: ${base}`);
  }
  return {
    evaluate, send,
    screenshot: async (path) => {
      const result = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(path, Buffer.from(result.data, "base64"));
    },
    close: () => ws.close(),
  };
}

if (process.argv[1]?.endsWith("cdp.mjs")) {
  const session = await connect();
  try {
    const code = process.argv[2] ?? "({plugins:Object.keys(app.plugins.plugins),title:document.title})";
    console.log(JSON.stringify(await session.evaluate(code), null, 2));
  } finally { session.close(); }
}
