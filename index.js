import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import CDP from 'chrome-remote-interface';
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Логирование для отладки
const userProfileDir = process.env.USERPROFILE || "C:\\Users\\wisey";
const LOG_FILE = path.join(userProfileDir, ".gemini", "antigravity", "scratch", "features_mcp.log");

const APPDATA_DIR = path.join(userProfileDir, "AppData", "Roaming", "Antigravity");
const APPDATA_IDE_DIR = path.join(userProfileDir, "AppData", "Roaming", "Antigravity IDE");
const CONFIG_DIR = path.join(userProfileDir, ".gemini", "config");
const PROJECTS_DIR = path.join(CONFIG_DIR, "projects");
const BACKUP_DIR = path.join(__dirname, "backups");

// Создаем папку для бэкапов
if (!fsSync.existsSync(BACKUP_DIR)) {
  fsSync.mkdirSync(BACKUP_DIR, { recursive: true });
}

function logDebug(message) {
  try {
    fsSync.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
  } catch (e) {}
}

logDebug("Запуск MCP-сервера расширений AntiGravity (antigravity-features)...");

// Автоматическая проверка и восстановление патча app.asar
try {
  logDebug("Проверка целостности патча локализации...");
  const patchResult = require('child_process').spawnSync('node', [path.join(__dirname, 'auto_patcher.cjs')]);
  if (patchResult.status === 1) {
    logDebug("app.asar был успешно пропатчен. Инициируем перезапуск...");
    const scratchRestartPath = require('path').join(require('os').homedir(), '.gemini', 'antigravity', 'scratch', 'restart_app.cmd');
    require('child_process').exec(`wmic process call create "cmd.exe /c ${scratchRestartPath}"`, { cwd: __dirname });
    // Даем время на выполнение команды до завершения процесса
    setTimeout(() => process.exit(0), 1000);
  } else if (patchResult.status === 2) {
    logDebug("Ошибка автопатчера: " + patchResult.stderr.toString());
  } else {
    logDebug("Патч локализации присутствует, продолжаем запуск.");
  }
} catch (err) {
  logDebug("Ошибка при вызове автопатчера: " + err.message);
}

// Инициализация простого MCP-сервера
const server = new McpServer({
  name: "antigravity-features",
  version: "1.0.0"
});

// Добавляем инструменты MCP
server.tool(
  "ping",
  "Проверка связи с сервером расширений",
  async () => {
    return {
      content: [{ type: "text", text: "pong" }]
    };
  }
);

server.tool(
  "check_translation_update",
  "Проверить наличие обновлений словарей локализации на GitHub",
  async () => {
    try {
      let localVersion = "1.0.0";
      const versionPath = path.join(__dirname, "version.json");
      if (require('fs').existsSync(versionPath)) {
          const vData = JSON.parse(require('fs').readFileSync(versionPath, 'utf8'));
          localVersion = vData.version || "1.0.0";
      }

      await execPromise("git fetch origin");
      const { stdout } = await execPromise("git status -uno");
      let remoteVersion = localVersion;
      
      if (stdout.includes("Your branch is behind")) {
          // If we are behind, we assume remote version is newer, e.g. "Новая версия доступна"
          remoteVersion = "Новая версия доступна";
          return { 
            content: [{ 
              type: "text", 
              text: `Текущая локальная версия перевода: ${localVersion}\nПоследняя версия на GitHub: ${remoteVersion}\n\nРекомендуется запустить инструмент install_translation_update для обновления.` 
            }] 
          };
      } else {
          return { 
            content: [{ 
              type: "text", 
              text: `Текущая локальная версия перевода: ${localVersion}\nПоследняя версия на GitHub: ${localVersion}\n\nУ вас установлена самая актуальная версия перевода.` 
            }] 
          };
      }
    } catch (e) {
      return { content: [{ type: "text", text: `Ошибка проверки обновлений: ${e.message}. Возможно, не настроен remote origin.` }] };
    }
  }
);

