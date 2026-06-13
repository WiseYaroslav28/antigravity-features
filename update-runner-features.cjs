const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

// Логирование в файл
const userProfile = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\wisey';
const runtimeDir = path.join(userProfile, '.gemini', 'antigravity', 'mcp-servers', 'antigravity-features');
const logPath = path.join(runtimeDir, 'update_features_log.txt');

function writeLog(msg) {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] ${msg}\n`;
  try {
    fs.appendFileSync(logPath, formatted, 'utf8');
  } catch (_) {}
  console.log(msg);
}

writeLog('=== Запуск процесса обновления antigravity-features ===');

// Считываем аргументы
const args = process.argv.slice(2);
let repoDir = 'c:\\Antigravity projects\\antigravity-features'; // путь по умолчанию к репозиторию разработки
let isLocalDev = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--repo-dir' && args[i + 1]) {
    repoDir = args[i + 1];
  }
  if (args[i] === '--local-dev') {
    isLocalDev = true;
  }
}

const updateStatePath = path.join(userProfile, '.gemini', 'antigravity', 'scratch', 'features_update_state.json');
const dbDir = path.join(userProfile, '.gemini', 'antigravity', 'data');
const dbPath = path.join(dbDir, 'antigravity.db');

function updateDbStatus(status, message) {
  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000;');
    const stmt = db.prepare(`
      UPDATE mcp_update_status
      SET status = ?, status_message = ?, status_changed_at = ?
      WHERE server_name = 'antigravity-features'
    `);
    stmt.run(status, message, Date.now());
    writeLog(`[DB Status Update] status=${status}, message=${message}`);
  } catch (err) {
    writeLog(`[DB Status Warning] Не удалось обновить БД SQLite: ${err.message}`);
  }
}

function updateState(fields) {
  try {
    let data = {};
    if (fs.existsSync(updateStatePath)) {
      data = JSON.parse(fs.readFileSync(updateStatePath, 'utf8'));
    }
    data = { ...data, ...fields };
    fs.writeFileSync(updateStatePath, JSON.stringify(data, null, 2), 'utf8');
    writeLog(`[State Update] ${JSON.stringify(fields)}`);
    
    // Синхронизируем со SQLite
    let dbStatus = 'idle';
    let dbMessage = '';
    if (fields.isUpdating === true) {
      dbStatus = 'updating';
      dbMessage = 'Обновление... ⏳';
    } else if (fields.isUpdating === false) {
      if (fields.readyToRestart === true) {
        dbStatus = 'success';
        dbMessage = 'Обновлено успешно! 🎉';
      } else {
        dbStatus = 'idle';
        dbMessage = '';
      }
    }
    
    if (fields.isUpdating !== undefined || fields.readyToRestart !== undefined) {
      updateDbStatus(dbStatus, dbMessage);
    }
  } catch (e) {
    writeLog(`[State Error] Не удалось обновить состояние: ${e.message}`);
  }
}

async function showToastViaCDP(message, isSuccess = false) {
  try {
    const portFile = path.join(userProfile, 'AppData', 'Roaming', 'Antigravity', 'DevToolsActivePort');
    if (!fs.existsSync(portFile)) return;
    const content = fs.readFileSync(portFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const port = parseInt(lines[0], 10);
    
    const res = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await res.json();
    const pages = targets.filter(t => t.type === 'page');
    const pageTarget = pages.find(p => p.url && (p.url.includes('section=') || p.url.includes('settingsOpen=') || p.url.includes('settings')))
      || pages.find(p => p.url && p.url.includes('/c/'))
      || pages[0];
    if (!pageTarget) return;
    
    return new Promise((resolve) => {
      const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
      ws.onopen = () => {
        const escapedMsg = message.replace(/'/g, "\\'");
        const bg = isSuccess ? '#1b5e20' : '#0d47a1';
        const color = isSuccess ? '#a5d6a7' : '#bbdefb';
        const border = isSuccess ? '1px solid #2e7d32' : '1px solid #1565c0';
        
        const expression = `(() => {
          let toast = document.getElementById('mcp-update-toast');
          if (!toast) {
            toast = document.createElement('div');
            toast.id = 'mcp-update-toast';
            toast.style.position = 'fixed';
            toast.style.top = '20px';
            toast.style.right = '20px';
            toast.style.zIndex = '99999';
            toast.style.padding = '12px 24px';
            toast.style.borderRadius = '8px';
            toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
            toast.style.fontSize = '14px';
            toast.style.fontWeight = '500';
            toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            toast.style.transition = 'all 0.3s ease';
            document.body.appendChild(toast);
          }
          toast.textContent = '${escapedMsg}';
          toast.style.background = '${bg}';
          toast.style.color = '${color}';
          toast.style.border = '${border}';
          toast.style.opacity = '1';
          toast.style.transform = 'translateY(0)';
          
          if (window.toastTimeout) clearTimeout(window.toastTimeout);
          window.toastTimeout = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
          }, 8000);
        })()`;
        
        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression }
        }));
        setTimeout(() => {
          ws.close();
          resolve();
        }, 500);
      };
      ws.onerror = () => resolve();
    });
  } catch (err) {
    writeLog(`[CDP Toast Error] ${err.message}`);
  }
}

async function triggerRefreshViaCDP() {
  try {
    const portFile = path.join(userProfile, 'AppData', 'Roaming', 'Antigravity', 'DevToolsActivePort');
    if (!fs.existsSync(portFile)) {
      writeLog('[CDP] Файл DevToolsActivePort не найден.');
      return;
    }
    const content = fs.readFileSync(portFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const port = parseInt(lines[0], 10);
    
    writeLog(`[CDP] Подключение к порту: ${port}`);
    const res = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await res.json();
    const pages = targets.filter(t => t.type === 'page');
    const pageTarget = pages.find(p => p.url && (p.url.includes('section=') || p.url.includes('settingsOpen=') || p.url.includes('settings')))
      || pages.find(p => p.url && p.url.includes('/c/'))
      || pages[0];
    if (!pageTarget) {
      writeLog('[CDP] Активная страница не найдена.');
      return;
    }
    
    writeLog(`[CDP] WebSocket URL: ${pageTarget.webSocketDebuggerUrl}`);
    
    return new Promise((resolve) => {
      const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
      
      ws.onopen = () => {
        writeLog('[CDP] WebSocket подключен. Отправка команды клика по Refresh...');
        const msg = {
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression: `(() => {
              function simulateClick(el) {
                if (!el) return false;
                el.click();
                ['mousedown', 'mouseup', 'click'].forEach(eventType => {
                  const ev = new MouseEvent(eventType, { bubbles: true, cancelable: true, view: window });
                  el.dispatchEvent(ev);
                });
                return true;
              }

              let clickedCount = 0;
              const mcpServers = ['antigravity-features'];
              
              mcpServers.forEach(srvName => {
                const isElementInSidebarOrHeader = (el) => {
                  let p = el.parentElement;
                  while (p) {
                    const className = p.className || '';
                    if (typeof className === 'string') {
                      if (className.includes('sidebar') || className.includes('bg-sidebar') || className.includes('header') || className.includes('titlebar')) {
                        return true;
                      }
                    }
                    p = p.parentElement;
                  }
                  return false;
                };

                const serverTitle = Array.from(document.querySelectorAll('*'))
                   .find(el => {
                     if (el.textContent.trim() !== srvName) return false;
                     if (Array.from(el.children).some(c => c.textContent.trim() === srvName)) return false;
                     return !isElementInSidebarOrHeader(el);
                   });
                
                if (serverTitle) {
                  let parent = serverTitle.parentElement;
                  for (let i = 0; i < 6 && parent; i++) {
                    const btn = Array.from(parent.querySelectorAll('button, div, span'))
                      .find(el => {
                        const txt = (el.textContent || '').trim();
                        const lowerTxt = txt.toLowerCase();
                        if (lowerTxt.includes('open ide') || lowerTxt.includes('open edi') || lowerTxt.includes('open-editor') || lowerTxt.includes('editor')) {
                          return false; // Полный запрет на клики по редакторам
                        }
                        const testId = el.getAttribute('data-testid') || '';
                        if (testId.includes('open-editor') || testId.includes('open-ide') || testId.includes('editor')) {
                          return false;
                        }
                        const isRefresh = txt.includes('Refresh') || txt.includes('Обновить') || txt.includes('Reload') || txt.includes('Перезагрузить');
                        const hasAria = el.getAttribute('aria-label')?.includes('Refresh') || el.getAttribute('aria-label')?.includes('Reload');
                        const hasClass = typeof el.className === 'string' && (el.className.includes('refresh') || el.className.includes('reload'));
                        return (isRefresh || hasAria || hasClass) && el !== serverTitle && !el.className?.includes('mcp-update-btn') && !el.className?.includes('mcp-version-badge');
                      });
                    if (btn) {
                      if (simulateClick(btn)) clickedCount++;
                      break;
                    }
                    parent = parent.parentElement;
                  }
                }
              });

              if (clickedCount > 0) {
                return 'clicked_' + clickedCount + '_servers';
              }
              
              // Если конкретная кнопка сервера не найдена, ищем по заголовку панели настроек
              const mcpHeaders = ['Installed MCP Servers', 'MCP Servers', 'MCP серверы', 'Установленные MCP серверы', 'Установленные серверы MCP', 'Customizations', 'Персонализация', 'Настройки'];
              for (const headerText of mcpHeaders) {
                const headerEl = Array.from(document.querySelectorAll('*'))
                  .find(el => el.textContent.trim().includes(headerText) && !Array.from(el.children).some(c => c.textContent.trim().includes(headerText)));
                if (headerEl) {
                  let parent = headerEl.parentElement;
                  for (let i = 0; i < 4 && parent; i++) {
                    const btn = Array.from(parent.querySelectorAll('button, div, span'))
                      .find(el => {
                        const txt = (el.textContent || '').trim();
                        const isRefresh = txt.includes('Refresh') || txt.includes('Обновить') || txt.includes('Reload') || txt.includes('Перезагрузить');
                        const hasAria = el.getAttribute('aria-label')?.includes('Refresh') || el.getAttribute('aria-label')?.includes('Reload');
                        const hasClass = typeof el.className === 'string' && (el.className.includes('refresh') || el.className.includes('reload'));
                        return (isRefresh || hasAria || hasClass) && el !== headerEl && !el.className?.includes('mcp-update-btn') && !el.className?.includes('mcp-version-badge');
                      });
                    if (btn) {
                      simulateClick(btn);
                      return 'clicked_by_header_' + headerText;
                    }
                    parent = parent.parentElement;
                  }
                }
              }

              // Глобальный поиск любой кнопки Refresh/Обновить в DOM (исключая кастомные кнопки обновлений)
              const globalBtn = Array.from(document.querySelectorAll('button, div, span'))
                .find(el => {
                  const txt = el.textContent || '';
                  const isRefreshBtn = txt.includes('Refresh') || txt.includes('Обновить');
                  const hasIconOrAction = el.getAttribute('aria-label')?.includes('Refresh') || el.className?.includes('refresh');
                  const isNotCustom = !el.className?.includes('mcp-update-btn') && !el.className?.includes('mcp-version-badge') && !el.className?.includes('antigravity-version-container');
                  return (isRefreshBtn || hasIconOrAction) && isNotCustom;
                });
              if (globalBtn) {
                simulateClick(globalBtn);
                return 'clicked_globally';
              }

              return 'not_found';
            })()`,
            returnByValue: true
          }
        };
        ws.send(JSON.stringify(msg));
      };
      
      ws.onmessage = (event) => {
        let clickResult = null;
        try {
          const resp = JSON.parse(event.data);
          if (resp.result && resp.result.result) {
            clickResult = resp.result.result.value;
            writeLog(`[CDP] Результат клика по Refresh: ${clickResult}`);
          }
        } catch (e) {
          writeLog(`[CDP] Ошибка парсинга ответа: ${e.message}`);
        }
        ws.close();
        resolve(clickResult);
      };
      
      ws.onerror = (err) => {
        writeLog(`[CDP] Ошибка WebSocket: ${err.message}`);
        resolve(null);
      };
      
      setTimeout(() => {
        writeLog('[CDP] Таймаут WebSocket.');
        try { ws.close(); } catch (_) {}
        resolve(null);
      }, 5000);
    });
  } catch (err) {
    writeLog(`[CDP ERROR] Ошибка клика по Refresh: ${err.message}`);
  }
}

let originalConfig = null;

function disableServerInConfig() {
  try {
    const configPath = path.join(userProfile, '.gemini', 'config', 'mcp_config.json');
    if (!fs.existsSync(configPath)) {
      writeLog(`[Config] Файл настроек не найден: ${configPath}`);
      return;
    }
    
    const content = fs.readFileSync(configPath, 'utf8');
    originalConfig = JSON.parse(content);
    
    const tempConfig = JSON.parse(JSON.stringify(originalConfig));
    if (tempConfig.mcpServers) {
      delete tempConfig.mcpServers['antigravity-features'];
    }
    
    fs.writeFileSync(configPath, JSON.stringify(tempConfig, null, 2), 'utf8');
    writeLog('[Config] antigravity-features временно отключен в mcp_config.json для обновления.');
    
    const now = new Date();
    fs.utimesSync(configPath, now, now);
  } catch (err) {
    writeLog(`[Config ERROR] Не удалось временно отключить сервер: ${err.message}`);
  }
}

function restoreServerInConfig() {
  try {
    const configPath = path.join(userProfile, '.gemini', 'config', 'mcp_config.json');
    if (!fs.existsSync(configPath) || !originalConfig) {
      writeLog('[Config] Не удалось восстановить конфигурацию.');
      return;
    }
    
    const nowStr = Date.now().toString();
    if (originalConfig.mcpServers && originalConfig.mcpServers['antigravity-features']) {
      const srv = originalConfig.mcpServers['antigravity-features'];
      if (!srv.env) srv.env = {};
      srv.env.RELOAD_TRIGGER = nowStr;
    }
    
    fs.writeFileSync(configPath, JSON.stringify(originalConfig, null, 2), 'utf8');
    writeLog('[Config] Конфигурация antigravity-features восстановлена.');
    
    const now = new Date();
    fs.utimesSync(configPath, now, now);
  } catch (err) {
    writeLog(`[Config ERROR] Не удалось восстановить конфигурацию: ${err.message}`);
  }
}

async function runUpdate() {
  try {
    updateDbStatus('updating', 'Подготовка к обновлению... ⏳');
    await showToastViaCDP('Запуск фонового обновления antigravity-features... ⏳', false);
    
    // Получаем PID родительского процесса
    const parentPid = process.ppid;
    writeLog(`Родительский PID для остановки: ${parentPid}`);
    
    // 1. Временно отключаем сервер
    disableServerInConfig();
    
    // Создаем файл-флаг для мягкого завершения родительского процесса
    const triggerPath = path.join(userProfile, '.gemini', 'antigravity', 'scratch', 'features_exit_trigger.tmp');
    try {
      fs.writeFileSync(triggerPath, 'exit', 'utf8');
      writeLog('[Self Update] Создан файл-флаг для мягкого завершения родителя.');
    } catch (err) {
      writeLog(`[Self Update Warning] Не удалось создать файл-флаг: ${err.message}`);
    }
    
    // Ожидаем мягкой остановки родительского процесса IDE (до 8 секунд) после изменения конфига
    writeLog('Ожидание мягкой остановки родительского процесса IDE (до 8 секунд)...');
    let parentDead = false;
    for (let i = 0; i < 16; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        process.kill(parentPid, 0);
      } catch (e) {
        parentDead = true;
        break;
      }
    }
    
    if (!parentDead) {
      writeLog(`[Warning] Родительский процесс ${parentPid} всё еще активен после 8 секунд. Принудительно завершаем через taskkill...`);
      try {
        require('child_process').execSync(`taskkill /F /PID ${parentPid}`);
        writeLog(`Родительский процесс ${parentPid} принудительно завершен.`);
      } catch (killErr) {
        writeLog(`Не удалось завершить родительский процесс ${parentPid}: ${killErr.message}`);
      }
    } else {
      writeLog(`Родительский процесс ${parentPid} успешно завершился самостоятельно (мягкий выход).`);
    }
    
    // 3. Выполняем обновление репозитория
    updateDbStatus('updating', 'Получение обновлений из Git... 📥');
    if (!isLocalDev) {
      writeLog(`Выполнение git pull в директории: ${repoDir}`);
      try {
        execSync('git pull origin master', { cwd: repoDir, stdio: 'inherit' });
        writeLog('git pull выполнен успешно.');
      } catch (gitErr) {
        writeLog(`[Git Warning] Не удалось сделать git pull: ${gitErr.message}`);
      }
    } else {
      writeLog('[LOCAL DEV MODE] git pull пропущен.');
    }
    
    // 4. Копируем файлы в рантайм-папку
    updateDbStatus('updating', 'Копирование файлов... 📂');
    writeLog('Копирование файлов в рантайм...');
    if (!fs.existsSync(runtimeDir)) {
      fs.mkdirSync(runtimeDir, { recursive: true });
    }
    
    const filesToCopy = ['index.js', 'localization_injected.js', 'version.json', 'auto_patcher.cjs', 'update-runner-features.cjs'];
    filesToCopy.forEach(file => {
      const src = path.join(repoDir, file);
      const dest = path.join(runtimeDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        writeLog(`Скопирован файл: ${file}`);
      } else {
        writeLog(`Предупреждение: файл ${file} не найден в источнике.`);
      }
    });
    
    // Считываем новую версию
    let newVersion = '1.0.0';
    try {
      const verData = JSON.parse(fs.readFileSync(path.join(runtimeDir, 'version.json'), 'utf8'));
      newVersion = verData.version || '1.0.0';
    } catch (_) {}
    
    // 5. Записываем состояние в JSON
    updateState({
      isUpdating: false,
      updateAvailable: false,
      readyToRestart: true,
      latestVersion: newVersion
    });
    
    // Дополнительно принудительно выставляем статус 'success' в SQLite
    try {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA busy_timeout = 5000;');
      const stmt = db.prepare(`
        UPDATE mcp_update_status
        SET local_version = ?, status = 'success', status_message = 'Обновлено успешно! 🎉', update_available = 0, status_changed_at = ?
        WHERE server_name = 'antigravity-features'
      `);
      stmt.run(newVersion, Date.now());
      writeLog('Статус в БД SQLite успешно обновлен на success.');
    } catch (dbErr) {
      writeLog(`Предупреждение: Не удалось обновить БД напрямую: ${dbErr.message}`);
    }
    
    // 6. Восстанавливаем сервер
    restoreServerInConfig();
    
    // 7. Делаем клик Refresh
    writeLog('Вызов принудительного клика Refresh...');
    try {
      await triggerRefreshViaCDP();
    } catch (cdpErr) {
      writeLog(`[CDP Warning] Не удалось обновить UI: ${cdpErr.message}`);
    }
    
    await showToastViaCDP('Обновление antigravity-features успешно завершено! 🎉', true);
    writeLog('=== Обновление успешно завершено! ===');
    process.exit(0);
  } catch (err) {
    writeLog(`[ERROR] Ошибка процесса обновления: ${err.stack || err.message}`);
    updateState({ isUpdating: false });
    updateDbStatus('idle', `Ошибка: ${err.message}`);
    await showToastViaCDP(`Ошибка при обновлении: ${err.message}`, false);
    restoreServerInConfig();
    process.exit(1);
  }
}

runUpdate();
