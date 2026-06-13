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
        const pEl = all.find(el => el.tagName === 'P' && el.textContent.includes('Ask anything'));
        if (!pEl) return { err: "Not found P with 'Ask anything'" };
        
        const node = pEl.childNodes[0];
        if (!node) return { err: "P element has no child nodes" };
        const text = node.nodeValue;
        const parent = node.parentElement;
        
        // Отладочная версия isFileName
        function debugIsFileName(text, parent) {
            const steps = [];
            if (!text) return { res: false, steps: ["no text"] };
            const trimmed = text.trim();
            
            steps.push("trimmed: " + trimmed);
            if (/\.[a-zA-Z0-9]{1,5}$/.test(trimmed)) {
                return { res: true, steps: [...steps, "ends with extension"] };
            }
            
            const hasPathChar = trimmed.startsWith('/') || trimmed.startsWith('\\') || /^[a-zA-Z]:\\/.test(trimmed) || trimmed.startsWith('file://');
            steps.push("hasPathChar: " + hasPathChar);
            
            if ((trimmed.includes('/') || trimmed.includes('\\')) && !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(trimmed)) {
                steps.push("contains slash and is not a date");
                if (trimmed.includes(' ') && !hasPathChar) {
                    return { res: false, steps: [...steps, "contains space and doesn't start with path char -> not file"] };
                }
                return { res: true, steps: [...steps, "contains slash and is file path"] };
            }
            
            let current = parent;
            while (current) {
                if (current.nodeType === Node.ELEMENT_NODE) {
                    const className = current.className || '';
                    if (typeof className === 'string') {
                        const lowerClass = className.toLowerCase();
                        steps.push("checking parent class: " + lowerClass);
                        if (
                            lowerClass.includes('file-name') ||
                            lowerClass.includes('filename') ||
                            lowerClass.includes('filepath') ||
                            lowerClass.includes('file-path') ||
                            lowerClass.includes('artifact-name') ||
                            lowerClass.includes('artifact-title') ||
                            lowerClass.includes('artifact-filename') ||
                            lowerClass.includes('artifact-header') ||
                            lowerClass.includes('file-info')
                        ) {
                            return { res: true, steps: [...steps, "parent class match: " + lowerClass] };
                        }
                    }
                }
                current = current.parentElement;
            }
            return { res: false, steps: [...steps, "reached root"] };
        }
        
        // Отладочная версия shouldIgnore
        function debugShouldIgnore(node) {
            const steps = [];
            let parent = node.parentElement;
            while (parent) {
                const className = parent.className || '';
                steps.push("Checking parent: tag=" + parent.tagName + ", class=" + className);
                
                if (typeof className === 'string' && className.toLowerCase().includes('placeholder')) {
                    return { res: false, steps: [...steps, "class contains placeholder"] };
                }
                
                const tagName = parent.tagName;
                if (tagName === 'PRE' || tagName === 'CODE' || tagName === 'TEXTAREA' || tagName === 'INPUT' || tagName === 'SCRIPT' || tagName === 'STYLE' || parent.contentEditable === 'true') {
                    return { res: true, steps: [...steps, "ignored tag/contentEditable: " + tagName] };
                }
                
                if (tagName === 'BUTTON' || parent.getAttribute('role') === 'button') {
                    return { res: false, steps: [...steps, "allowed button tag"] };
                }
                if (tagName === 'A' && !parent.closest('pre, code')) {
                    return { res: false, steps: [...steps, "allowed A tag"] };
                }
                
                if (typeof className === 'string') {
                    const lowerClass = className.toLowerCase();
                    if (
                        lowerClass.includes('settings') || 
                        lowerClass.includes('modal') || 
                        lowerClass.includes('dialog') || 
                        lowerClass.includes('popup') || 
                        lowerClass.includes('dropdown') || 
                        lowerClass.includes('select') ||
                        lowerClass.includes('confirm') ||
                        lowerClass.includes('action') ||
                        lowerClass.includes('prompt') ||
                        lowerClass.includes('permission') ||
                        lowerClass.includes('card') ||
                        lowerClass.includes('drawer') ||
                        lowerClass.includes('panel') ||
                        lowerClass.includes('overlay') ||
                        lowerClass.includes('danger') ||
                        lowerClass.includes('zone') ||
                        lowerClass.includes('project') ||
                        lowerClass.includes('config') ||
                        lowerClass.includes('btn') ||
                        lowerClass.includes('button') ||
                        lowerClass.includes('customization') ||
                        lowerClass.includes('budget') ||
                        lowerClass.includes('tooltip') ||
                        lowerClass.includes('popover') ||
                        lowerClass.includes('switch') ||
                        lowerClass.includes('toggle') ||
                        lowerClass.includes('tab') ||
                        lowerClass.includes('tabs') ||
                        lowerClass.includes('menu') ||
                        lowerClass.includes('item') ||
                        lowerClass.includes('list') ||
                        lowerClass.includes('control') ||
                        lowerClass.includes('controls') ||
                        lowerClass.includes('header') ||
                        lowerClass.includes('footer') ||
                        lowerClass.includes('title') ||
                        lowerClass.includes('alert') ||
                        lowerClass.includes('banner') ||
                        lowerClass.includes('badge') ||
                        lowerClass.includes('info') ||
                        lowerClass.includes('helper') ||
                        lowerClass.includes('hint') ||
                        lowerClass.includes('step') ||
                        lowerClass.includes('result') ||
                        lowerClass.includes('results') ||
                        lowerClass.includes('artifact') ||
                        lowerClass.includes('artifacts') ||
                        lowerClass.includes('changed') ||
                        lowerClass.includes('change') ||
                        lowerClass.includes('background') ||
                        lowerClass.includes('task') ||
                        lowerClass.includes('tasks') ||
                        lowerClass.includes('media')
                    ) {
                        return { res: false, steps: [...steps, "allowed class: " + lowerClass] };
                    }
                    if (
                        lowerClass.includes('monaco-editor') || 
                        lowerClass.includes('view-lines') || 
                        lowerClass.includes('message-content') || 
                        lowerClass.includes('message-text') ||
                        lowerClass.includes('chat-output') ||
                        lowerClass.includes('markdown-body')
                    ) {
                        return { res: true, steps: [...steps, "ignored class: " + lowerClass] };
                    }
                }
                parent = parent.parentElement;
            }
            return { res: false, steps: [...steps, "reached root"] };
        }
        
        const fileRes = debugIsFileName(text, parent);
        const ignoreRes = debugShouldIgnore(node);
        
        return {
          text,
          fileRes,
          ignoreRes
        };
      } catch (err) {
        return { err: err.message, stack: err.stack };
      }
    })()
  `;
  
  const res = await Runtime.evaluate({ expression: expr, returnByValue: true });
  console.log("Debug Step-by-Step Results:\n", JSON.stringify(res, null, 2));
  await client.close();
}).catch(err => {
  console.error("Error:", err);
});