server.tool(
  "install_translation_update",
  "Скачать и применить новые словари локализации с GitHub",
  async () => {
    try {
      await execPromise("git pull origin main");
      return { content: [{ type: "text", text: "Обновление успешно скачано! Новые словари будут применяться автоматически в новых окнах." }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Ошибка установки обновления: ${e.message}` }] };
    }
  }
);

server.tool(
  "force_repatch_antigravity",
  "Принудительно запустить процесс пересборки ядра Antigravity (внедрение перевода и фиксов окон) и перезапустить IDE.",
  async () => {
    try {
      require('child_process').spawn('node', [path.join(__dirname, 'auto_patcher.cjs')], { detached: true, stdio: 'ignore' }).unref();
      const scratchRestartPath = require('path').join(require('os').homedir(), '.gemini', 'antigravity', 'scratch', 'restart_app.cmd');
      require('child_process').exec(`wmic process call create "cmd.exe /c ${scratchRestartPath}"`, { cwd: __dirname });
      return { content: [{ type: "text", text: "Процесс принудительного пропатчивания и перезапуска успешно инициирован. IDE перезапустится через несколько секунд." }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Ошибка запуска патчера: ${e.message}` }] };
    }
  }
);

server.tool(
  "backup_settings",
  "Принудительно создать резервную копию конфигурационных файлов",
  async () => {
    try {
      createBackups();
      return {
        content: [{ type: "text", text: "Резервная копия успешно создана." }]
      };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Ошибка при создании бэкапа: ${e.message}` }]
      };
    }
  }
);

server.tool(
  "list_backups",
  "Показать доступные точки восстановления и файлы бэкапов",
  async () => {
    try {
      const versions = {};
      filesToBackup.forEach(file => {
        versions[file.name] = {
          main: fsSync.existsSync(file.dest) ? fsSync.statSync(file.dest).mtime : "отсутствует",
        };
        for (let i = 1; i <= 5; i++) {
          const verPath = `${file.dest}.${i}.bak`;
          if (fsSync.existsSync(verPath)) {
            versions[file.name][`version_${i}`] = fsSync.statSync(verPath).mtime;
          }
        }
      });
      return {
        content: [{ type: "text", text: JSON.stringify(versions, null, 2) }]
      };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Ошибка: ${e.message}` }]
      };
    }
  }
);

server.tool(
  "restore_settings",
  "Восстановить настройки из резервной копии (можно указать версию от 1 до 5)",
  {
    version: z.number().optional().describe("Номер версии бэкапа (1-5), по умолчанию 0 - основной бэкап")
  },
  async ({ version }) => {
    try {
      const ver = version || 0;
      filesToBackup.forEach(file => {
        let backupPath = file.dest;
        if (ver > 0) {
          backupPath = `${file.dest}.${ver}.bak`;
        }
        
        if (fsSync.existsSync(backupPath)) {
          fsSync.mkdirSync(path.dirname(file.src), { recursive: true });
          fsSync.copyFileSync(backupPath, file.src);
          logDebug(`[Backup/Restore API] Восстановлен файл ${file.name} из ${backupPath}`);
        }
      });
      return {
        content: [{ type: "text", text: `Настройки успешно восстановлены из версии ${ver}. Требуется перезапуск приложения для применения изменений.` }]
      };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Ошибка при восстановлении: ${e.message}` }]
      };
    }
  }
);

server.tool(
  "set_language",
  "Переключить язык интерфейса приложения (ru или en)",
  {
    lang: z.string().describe("Код языка: 'ru' или 'en'")
  },
  async ({ lang }) => {
    if (lang !== 'ru' && lang !== 'en') {
      return { content: [{ type: "text", text: "Некорректный код языка. Используйте 'ru' или 'en'." }] };
    }
    
    try {
      const portFile = path.join(userProfileDir, "AppData", "Roaming", "Antigravity", "DevToolsActivePort");
      if (fsSync.existsSync(portFile)) {
        const content = await fs.readFile(portFile, "utf8");
        const lines = content.split("\n").filter(l => l.trim());
        const port = parseInt(lines[0], 10);
        
        const targets = await CDPListWithTimeout({ port }, 3000).catch(() => null);
        if (targets) {
          const pages = targets.filter(t => t.type === 'page' && t.webSocketDebuggerUrl);
          const changeLangScript = `
            (() => {
              localStorage.setItem('antigravity_lang', '${lang}');
              window.location.reload();
            })()
          `;
          
          for (const page of pages) {
            let pageClient = null;
            try {
              pageClient = await CDPConnectWithTimeout({ target: page.webSocketDebuggerUrl }, 3000);
              const { Runtime: pageRuntime } = pageClient;
              await pageRuntime.enable();
              await pageRuntime.evaluate({ expression: changeLangScript });
            } catch (e) {
            } finally {
              if (pageClient) await pageClient.close().catch(() => {});
            }
          }
        }
      }
      return {
        content: [{ type: "text", text: `Язык переключен на '${lang}'. Все окна перезапущены.` }]
      };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Ошибка при смене языка: ${e.message}` }]
      };
    }
  }
);

