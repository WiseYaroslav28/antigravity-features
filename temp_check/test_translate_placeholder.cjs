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
      
      const node = pEl.childNodes[0]; // текстовый узел
      
      // Вызываем shouldIgnore и translateText
      const ignoreResult = typeof shouldIgnore !== 'undefined' ? shouldIgnore(node) : 'shouldIgnore undefined';
      const originalText = node.nodeValue;
      const translated = typeof translateText !== 'undefined' ? translateText(originalText) : 'translateText undefined';
      
      return {
        originalText,
        normalized: originalText.replace(/[\\s\\u00a0\\xa0\\u2007\\u202f\\r\\n\\t]+/g, ' ').trim().toLowerCase(),
        ignoreResult,
        translated,
        successVar: window.__antigravity_translation_success,
        errorVar: window.__antigravity_translation_error
      };
    })()
  `;
  
  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log("Translation Debug Results:\n", JSON.stringify(res.result.value, null, 2));
  await client.close();
}).catch(err => {
  console.error("Error:", err);
});
