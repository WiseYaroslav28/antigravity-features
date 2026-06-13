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
  const { Runtime, Page } = client;
  await Runtime.enable();
  await Page.enable();
  
  const expr = `
    (async () => {
      function simulateClick(el) {
        if (!el) return false;
        el.click();
        ['mousedown', 'mouseup', 'click'].forEach(eventType => {
          const ev = new MouseEvent(eventType, { bubbles: true, cancelable: true, view: window });
          el.dispatchEvent(ev);
        });
        return true;
      }

      // Проверяем, открыты ли настройки (видна ли вкладка Приложение)
      const appTab = document.querySelector('[data-testid="settings-nav-item-App"]');
      const isSettingsOpen = appTab && appTab.offsetParent !== null;

      if (!isSettingsOpen) {
        console.log("Настройки закрыты. Открываем...");
        const settingsBtn = document.querySelector('[data-testid="settings-button"]');
        if (settingsBtn) {
          simulateClick(settingsBtn);
          // Ждем до 3 секунд появления вкладки Приложение
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 100));
            const tab = document.querySelector('[data-testid="settings-nav-item-App"]');
            if (tab && tab.offsetParent !== null) {
              console.log("Настройки открылись!");
              break;
            }
          }
        } else {
          return "settings_button_not_found";
        }
      } else {
        console.log("Настройки уже открыты.");
      }

      // Переходим на вкладку проекта antigravity-features
      const projectTab = document.querySelector('[data-testid="settings-nav-item-antigravity-features"]');
      if (projectTab) {
        console.log("Кликаем по вкладке проекта...");
        simulateClick(projectTab);
        await new Promise(r => setTimeout(r, 1500));
      } else {
        return "project_tab_not_found";
      }

      // Скроллим правую панель вниз до заголовка "Инструменты MCP"
      const headers = Array.from(document.querySelectorAll('*')).filter(el => {
        const t = el.textContent.trim();
        return (t === 'Инструменты MCP' || t === 'MCP Инструменты' || t === 'MCP Tools' || t === 'Инструменты') && !el.children.length;
      });

      let mcpHeader = headers.find(h => h.offsetParent !== null);
      if (mcpHeader) {
        console.log("Нашли видимый заголовок MCP, скроллим контейнер...");
        mcpHeader.scrollIntoView({ block: 'center', behavior: 'instant' });
        
        // Дополнительно прокручиваем скроллируемый родительский контейнер до упора вниз
        let scrollParent = mcpHeader.parentElement;
        while (scrollParent && scrollParent.scrollHeight <= scrollParent.clientHeight) {
          scrollParent = scrollParent.parentElement;
        }
        if (scrollParent) {
          scrollParent.scrollTop = scrollParent.scrollHeight;
          console.log("Прокрутили скролл-контейнер до упора: " + scrollParent.scrollTop);
        }
        await new Promise(r => setTimeout(r, 800));
      } else {
        console.log("Скроллим всю страницу вниз...");
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 800));
      }

      // Ищем кнопку "Открыть" (или "Open")
      let openBtn = null;
      if (mcpHeader) {
        let parent = mcpHeader.parentElement;
        for (let i = 0; i < 4 && parent && !openBtn; i++) {
          openBtn = Array.from(parent.querySelectorAll('button, div')).find(el => {
            const t = el.textContent.trim();
            return (t === 'Открыть' || t === 'Open') && el.offsetParent !== null;
          });
          parent = parent.parentElement;
        }
      }

      if (!openBtn) {
        openBtn = Array.from(document.querySelectorAll('button, div')).find(el => {
          const t = el.textContent.trim();
          return (t === 'Открыть' || t === 'Open') && el.offsetParent !== null;
        });
      }

      if (openBtn) {
        console.log("Кликаем кнопку Открыть...");
        simulateClick(openBtn);
        
        // Ждем появления списка серверов (проверяем появление текста "StitchMCP" или "antigravity-mcp-bridge")
        let listOpened = false;
        for (let i = 0; i < 40; i++) {
          await new Promise(r => setTimeout(r, 100));
          const hasBridge = Array.from(document.querySelectorAll('*')).some(el => {
            const t = el.textContent.trim();
            return (t === 'antigravity-mcp-bridge' || t === 'StitchMCP') && el.offsetParent !== null;
          });
          if (hasBridge) {
            listOpened = true;
            break;
          }
        }
        
        return listOpened ? "mcp_tools_opened_successfully" : "mcp_list_not_rendered";
      } else {
        return "open_button_not_found";
      }
    })()
  `;
  
  const res = await Runtime.evaluate({ expression: expr, awaitPromise: true, returnByValue: true });
  console.log("Workflow result:", res.result.value);
  
  console.log("Taking screenshot...");
  const screenshot = await Page.captureScreenshot({ format: 'png' });
  const buffer = Buffer.from(screenshot.data, 'base64');
  
  const outPath = path.join(__dirname, 'ide_screenshot.png');
  fs.writeFileSync(outPath, buffer);
  console.log("Screenshot saved to:", outPath);
  
  await client.close();
}).catch(err => {
  console.error(err);
});