// Подключаем транспорт
const transport = new StdioServerTransport();
server.connect(transport).catch(err => {
  logDebug(`Ошибка подключения транспорта: ${err.message}`);
});

// Хелпер для CDPList с таймаутом
function CDPListWithTimeout(options, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP.List timeout")), timeoutMs);
    CDP.List(options)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Хелпер для CDPConnect с таймаутом
function CDPConnectWithTimeout(options, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP connect timeout")), timeoutMs);
    CDP(options)
      .then((client) => {
        clearTimeout(timer);
        resolve(client);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

const injectedPages = new Set();

async function getProjectsMap() {
  const projectsMap = {};
  try {
    if (fsSync.existsSync(PROJECTS_DIR)) {
      const files = await fs.readdir(PROJECTS_DIR);
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'outside-of-project.json') {
          try {
            const content = await fs.readFile(path.join(PROJECTS_DIR, file), 'utf8');
            const project = JSON.parse(content);
            if (project.id && project.projectResources && project.projectResources.resources) {
              const res = project.projectResources.resources[0];
              if (res && res.gitFolder && res.gitFolder.folderUri) {
                let uri = res.gitFolder.folderUri;
                let decodedPath = decodeURIComponent(uri);
                decodedPath = decodedPath.replace(/^file:\/\/\/?/, '');
                decodedPath = decodedPath.replace(/^([a-zA-Z])[:|]\//, '$1:/');
                decodedPath = path.normalize(decodedPath);
                
                projectsMap[project.id] = decodedPath;
              }
            }
          } catch (e) {
            logDebug(`Ошибка парсинга проекта ${file}: ${e.message}`);
          }
        }
      }
    }
  } catch (err) {
    logDebug(`Ошибка чтения директории проектов: ${err.message}`);
  }
  return projectsMap;
}

const LOCAL_STORAGE_BACKUP_PATH = path.join(BACKUP_DIR, "localStorage_backup.json");
let localStorageBackup = {};
try {
  if (fsSync.existsSync(LOCAL_STORAGE_BACKUP_PATH)) {
    const content = fsSync.readFileSync(LOCAL_STORAGE_BACKUP_PATH, 'utf8').trim();
    if (content) {
      localStorageBackup = JSON.parse(content);
    }
  }
} catch (e) {
  logDebug(`Ошибка чтения localStorage_backup.json: ${e.message}`);
}
const restoredOrigins = new Set();

let isInjecting = false;

async function runUIInjection() {
  if (isInjecting) return;
  isInjecting = true;
  try {
    const portFile = path.join(userProfileDir, "AppData", "Roaming", "Antigravity", "DevToolsActivePort");
    if (!fsSync.existsSync(portFile)) return;
    
    const content = await fs.readFile(portFile, "utf8");
    const lines = content.split("\n").filter(l => l.trim());
    const port = parseInt(lines[0], 10);
    
    const targets = await CDPListWithTimeout({ port }, 3000).catch((err) => {
      return null;
    });
    if (!targets) return;
    
    const pages = targets.filter(t => {
      if (t.type !== 'page' || !t.webSocketDebuggerUrl) return false;
      const urlStr = t.url || '';
      return !urlStr.startsWith('chrome://') && 
             !urlStr.startsWith('devtools://') && 
             !urlStr.startsWith('chrome-extension://') && 
             !urlStr.startsWith('data:');
    });

    if (pages.length === 0) return;

    // Очистим из injectedPages те URL, которых больше нет в списке активных страниц
    const activeUrls = new Set(pages.map(p => p.webSocketDebuggerUrl));
    for (const url of injectedPages) {
      if (!activeUrls.has(url)) {
        injectedPages.delete(url);
      }
    }
    
    // Считываем код локализации
    const locPath = path.join(__dirname, 'localization_injected.js');
    if (!fsSync.existsSync(locPath)) {
      logDebug(`Файл localization_injected.js не найден по пути: ${locPath}`);
      return;
    }
    const localizationCode = fsSync.readFileSync(locPath, 'utf8');

    // Получаем карту проектов
    const projectsMap = await getProjectsMap();
    const projectsMapStr = JSON.stringify(projectsMap);
    
    const injectionScript = `
      (() => {
        window.__antigravity_projects_map = ${projectsMapStr};
        if (!window.__antigravity_translation_initialized) {
            window.__antigravity_translation_initialized = true;
            try {
                ${localizationCode}
                window.__antigravity_translation_success = true;
            } catch (e) {
                window.__antigravity_translation_error = e.message + '\\n' + e.stack;
                console.error("Error in injected localization:", e);
            }
        }
      })()
    `;

    for (const page of pages) {
      const targetUrl = page.webSocketDebuggerUrl;
      let pageOrigin = "";
      try {
        pageOrigin = new URL(page.url).origin;
      } catch (e) {
        pageOrigin = page.url;
      }

      let pageClient = null;
      try {
        pageClient = await CDPConnectWithTimeout({ target: targetUrl }, 3000).catch((err) => {
          return null;
        });
        if (!pageClient) continue;
        
        const { Runtime: pageRuntime, Page: pageDomain } = pageClient;
        await pageRuntime.enable();
        if (pageDomain) {
          await pageDomain.enable();
        }

        // 1. Синхронизация localStorage при первом подключении к Origin
        if (!restoredOrigins.has(pageOrigin)) {
          if (Object.keys(localStorageBackup).length > 0) {
            const restoreScript = `
              (() => {
                const backup = ${JSON.stringify(localStorageBackup)};
                let changed = false;
                for (const key in backup) {
                  if (localStorage.getItem(key) !== backup[key]) {
                    localStorage.setItem(key, backup[key]);
                    changed = true;
                  }
                }
                return changed;
              })()
            `;
            const restoreResult = await pageRuntime.evaluate({ expression: restoreScript, returnByValue: true });
            if (restoreResult && restoreResult.result && restoreResult.result.value === true) {
              logDebug(`[Backup/Restore] Применены настройки localStorage для Origin ${pageOrigin}. Перезагружаем страницу...`);
              await pageRuntime.evaluate({ expression: "window.location.reload()" });
              restoredOrigins.add(pageOrigin);
              await pageClient.close().catch(() => {});
              continue; // Переходим к следующей странице, эта перезагружается
            }
          }
          restoredOrigins.add(pageOrigin);
        }

        // 2. Обычная инжекция скрипта локализации
        if (!injectedPages.has(targetUrl)) {
          if (pageDomain) {
            await pageDomain.addScriptToEvaluateOnNewDocument({ source: injectionScript });
          }
          const evaluatePromise = pageRuntime.evaluate({ expression: injectionScript, returnByValue: true });
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("evaluate timeout")), 5000));
          await Promise.race([evaluatePromise, timeoutPromise]);
          injectedPages.add(targetUrl);
          logDebug(`[Injector] Успешная инжекция на странице: "${page.title}"`);
        }

        // 3. Автоматический бэкап Local Storage со страницы
        const backupScript = `
          (() => {
            const data = {};
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key !== 'antigravity_terminal_status') {
                data[key] = localStorage.getItem(key);
              }
            }
            return JSON.stringify(data);
          })()
        `;
        const backupResult = await pageRuntime.evaluate({ expression: backupScript });
        if (backupResult && backupResult.result && backupResult.result.value) {
          const currentSettings = JSON.parse(backupResult.result.value);
          if (JSON.stringify(currentSettings) !== JSON.stringify(localStorageBackup)) {
            localStorageBackup = currentSettings;
            fsSync.writeFileSync(LOCAL_STORAGE_BACKUP_PATH, JSON.stringify(localStorageBackup, null, 2), 'utf8');
            logDebug(`[Backup/Restore] Автоматически обновлен бэкап localStorage на диске для: ${pageOrigin}`);
          }
        }

      } catch (pageErr) {
        logDebug(`Ошибка инжекции/бэкапа на странице "${page.title}": ${pageErr.message}`);
      } finally {
        if (pageClient) {
          await pageClient.close().catch(() => {});
        }
      }
    }
  } catch (err) {
    logDebug(`Критическая ошибка: ${err.message}`);
  } finally {
    isInjecting = false;
  }
}
// ---------------------------------------------------------------------------
// Backup and Restore System for Settings, Permissions and Window State
// ---------------------------------------------------------------------------

