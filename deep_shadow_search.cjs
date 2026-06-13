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
  
  // Рекурсивный поиск в DOM и во всех Shadow DOM любой вложенности
  const expr = `
    (() => {
      const results = [];
      
      function search(node, shadowPath = []) {
        if (!node) return;
        
        // Проверяем текстовое содержимое самого узла
        const text = node.textContent ? node.textContent.trim() : '';
        if (node.tagName && (text === 'StitchMCP' || text === 'antigravity-mcp-bridge' || text === 'antigravity-features' || text.includes('Установленные серверы'))) {
          // Строим цепочку родителей
          const parentChain = [];
          let parent = node.parentElement;
          while (parent) {
            parentChain.push({
              tag: parent.tagName,
              class: parent.className || '',
              id: parent.id || ''
            });
            parent = parent.parentElement;
          }
          
          results.push({
            text: text.slice(0, 100),
            tag: node.tagName,
            class: node.className || '',
            shadowPath: shadowPath.join(' -> '),
            parentChain: parentChain.slice(0, 5)
          });
        }
        
        // Обходим дочерние элементы
        if (node.children) {
          Array.from(node.children).forEach(child => search(child, shadowPath));
        }
        
        // Обходим Shadow DOM
        if (node.shadowRoot) {
          const shadowName = node.tagName + (node.className ? '.' + node.className.replace(/\\s+/g, '.') : '');
          search(node.shadowRoot, [...shadowPath, shadowName]);
        }
      }
      
      search(document.body);
      return results;
    })()
  `;
  
  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log("Deep search results:", JSON.stringify(res.result.value, null, 2));
  await client.close();
}).catch(err => {
  console.error(err);
});
