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
      const results = [];
      const elements = Array.from(document.querySelectorAll('*'));
      
      elements.forEach(el => {
        // НЕ пропускаем элементы с детьми, ищем все совпадения
        const text = el.textContent || '';
        const cleanText = text.trim();
        
        // Нам интересны StitchMCP или antigravity-mcp-bridge
        if (cleanText === 'StitchMCP' || cleanText === 'antigravity-mcp-bridge' || cleanText === 'antigravity-features') {
          const parentChain = [];
          let parent = el.parentElement;
          while (parent) {
            parentChain.push({
              tag: parent.tagName,
              class: parent.className || '',
              id: parent.id || ''
            });
            parent = parent.parentElement;
          }
          
          results.push({
            text: cleanText,
            tag: el.tagName,
            class: el.className || '',
            parentChain: parentChain
          });
        }
      });
      
      return results;
    })()
  `;
  
  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  const data = res.result.value || [];
  
  fs.writeFileSync('mcp_dom_structure.json', JSON.stringify(data, null, 2), 'utf8');
  console.log(`Saved ${data.length} elements to mcp_dom_structure.json`);
  
  // Выведем все найденные элементы
  data.forEach((item, idx) => {
    console.log(`\n[Element ${idx + 1}] Text: "${item.text}" Tag: ${item.tag} Class: "${item.class}"`);
    console.log("Parents:");
    item.parentChain.slice(0, 5).forEach((p, pIdx) => {
      console.log(`  Level ${pIdx + 1}: ${p.tag} class="${p.class}" id="${p.id}"`);
    });
  });
  
  await client.close();
}).catch(err => {
  console.error("Error:", err);
});
