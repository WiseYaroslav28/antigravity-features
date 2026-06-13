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
      const results = [];
      const elements = Array.from(document.querySelectorAll('*'));
      
      elements.forEach(el => {
        const text = el.textContent || '';
        if (text.includes('Stitch') || text.includes('bridge') || text.includes('Установленные')) {
          results.push({
            tag: el.tagName,
            class: el.className || '',
            id: el.id || '',
            text: text.trim().slice(0, 100),
            childrenCount: el.children.length
          });
        }
      });
      
      return results;
    })()
  `;
  
  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log("Found elements count:", res.result.value ? res.result.value.length : 0);
  if (res.result.value) {
    // Выведем элементы с минимальным количеством дочерних элементов (листья)
    const leaves = res.result.value.filter(el => el.childrenCount === 0);
    console.log("Leaf elements:", JSON.stringify(leaves, null, 2));
  }
  await client.close();
}).catch(err => {
  console.error(err);
});
