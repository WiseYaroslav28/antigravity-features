const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const userProfileDir = process.env.USERPROFILE || "C:\\Users\\wisey";
const portFile = path.join(userProfileDir, "AppData", "Roaming", "Antigravity", "DevToolsActivePort");

if (!fs.existsSync(portFile)) {
  console.log("DevToolsActivePort not found");
  process.exit(1);
}

const port = parseInt(fs.readFileSync(portFile, 'utf8').split('\n')[0].trim(), 10);
console.log("DevTools Port:", port);

CDP.List({ port }).then(async (targets) => {
  const page = targets.find(t => t.type === 'page');
  if (!page) {
    console.log("No page targets found");
    return;
  }
  
  console.log("Connecting to target:", page.title);
  const client = await CDP({ target: page.webSocketDebuggerUrl });
  const { Runtime } = client;
  await Runtime.enable();
  
  const expr = `
    (() => {
      return {
        initialized: window.__antigravity_translation_initialized || false,
        observerActive: !!window.__antigravity_features_ui_observer,
        badgeResult: window.__antigravity_features_badge_result || "не вызывался",
        debugElementsCount: window.__antigravity_features_debug_elements ? window.__antigravity_features_debug_elements.length : 0,
        scriptError: window.__antigravity_features_debug_elements_error || "нет ошибок",
        translationError: window.__antigravity_translation_error || "нет ошибок локализации"
      };
    })()
  `;
  
  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log("Evaluation result:", JSON.stringify(res.result.value, null, 2));
  await client.close();
}).catch(err => {
  console.error("Error:", err);
});
