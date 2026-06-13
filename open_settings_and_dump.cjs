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
  
  // Скрипт для клика по шестеренке настроек и сбора DOM
  const expr = `
    (async () => {
      // 1. Ищем кнопку настроек. На скриншоте это элемент с текстом "Настройки" внизу слева.
      const elements = Array.from(document.querySelectorAll('*'));
      const settingsBtn = elements.find(el => el.textContent.trim() === 'Настройки');
      
      if (!settingsBtn) {
        return { err: "Кнопка 'Настройки' не найдена в DOM" };
      }
      
      console.log("Кликаем по кнопке настроек...");
      settingsBtn.click();
      
      // Ждем 1.5 секунды для открытия настроек
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 2. Теперь ищем раздел "Персонализация", чтобы переключиться на него, если открылся другой раздел
      const personalBtn = Array.from(document.querySelectorAll('*')).find(el => el.textContent.trim() === 'Персонализация');
      if (personalBtn) {
        console.log("Кликаем по разделу 'Персонализация'...");
        personalBtn.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 3. Ищем StitchMCP в DOM
      const results = [];
      const newElements = Array.from(document.querySelectorAll('*'));
      newElements.forEach(el => {
        const text = el.textContent.trim();
        if (text === 'StitchMCP') {
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
            text: text,
            tag: el.tagName,
            class: el.className || '',
            parentChain: parentChain.slice(0, 8)
          });
        }
      });
      
      return { results };
    })()
  `;
  
  const res = await Runtime.evaluate({ expression: expr, awaitPromise: true, returnByValue: true });
  console.log("Result:", JSON.stringify(res.result.value, null, 2));
  await client.close();
}).catch(err => {
  console.error(err);
});