// Список файлов для бэкапа
const filesToBackup = [
  {
    name: "window-state.json",
    src: path.join(APPDATA_DIR, "window-state.json"),
    dest: path.join(BACKUP_DIR, "window-state.json")
  },
  {
    name: "app_storage.json",
    src: path.join(APPDATA_DIR, "app_storage.json"),
    dest: path.join(BACKUP_DIR, "app_storage.json")
  },
  {
    name: "settings.json",
    src: path.join(APPDATA_IDE_DIR, "User", "settings.json"),
    dest: path.join(BACKUP_DIR, "settings.json")
  },
  {
    name: "storage.json",
    src: path.join(APPDATA_IDE_DIR, "User", "globalStorage", "storage.json"),
    dest: path.join(BACKUP_DIR, "storage.json")
  },
  {
    name: "state.vscdb",
    src: path.join(APPDATA_IDE_DIR, "User", "globalStorage", "state.vscdb"),
    dest: path.join(BACKUP_DIR, "state.vscdb")
  }
];

// Проверка геометрии главного окна window-state.json
function isValidWindowState(json) {
  try {
    if (!json || typeof json !== 'object') return false;
    if (json.x === undefined || json.y === undefined) return false;
    if (json.x === 0 && json.y === 0 && json.width === 800 && json.height === 600) return false;
    return true;
  } catch (e) {
    return false;
  }
}

