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
  
  const expr = String.raw`
    (() => {
      try {
        const all = Array.from(document.querySelectorAll('*'));
        const targetEl = all.find(el => el.tagName === 'SPAN' && el.textContent.trim() === 'No conversations yet');
        if (!targetEl) return { err: "Not found SPAN with 'No conversations yet'" };
        
        const node = Array.from(targetEl.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.nodeValue.includes('No conversations yet'));
        if (!node) return { err: "Target element has no text node" };
        
        const steps = [];
        const text = node.nodeValue;
        steps.push("1. original text: '" + text + "'");
        
        const normalized = text.replace(/[\s\u00a0\xa0\u2007\u202f\r\n\t]+/g, ' ').trim();
        steps.push("2. normalized: '" + normalized + "'");
        
        const lowerText = normalized.toLowerCase();
        steps.push("3. lowerText: '" + lowerText + "'");
        
        const translationDictionary = {
          "no conversations yet": "Пока нет диалогов"
        };
        
        let translated = translationDictionary[lowerText] || null;
        steps.push("4. translated: '" + translated + "'");
        
        const ignored = typeof shouldIgnore !== 'undefined' ? shouldIgnore(node) : false;
        steps.push("5. ignored: " + ignored);
        
        const parent = node.parentElement;
        steps.push("6. parent tag: " + (parent ? parent.tagName : "null"));
        
        if (parent) {
          const normNodeVal = node.nodeValue.replace(/[\s\u00a0\xa0\u2007\u202f\r\n\t]+/g, ' ').trim();
          steps.push("7. normNodeVal: '" + normNodeVal + "'");
          steps.push("8. equals translated: " + (normNodeVal === translated));
        }
        
        const match = node.nodeValue.match(/^(\s*)(.*?)(\s*)$/);
        steps.push("9. match spaces: " + JSON.stringify(match));
        
        if (match) {
          const leadingSpaces = match[1];
          const trailingSpaces = match[3];
          const newValue = leadingSpaces + translated + trailingSpaces;
          steps.push("10. new value: '" + newValue + "'");
        }
        
        return { steps };
      } catch (err) {
        return { err: err.message, stack: err.stack };
      }
    })()
  `;
  
  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log("Translation Step-by-Step:\n", JSON.stringify(res.result.value, null, 2));
  await client.close();
}).catch(err => {
  console.error("Error:", err);
});
