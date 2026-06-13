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

CDP.List({ port }).then(async (targets) => {
  const page = targets.find(t => t.type === 'page');
  if (!page) {
    console.log("No page targets found");
    return;
  }
  
  const client = await CDP({ target: page.webSocketDebuggerUrl });
  const { Runtime } = client;
  await Runtime.enable();
  
  const expr = `
    (() => {
      const results = [];
      
      // 1. Ищем стандартные iframe
      const iframes = Array.from(document.querySelectorAll('iframe, webview'));
      iframes.forEach((ifr, i) => {
        let accessible = false;
        let innerText = '';
        try {
          const doc = ifr.contentDocument || ifr.contentWindow.document;
          if (doc) {
            accessible = true;
            innerText = doc.body.textContent.slice(0, 300);
          }
        } catch (e) {
          innerText = 'Error accessing content: ' + e.message;
        }
        
        results.push({
          index: i,
          tag: ifr.tagName,
          src: ifr.src || ifr.getAttribute('src'),
          className: ifr.className,
          accessible,
          innerTextShort: innerText
        });
      });
      
      // 2. Ищем элементы с Shadow DOM
      const allElements = Array.from(document.querySelectorAll('*'));
      const shadowElements = [];
      allElements.forEach((el) => {
        if (el.shadowRoot) {
          shadowElements.push({
            tag: el.tagName,
            className: el.className,
            shadowChildrenCount: el.shadowRoot.querySelectorAll('*').length,
            textShort: el.shadowRoot.textContent.slice(0, 100).trim()
          });
        }
      });
      
      return JSON.stringify({ iframes, results, shadowElements }, null, 2);
    })()
  `;
  
  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  const outPath = path.join(userProfileDir, ".gemini", "antigravity", "scratch", "debug_iframes_results.json");
  fs.writeFileSync(outPath, res.result.value, 'utf8');
  console.log("Results written to:", outPath);
  await client.close();
}).catch(err => {
  console.error(err);
});