// Проверка валидности storage.json (window state и UI темы редактора)
function isValidStorageJson(json) {
  try {
    if (!json || typeof json !== 'object') return false;
    if (!json.windowsState || !json.windowsState.lastActiveWindow) return false;
    const ui = json.windowsState.lastActiveWindow.uiState;
    if (!ui) return false;
    if (ui.x === 0 && ui.y === 0) return false;
    return true;
  } catch (e) {
    return false;
  }
}

// Проверка валидности settings.json
function isValidSettingsJson(json) {
  try {
    if (!json || typeof json !== 'object') return false;
    if (json["editor.fontSize"] === undefined && json["window.zoomLevel"] === undefined) return false;
    return true;
  } catch (e) {
    return false;
  }
}

// Проверка валидности state.vscdb
function isValidStateVscdb(filePath) {
  try {
    if (!fsSync.existsSync(filePath)) return false;
    const stats = fsSync.statSync(filePath);
    return stats.size > 10000;
  } catch (e) {
    return false;
  }
}

// Ротация бэкапов до 5 версий
function rotateAndBackup(srcPath, destPath, maxVersions = 5) {
  try {
    const isDir = fsSync.statSync(srcPath).isDirectory();
    
    for (let i = maxVersions - 1; i >= 1; i--) {
      const oldVer = `${destPath}.${i}.bak`;
      const newVer = `${destPath}.${i+1}.bak`;
      if (fsSync.existsSync(oldVer)) {
        if (isDir) {
          if (fsSync.existsSync(newVer)) fsSync.rmSync(newVer, { recursive: true, force: true });
          fsSync.renameSync(oldVer, newVer);
        } else {
          fsSync.copyFileSync(oldVer, newVer);
        }
      }
    }
    if (fsSync.existsSync(destPath)) {
      const oldVer = `${destPath}.1.bak`;
      if (isDir) {
        if (fsSync.existsSync(oldVer)) fsSync.rmSync(oldVer, { recursive: true, force: true });
        fsSync.renameSync(destPath, oldVer);
      } else {
        fsSync.copyFileSync(destPath, `${destPath}.1.bak`);
      }
    }
    
    if (isDir) {
      fsSync.mkdirSync(destPath, { recursive: true });
      fsSync.cpSync(srcPath, destPath, { recursive: true });
    } else {
      fsSync.copyFileSync(srcPath, destPath);
    }
    return true;
  } catch (err) {
    logDebug(`[Backup/Restore] Ошибка ротации для ${path.basename(destPath)}: ${err.message}`);
    return false;
  }
}

