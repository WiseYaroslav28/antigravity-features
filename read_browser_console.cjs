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
  
  console.log("Reading debugging data from browser context...");
  
  // Считываем список отладочных элементов и HTML контейнера бейджа
  const expr = `
    (() => {
      const container = document.querySelector('.antigravity-features-version-container');
      return {
        badgeResult: window.__antigravity_features_badge_result,
        observerActive: !!window.__antigravity_features_ui_observer,
        containerHTML: container ? container.outerHTML : "нет контейнера",
        containerParentHTML: container && container.parentNode ? {
          tag: container.parentNode.tagName,
          class: container.parentNode.className,
          outerHTMLShort: container.parentNode.outerHTML.slice(0, 400)
        } : "нет родителя",
        debugElements: window.__antigravity_features_debug_elements || []
      };
    })()
  `;
  
  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log("Detailed Page State:", JSON.stringify(res.result.value, null, 2));
  await client.close();
}).catch(err => {
  console.error("Error:", err);
});
