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
      const pEl = all.find(el => el.tagName === 'P' && el.textContent.includes('Ask anything'));
      if (!pEl) return { err: "Not found P with 'Ask anything'" };
      
      const chain = [];
      let current = pEl;
      while (current) {
        chain.push({
          tag: current.tagName,
          class: current.className || '',
          id: current.id || '',
          contentEditable: current.contentEditable
        });
        current = current.parentElement;
      }
      return { chain };
    })()
  `;
  
  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log("Parent Chain for Ask anything:\n", JSON.stringify(res.result.value, null, 2));
  await client.close();
}).catch(err => {
  console.error("Error:", err);
});