// Поиск лучшего бэкапа (основной или по цепочке версий)
function getBestBackup(destPath, fileName, maxVersions = 5) {
  const isDir = fileName === "workspaceStorage" || fileName === "Local Storage";
  
  if (fsSync.existsSync(destPath)) {
    try {
      if (isDir) {
        return destPath;
      }
      const content = fsSync.readFileSync(destPath, 'utf8').trim();
      if (content && content !== '{}' && content !== '[]') {
        if (fileName === "state.vscdb" && isValidStateVscdb(destPath)) {
          return destPath;
        }
        const parsed = JSON.parse(content);
        if (fileName === "window-state.json" && isValidWindowState(parsed)) return destPath;
        if (fileName === "storage.json" && isValidStorageJson(parsed)) return destPath;
        if (fileName === "settings.json" && isValidSettingsJson(parsed)) return destPath;
      }
    } catch (e) {}
  }
  for (let i = 1; i <= maxVersions; i++) {
    const verPath = `${destPath}.${i}.bak`;
    if (fsSync.existsSync(verPath)) {
      try {
        if (isDir) return verPath;
        if (fileName === "state.vscdb" && isValidStateVscdb(verPath)) {
          return verPath;
        }
        const content = fsSync.readFileSync(verPath, 'utf8').trim();
        if (content && content !== '{}' && content !== '[]') {
          const parsed = JSON.parse(content);
          if (fileName === "window-state.json" && isValidWindowState(parsed)) return verPath;
          if (fileName === "storage.json" && isValidStorageJson(parsed)) return verPath;
          if (fileName === "settings.json" && isValidSettingsJson(parsed)) return verPath;
        }
      } catch (e) {}
    }
  }
  return null;
}

// Функция восстановления
function restoreFiles() {
  logDebug("[Backup/Restore] Проверка необходимости восстановления настроек...");
  
  // 1. Восстановление обычных файлов настроек
  filesToBackup.forEach(file => {
    const bestBackup = getBestBackup(file.dest, file.name);
    if (bestBackup) {
      const srcExists = fsSync.existsSync(file.src);
      let shouldRestore = false;
      
      if (!srcExists) {
        shouldRestore = true;
        logDebug(`[Backup/Restore] Файл ${file.name} отсутствует в системе. Восстанавливаем...`);
      } else {
        try {
          if (file.name === "state.vscdb") {
            if (!isValidStateVscdb(file.src)) {
              shouldRestore = true;
              logDebug(`[Backup/Restore] Файл state.vscdb поврежден или пуст. Восстанавливаем...`);
            }
          } else {
            const content = fsSync.readFileSync(file.src, 'utf8').trim();
            if (!content || content === '{}' || content === '[]') {
              shouldRestore = true;
              logDebug(`[Backup/Restore] Файл ${file.name} пуст или сброшен. Восстанавливаем...`);
            } else {
              const parsed = JSON.parse(content);
              if (file.name === "window-state.json" && !isValidWindowState(parsed)) {
                shouldRestore = true;
                logDebug(`[Backup/Restore] Файл window-state.json содержит дефолтные/сброшенные координаты. Восстанавливаем...`);
              } else if (file.name === "storage.json" && !isValidStorageJson(parsed)) {
                shouldRestore = true;
                logDebug(`[Backup/Restore] Файл storage.json содержит дефолтные/сброшенные координаты. Восстанавливаем...`);
              } else if (file.name === "settings.json" && !isValidSettingsJson(parsed)) {
                shouldRestore = true;
                logDebug(`[Backup/Restore] Файл settings.json не содержит ключевых настроек. Восстанавливаем...`);
              }
            }
          }
        } catch (e) {
          shouldRestore = true;
          logDebug(`[Backup/Restore] Файл ${file.name} поврежден. Восстанавливаем...`);
        }
      }
      
      if (shouldRestore) {
        try {
          fsSync.mkdirSync(path.dirname(file.src), { recursive: true });
          fsSync.copyFileSync(bestBackup, file.src);
          logDebug(`[Backup/Restore] Успешно восстановлен файл ${file.name} из ${path.basename(bestBackup)}`);
        } catch (copyErr) {
          logDebug(`[Backup/Restore] Ошибка восстановления ${file.name}: ${copyErr.message}`);
        }
      }
    }
  });

  // 2. Восстановление папки Local Storage (из APPDATA_DIR)
  const lsSrc = path.join(APPDATA_DIR, "Local Storage");
  const lsDest = path.join(BACKUP_DIR, "Local Storage");
  const bestLs = getBestBackup(lsDest, "Local Storage");
  if (bestLs && !fsSync.existsSync(lsSrc)) {
    try {
      fsSync.mkdirSync(path.dirname(lsSrc), { recursive: true });
      fsSync.cpSync(bestLs, lsSrc, { recursive: true });
      logDebug(`[Backup/Restore] Восстановлена папка Local Storage из ${path.basename(bestLs)}`);
    } catch (lsErr) {
      logDebug(`[Backup/Restore] Ошибка восстановления Local Storage: ${lsErr.message}`);
    }
  }

  // 3. Восстановление workspaceStorage (из APPDATA_IDE_DIR)
  const wsSrc = path.join(APPDATA_IDE_DIR, "User", "workspaceStorage");
  const wsDest = path.join(BACKUP_DIR, "workspaceStorage");
  const bestWs = getBestBackup(wsDest, "workspaceStorage");
  if (bestWs && !fsSync.existsSync(wsSrc)) {
    try {
      fsSync.mkdirSync(path.dirname(wsSrc), { recursive: true });
      fsSync.cpSync(bestWs, wsSrc, { recursive: true });
      logDebug(`[Backup/Restore] Восстановлена папка workspaceStorage из ${path.basename(bestWs)}`);
    } catch (wsErr) {
      logDebug(`[Backup/Restore] Ошибка восстановления workspaceStorage: ${wsErr.message}`);
    }
  }

  // 4. Восстановление настроек проектов
  const backupProjectsDir = path.join(BACKUP_DIR, "projects");
  if (fsSync.existsSync(backupProjectsDir)) {
    try {
      const backupProjects = fsSync.readdirSync(backupProjectsDir);
      backupProjects.forEach(projFile => {
        const srcProjPath = path.join(PROJECTS_DIR, projFile);
        const destProjPath = path.join(backupProjectsDir, projFile);
        
        if (!fsSync.existsSync(srcProjPath)) {
          try {
            fsSync.mkdirSync(PROJECTS_DIR, { recursive: true });
            fsSync.copyFileSync(destProjPath, srcProjPath);
            logDebug(`[Backup/Restore] Восстановлен проект: ${projFile}`);
          } catch (projErr) {
            logDebug(`[Backup/Restore] Ошибка восстановления проекта ${projFile}: ${projErr.message}`);
          }
        }
      });
    } catch (readErr) {
      logDebug(`[Backup/Restore] Ошибка чтения проектов для восстановления: ${readErr.message}`);
    }
  }
}

