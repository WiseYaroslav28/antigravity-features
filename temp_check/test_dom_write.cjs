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
  
  console.log("Connecting to target:", page.title);
  const client = await CDP({ target: page.webSocketDebuggerUrl });
  const { Runtime } = client;
  await Runtime.enable();
  
  const expr = `
    (() => {
      const all = Array.from(document.querySelectorAll('*'));
      const targetEl = all.find(el => el.tagName === 'SPAN' && el.textContent.trim() === 'No conversations yet');
      if (!targetEl) return { err: "Not found SPAN with 'No conversations yet'" };
      
      const node = Array.from(targetEl.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.nodeValue.includes('No conversations yet'));
      if (!node) return { err: "Target element has no text node" };
      
      const valBefore = node.nodeValue;
      node.nodeValue = "Пока нет диалогов";
      const valAfter = node.nodeValue;
      
      return {
        valBefore,
        valAfter,
        actualDomText: targetEl.textContent.trim()
      };
    })()
  `;
  
  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log("Manual DOM Write Result:\n", JSON.stringify(res.result.value, null, 2));
  await client.close();
}).catch(err => {
  console.error("Error:", err);
});