// Функция создания бэкапа
function createBackups() {
  logDebug("[Backup/Restore] Проверка необходимости создания резервных копий...");
  
  // 1. Бэкап обычных файлов
  filesToBackup.forEach(file => {
    if (fsSync.existsSync(file.src)) {
      try {
        if (file.name === "state.vscdb") {
          if (!isValidStateVscdb(file.src)) return; // не бэкапим пустой state
          
          let needBackup = true;
          if (fsSync.existsSync(file.dest)) {
            const srcSize = fsSync.statSync(file.src).size;
            const destSize = fsSync.statSync(file.dest).size;
            if (srcSize === destSize) {
              needBackup = false; // оптимизация
            }
          }
          if (needBackup) {
            rotateAndBackup(file.src, file.dest);
            logDebug(`[Backup/Restore] Создана новая копия файла: ${file.name}`);
          }
        } else {
          const content = fsSync.readFileSync(file.src, 'utf8').trim();
          if (content && content !== '{}' && content !== '[]') {
            const parsed = JSON.parse(content); // валидация JSON
            
            if (file.name === "window-state.json" && !isValidWindowState(parsed)) return;
            if (file.name === "storage.json" && !isValidStorageJson(parsed)) return;
            if (file.name === "settings.json" && !isValidSettingsJson(parsed)) return;
            
            let needBackup = true;
            if (fsSync.existsSync(file.dest)) {
              const backupContent = fsSync.readFileSync(file.dest, 'utf8').trim();
              if (backupContent === content) {
                needBackup = false; // Нет изменений
              }
            }
            
            if (needBackup) {
              rotateAndBackup(file.src, file.dest);
              logDebug(`[Backup/Restore] Создана новая копия файла: ${file.name}`);
            }
          }
        }
      } catch (err) {
        // Игнорируем ошибки
      }
    }
  });

  // 2. Бэкап папки Local Storage (из APPDATA_DIR)
  const lsSrc = path.join(APPDATA_DIR, "Local Storage");
  const lsDest = path.join(BACKUP_DIR, "Local Storage");
  if (fsSync.existsSync(lsSrc)) {
    try {
      let needBackup = true;
      if (fsSync.existsSync(lsDest)) {
        const getDirSize = (dir) => {
          let size = 0;
          fsSync.readdirSync(dir).forEach(f => {
            const fp = path.join(dir, f);
            const stat = fsSync.statSync(fp);
            if (stat.isDirectory()) size += getDirSize(fp);
            else size += stat.size;
          });
          return size;
        };
        const srcSize = getDirSize(lsSrc);
        const destSize = getDirSize(lsDest);
        if (srcSize === destSize) needBackup = false;
      }
      if (needBackup) {
        rotateAndBackup(lsSrc, lsDest);
        logDebug(`[Backup/Restore] Создан бэкап папки Local Storage`);
      }
    } catch (lsErr) {
      logDebug(`[Backup/Restore] Ошибка бэкапа Local Storage: ${lsErr.message}`);
    }
  }

  // 3. Бэкап workspaceStorage (из APPDATA_IDE_DIR)
  const wsSrc = path.join(APPDATA_IDE_DIR, "User", "workspaceStorage");
  const wsDest = path.join(BACKUP_DIR, "workspaceStorage");
  if (fsSync.existsSync(wsSrc)) {
    try {
      let needBackup = true;
      if (fsSync.existsSync(wsDest)) {
        const getDirSize = (dir) => {
          let size = 0;
          fsSync.readdirSync(dir).forEach(f => {
            const fp = path.join(dir, f);
            const stat = fsSync.statSync(fp);
            if (stat.isDirectory()) size += getDirSize(fp);
            else size += stat.size;
          });
          return size;
        };
        const srcSize = getDirSize(wsSrc);
        const destSize = getDirSize(wsDest);
        if (srcSize === destSize) needBackup = false;
      }
      if (needBackup) {
        rotateAndBackup(wsSrc, wsDest);
        logDebug(`[Backup/Restore] Создан бэкап папки workspaceStorage`);
      }
    } catch (wsErr) {
      logDebug(`[Backup/Restore] Ошибка бэкапа workspaceStorage: ${wsErr.message}`);
    }
  }

  // 4. Бэкап настроек проектов
  if (fsSync.existsSync(PROJECTS_DIR)) {
    const backupProjectsDir = path.join(BACKUP_DIR, "projects");
    if (!fsSync.existsSync(backupProjectsDir)) {
      fsSync.mkdirSync(backupProjectsDir, { recursive: true });
    }
    
    try {
      const projects = fsSync.readdirSync(PROJECTS_DIR);
      projects.forEach(projFile => {
        const srcProjPath = path.join(PROJECTS_DIR, projFile);
        const destProjPath = path.join(backupProjectsDir, projFile);
        
        try {
          const content = fsSync.readFileSync(srcProjPath, 'utf8').trim();
          if (content && content !== '{}') {
            JSON.parse(content);
            
            let needBackup = true;
            if (fsSync.existsSync(destProjPath)) {
              const backupContent = fsSync.readFileSync(destProjPath, 'utf8').trim();
              if (backupContent === content) {
                needBackup = false;
              }
            }
            
            if (needBackup) {
              fsSync.copyFileSync(srcProjPath, destProjPath);
              logDebug(`[Backup/Restore] Создан бэкап настроек проекта: ${projFile}`);
            }
          }
        } catch (e) {}
      });
    } catch (dirErr) {}
  }
}

// Запуск восстановления при старте
try {
  restoreFiles();
} catch (e) {
  logDebug(`[Backup/Restore Error] Ошибка автовосстановления при старте: ${e.message}`);
}

// Первоначальный бэкап при старте
setTimeout(() => {
  try {
    createBackups();
  } catch (e) {}
}, 5000);

// Периодический бэкап каждые 30 секунд
const backupInterval = setInterval(() => {
  try {
    createBackups();
  } catch (e) {}
}, 30000);
backupInterval.unref();

// Запускаем инжектор локализации раз в 3 секунды
const uiTimeout = setTimeout(runUIInjection, 1000);
uiTimeout.unref();
const uiInterval = setInterval(runUIInjection, 3000);
uiInterval.unref();
