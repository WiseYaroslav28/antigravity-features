import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import CDP from 'chrome-remote-interface';
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const require = createRequire(import.meta.url);
const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Логирование для отладки
const userProfileDir = process.env.USERPROFILE || "C:\\Users\\wisey";
const LOG_FILE = path.join(userProfileDir, ".gemini", "antigravity", "scratch", "features_mcp.log");

const APPDATA_DIR = path.join(userProfileDir, "AppData", "Roaming", "Antigravity");
const APPDATA_IDE_DIR = path.join(userProfileDir, "AppData", "Roaming", "Antigravity IDE");
const CONFIG_DIR = path.join(userProfileDir, ".gemini", "config");
const PROJECTS_DIR = path.join(CONFIG_DIR, "projects");
const REPO_DIR = "c:\\Antigravity projects\\antigravity-features";
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

let localVersion = "1.0.0";
const versionPath = path.join(__dirname, "version.json");
if (fsSync.existsSync(versionPath)) {
  try {
    const vData = JSON.parse(fsSync.readFileSync(versionPath, 'utf8'));
    localVersion = vData.version || "1.0.0";
  } catch(e) {}
}

let updateAvailable = false;
let isUpdating = false;
let justUpdated = false;
let readyToRestart = false;
let patchNeedsRestart = false;
let latestVersion = localVersion;

const UPDATE_STATE_FILE = path.join(userProfileDir, ".gemini", "antigravity", "scratch", "features_update_state.json");

function loadUpdateState() {
  try {
    if (fsSync.existsSync(UPDATE_STATE_FILE)) {
      const data = JSON.parse(fsSync.readFileSync(UPDATE_STATE_FILE, 'utf8'));
      updateAvailable = data.updateAvailable || false;
      isUpdating = data.isUpdating || false;
      justUpdated = data.justUpdated || false;
      readyToRestart = data.readyToRestart || false;
      patchNeedsRestart = data.patchNeedsRestart || false;
      latestVersion = data.latestVersion || localVersion;
      logDebug(`[Update State] Состояние загружено: updateAvailable=${updateAvailable}, isUpdating=${isUpdating}, justUpdated=${justUpdated}, readyToRestart=${readyToRestart}, patchNeedsRestart=${patchNeedsRestart}`);
    }
  } catch (e) {
    logDebug(`[Update State Error] Не удалось загрузить состояние: ${e.message}`);
  }
}

function saveUpdateState() {
  try {
    const data = {
      updateAvailable,
      isUpdating,
      justUpdated,
      readyToRestart,
      patchNeedsRestart,
      latestVersion
    };
    fsSync.mkdirSync(path.dirname(UPDATE_STATE_FILE), { recursive: true });
    fsSync.writeFileSync(UPDATE_STATE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    logDebug(`[Update State Error] Не удалось сохранить состояние: ${e.message}`);
  }
}

// Загружаем состояние при запуске
loadUpdateState();

if (readyToRestart) {
  readyToRestart = false;
  justUpdated = true;
  saveUpdateState();
  logDebug("[Update State] Перезапуск после обновления успешен, сброшен readyToRestart, установлен justUpdated = true");
}

// Если только что обновились, запускаем сброс флага через 15 секунд
if (justUpdated) {
  setTimeout(() => {
    justUpdated = false;
    saveUpdateState();
    logDebug("[Update State] Флаг justUpdated сброшен по таймауту.");
  }, 15000);
}

function isVersionNewer(local, remote) {
  const lParts = String(local).split('.').map(Number);
  const rParts = String(remote).split('.').map(Number);
  for (let i = 0; i < Math.max(lParts.length, rParts.length); i++) {
    const l = lParts[i] || 0;
    const r = rParts[i] || 0;
    if (r > l) return true;
    if (l > r) return false;
  }
  return false;
}

async function checkUpdatesBackground() {
  try {
    logDebug("[Background Check] Проверка обновлений...");
    if (!fsSync.existsSync(path.join(REPO_DIR, ".git"))) {
      logDebug(`[Background Check Error] Директория ${REPO_DIR} не является Git-репозиторием.`);
      return;
    }
    
    try {
      await execPromise("git fetch origin", { cwd: REPO_DIR });
    } catch (fetchErr) {
      logDebug(`[Background Check] Ошибка git fetch: ${fetchErr.message}`);
    }
    
    let targetLatest = localVersion;
    
    // 1. Проверяем версию на гитхабе
    try {
      const { stdout } = await execPromise("git show origin/master:version.json", { cwd: REPO_DIR });
      const vData = JSON.parse(stdout);
      if (vData.version) targetLatest = vData.version;
    } catch (e) {
      logDebug(`[Background Check] Не удалось прочитать версию из origin: ${e.message}`);
    }
    
    // 2. Проверяем версию в локальном репозитории (вдруг она новее)
    const repoVersionPath = path.join(REPO_DIR, "version.json");
    if (fsSync.existsSync(repoVersionPath)) {
      try {
        const rvData = JSON.parse(fsSync.readFileSync(repoVersionPath, 'utf8'));
        if (rvData.version && isVersionNewer(targetLatest, rvData.version)) {
          targetLatest = rvData.version;
        }
      } catch (e) {}
    }
    
    if (isVersionNewer(localVersion, targetLatest)) {
      updateAvailable = true;
      latestVersion = targetLatest;
      logDebug(`[Background Check] Доступно обновление с v${localVersion} до v${latestVersion}`);
    } else {
      updateAvailable = false;
      latestVersion = localVersion;
      logDebug(`[Background Check] Обновлений нет. Текущая версия v${localVersion} актуальна (последняя: v${targetLatest}).`);
    }
    saveUpdateState();
  } catch (err) {
    logDebug(`[Background Check Error] Не удалось проверить обновления: ${err.message}`);
  }
}

logDebug("Запуск MCP-сервера расширений AntiGravity (antigravity-features)...");

// Автоматическая проверка и восстановление патча app.asar (в фоне после старта)
setTimeout(() => {
  try {
    logDebug("Проверка целостности патча локализации в фоновом режиме...");
    const patchResult = require('child_process').spawnSync(process.argv[0], [path.join(__dirname, 'auto_patcher.cjs')]);
    if (patchResult.status === 1) {
      logDebug("app.asar был успешно пропатчен. Требуется перезапуск, устанавливаем patchNeedsRestart = true...");
      patchNeedsRestart = true;
      saveUpdateState();
    } else if (patchResult.status === 2) {
      logDebug("Ошибка автопатчера: " + (patchResult.stderr ? patchResult.stderr.toString() : "unknown"));
    } else {
      logDebug("Патч локализации присутствует.");
      if (patchNeedsRestart) {
        patchNeedsRestart = false;
        saveUpdateState();
        logDebug("[Update State] Сброшен patchNeedsRestart");
      }
    }
  } catch (err) {
    logDebug("Ошибка при вызове автопатчера: " + err.message);
  }
}, 5000);

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

      await execPromise("git fetch origin", { cwd: REPO_DIR });
      const { stdout } = await execPromise("git status -uno", { cwd: REPO_DIR });
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
      await execPromise("git pull origin master", { cwd: REPO_DIR });
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
      const langFile = path.join(userProfileDir, ".gemini", "antigravity", "antigravity_lang.txt");
      await fs.writeFile(langFile, lang);
      
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

const cleanExit = () => {
  logDebug("[Lifecycle] Получен сигнал выхода. Мягкое завершение...");
  process.exit(0);
};

process.stdin.on('close', () => {
  logDebug("[Lifecycle] stdin закрыт. Завершение процесса...");
  process.exit(0);
});

process.stdin.on('end', () => {
  logDebug("[Lifecycle] stdin завершен. Завершение процесса...");
  process.exit(0);
});

process.on('SIGTERM', cleanExit);
process.on('SIGINT', cleanExit);

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
      const parsed = JSON.parse(content);
      const isStructured = Object.keys(parsed).every(key => key.includes("://"));
      if (isStructured) {
        localStorageBackup = parsed;
      } else {
        logDebug(`[Backup/Restore] Обнаружен старый плоский формат бэкапа. Сбрасываем для перехода на Origin-структуру.`);
        localStorageBackup = {};
      }
    }
  }
} catch (e) {
  logDebug(`Ошибка чтения localStorage_backup.json: ${e.message}`);
}
const restoredOrigins = new Set();

async function triggerSelfUpdate() {
  if (isUpdating) return;
  isUpdating = true;
  saveUpdateState();
  
  try {
    logDebug("[Self Update] Запуск фонового скрипта обновления...");
    const isDevMode = process.env.MCP_DEV_MODE === 'true';
    const runnerPath = path.join(userProfileDir, ".gemini", "antigravity", "mcp-servers", "antigravity-features", "update-runner-features.cjs");
    
    if (fsSync.existsSync(runnerPath)) {
      const args = [runnerPath, "--repo-dir", REPO_DIR];
      if (isDevMode) {
        args.push("--local-dev");
      }
      
      logDebug(`[Self Update] Запуск фонового процесса: node ${args.join(' ')}`);
      const child = spawn(
        process.argv[0],
        args,
        {
          detached: true,
          stdio: "ignore",
          windowsHide: true
        }
      );
      child.unref();
      logDebug("[Self Update] Процесс обновления успешно отсоединен и запущен.");
    } else {
      logDebug(`[Self Update Error] Скрипт обновления не найден: ${runnerPath}`);
      isUpdating = false;
      saveUpdateState();
    }
  } catch (err) {
    logDebug(`[Self Update Error] Не удалось запустить обновление: ${err.message}`);
    isUpdating = false;
    saveUpdateState();
  }
}

async function getSavedLanguage() {
  const langFile = path.join(userProfileDir, ".gemini", "antigravity", "antigravity_lang.txt");
  try {
    if (fsSync.existsSync(langFile)) {
      return (await fs.readFile(langFile, "utf8")).trim();
    }
  } catch (_) {}
  return "ru";
}

let isInjecting = false;

async function runUIInjection() {
  logDebug(`[Injector] Запуск runUIInjection, isInjecting = ${isInjecting}`);
  if (isInjecting) return;
  isInjecting = true;
  try {
    const portFile = path.join(userProfileDir, "AppData", "Roaming", "Antigravity", "DevToolsActivePort");
    if (!fsSync.existsSync(portFile)) {
      if (global.__last_port_warn !== 'not_found') {
        global.__last_port_warn = 'not_found';
        logDebug(`[Injector] Файл DevToolsActivePort не найден по пути: ${portFile}`);
      }
      return;
    }
    
    const content = await fs.readFile(portFile, "utf8");
    const lines = content.split("\n").filter(l => l.trim());
    const port = parseInt(lines[0], 10);
    
    const targets = await CDPListWithTimeout({ port }, 3000).catch((err) => {
      if (global.__last_cdp_err !== err.message) {
        global.__last_cdp_err = err.message;
        logDebug(`[Injector Error] Ошибка CDP List на порту ${port}: ${err.message}`);
      }
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

    // Получаем карту проектов и сохраненный язык
    const savedLang = await getSavedLanguage();
    const projectsMap = await getProjectsMap();
    const projectsMapStr = JSON.stringify(projectsMap);
    
    let localVersion = "1.0.0";
    const versionPath = path.join(__dirname, "version.json");
    if (fsSync.existsSync(versionPath)) {
        try {
            const vData = JSON.parse(fsSync.readFileSync(versionPath, 'utf8'));
            localVersion = vData.version || "1.0.0";
        } catch(e) {}
    }
    
    const injectionScript = `
      (() => {
        window.__antigravity_saved_lang = "${savedLang}";
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
        
        // Render Badge for antigravity-features
        try {
           const name = "antigravity-features";
           
           if (!window.__antigravity_features_state) {
               window.__antigravity_features_state = {
                   version: "${localVersion}",
                   updateAvailable: ${updateAvailable},
                   isUpdating: ${isUpdating},
                   justUpdated: ${justUpdated},
                   readyToRestart: ${readyToRestart},
                   patchNeedsRestart: ${patchNeedsRestart},
                   latestVersion: "${latestVersion}"
               };
           }
           
           function renderFeatureBadge() {
               const state = window.__antigravity_features_state || {};
               const version = state.version;
               const updateAvailable = state.updateAvailable;
               const isUpdating = state.isUpdating;
               const justUpdated = state.justUpdated;
               const readyToRestart = state.readyToRestart;
               const patchNeedsRestart = state.patchNeedsRestart;
               const latestVersion = state.latestVersion;
              const hasSettingsParent = (el) => {
                 let p = el.parentElement;
                 while (p) {
                   const className = p.className || '';
                   if (typeof className === 'string' && className.includes('max-w-2xl')) {
                     return true;
                   }
                   p = p.parentElement;
                 }
                 return false;
               };

               const hasToolsCheck = (el) => {
                 let gp = el.parentElement ? el.parentElement.parentElement : null;
                 if (gp) {
                   const text = gp.textContent || '';
                   if (text.includes('tools') || text.includes('Инструменты') || text.includes('инструментов')) {
                     return true;
                   }
                 }
                 return false;
               };

               const elements = Array.from(document.querySelectorAll('*'));
               
               const titleEl = elements.find(el => {
                 const text = el.textContent.trim();
                 const cleanText = text.replace(/[\\s\\u2022\\u00a0]/g, '');
                 const cleanName = name.replace(/[\\s\\u2022\\u00a0]/g, '');
                 if (text !== name && cleanText !== cleanName) return false;
                 if (!hasSettingsParent(el)) return false;
                 if (!hasToolsCheck(el)) return false;
                
                if (el.tagName !== 'SPAN' && el.tagName !== 'DIV') return false;
                
                const className = el.className || '';
                if (typeof className !== 'string' || !className.includes('truncate')) return false;
                
                const p = el.parentElement;
                if (!p || p.tagName !== 'DIV') return false;
                const pClass = p.className || '';
                if (typeof pClass !== 'string' || !pClass.includes('flex')) return false;
                
                const gp = p.parentElement;
                if (!gp || gp.tagName !== 'DIV') return false;
                

                
                const ggp = gp.parentElement;
                if (!ggp || ggp.tagName !== 'DIV') return false;
                const ggpClass = ggp.className || '';
                if (typeof ggpClass !== 'string' || !ggpClass.includes('group')) return false;
                
                return true;
              });
              
              if (!titleEl) {
                window.__antigravity_features_badge_result = "Элемент '" + name + "' не найден в DOM";
                return null;
              }
              
              const dotEl = Array.from(titleEl.parentNode.children).find(child => {
                if (child === titleEl) return false;
                const style = window.getComputedStyle(child);
                const isCircle = style.borderRadius === '50%' || 
                                 (style.borderRadius && style.borderRadius.includes('px') && parseInt(style.borderRadius) > 0) ||
                                 child.getAttribute('style')?.includes('border-radius');
                
                const hasDotClass = Array.from(child.classList).some(c => 
                  c.includes('dot') || c.includes('indicator') || c.includes('status') || c.includes('circle')
                );
                return isCircle || hasDotClass;
              });
              
              let container = titleEl.parentNode.querySelector('.antigravity-features-version-container');
              if (!container) {
                container = document.createElement('span');
                container.className = 'antigravity-features-version-container';
                container.style.marginLeft = '12px';
                container.style.display = 'inline-flex';
                container.style.alignItems = 'center';
                container.style.gap = '8px';
                container.style.fontSize = '12px';
                container.style.verticalAlign = 'middle';
                
                const badge = document.createElement('span');
                badge.className = 'mcp-version-badge';
                badge.style.padding = '1px 6px';
                badge.style.borderRadius = '3px';
                badge.style.fontFamily = 'monospace';
                badge.style.fontSize = '10px';
                container.appendChild(badge);
                
                const updateBtn = document.createElement('button');
                updateBtn.className = 'mcp-update-btn';
                updateBtn.style.setProperty('border', 'none', 'important');
                updateBtn.style.setProperty('padding', '2px 8px', 'important');
                updateBtn.style.setProperty('border-radius', '3px', 'important');
                updateBtn.style.setProperty('font-size', '10px', 'important');
                updateBtn.style.setProperty('font-weight', 'bold', 'important');
                updateBtn.style.setProperty('line-height', '1.2', 'important');
                updateBtn.style.setProperty('transition', 'all 0.2s', 'important');
                container.appendChild(updateBtn);
                
                let insertAfterEl = titleEl;
                if (dotEl) {
                  insertAfterEl = dotEl;
                }
                
                insertAfterEl.parentNode.insertBefore(container, insertAfterEl.nextSibling);
              }
              
              // Обновляем версию и цвета версии
              const badgeEl = container.querySelector('.mcp-version-badge');
              if (badgeEl) {
                 if (isUpdating) {
                   badgeEl.textContent = 'v' + version + ' (Обновление...)';
                   badgeEl.style.setProperty('background', '#4a3728', 'important');
                   badgeEl.style.setProperty('color', '#ffb07c', 'important');
                   badgeEl.style.setProperty('border', '1px solid #d46b28', 'important');
                 } else if (justUpdated) {
                   badgeEl.textContent = 'v' + version + ' (Обновлено! 🎉)';
                   badgeEl.style.setProperty('background', '#1b5e20', 'important');
                   badgeEl.style.setProperty('color', '#a5d6a7', 'important');
                   badgeEl.style.setProperty('border', '1px solid #2e7d32', 'important');
                 } else if (patchNeedsRestart) {
                   badgeEl.textContent = 'v' + version + ' (Патч ожидает перезапуска)';
                   badgeEl.style.setProperty('background', '#4d3300', 'important');
                   badgeEl.style.setProperty('color', '#ffe0b2', 'important');
                   badgeEl.style.setProperty('border', '1px solid #ff9800', 'important');
                 } else {
                   badgeEl.textContent = 'v' + version;
                   badgeEl.style.setProperty('background', '#2a2a2a', 'important');
                   badgeEl.style.setProperty('color', '#888', 'important');
                   badgeEl.style.setProperty('border', '1px solid #444', 'important');
                 }
              }
              
              const updateBtnEl = container.querySelector('.mcp-update-btn');
              if (updateBtnEl) {
                 if (isUpdating) {
                   updateBtnEl.disabled = true;
                   updateBtnEl.style.setProperty('cursor', 'default', 'important');
                   updateBtnEl.style.setProperty('background', '#555', 'important');
                   updateBtnEl.style.setProperty('color', '#ccc', 'important');
                   updateBtnEl.style.setProperty('border', 'none', 'important');
                   updateBtnEl.textContent = 'Обновление...';
                   updateBtnEl.onclick = null;
                 } else if (patchNeedsRestart) {
                   updateBtnEl.disabled = false;
                   updateBtnEl.style.setProperty('cursor', 'pointer', 'important');
                   updateBtnEl.style.setProperty('background', '#d35400', 'important');
                   updateBtnEl.style.setProperty('color', '#fff', 'important');
                   updateBtnEl.style.setProperty('border', 'none', 'important');
                   updateBtnEl.textContent = 'Перезапустить (Патч)';
                   updateBtnEl.onclick = (e) => {
                     e.stopPropagation();
                     if (confirm("Патч локализации ядра успешно применен.\\n\\nПерезапустить Antigravity для активации перевода?")) {
                       window.__antigravity_pending_action = 'restart';
                     }
                   };
                 } else if (updateAvailable) {
                   updateBtnEl.disabled = false;
                   updateBtnEl.style.setProperty('cursor', 'pointer', 'important');
                   updateBtnEl.style.setProperty('background', '#1a73e8', 'important');
                   updateBtnEl.style.setProperty('color', '#fff', 'important');
                   updateBtnEl.style.setProperty('border', 'none', 'important');
                   updateBtnEl.textContent = 'Обновить до v' + latestVersion;
                   
                   updateBtnEl.onclick = (e) => {
                     e.stopPropagation();
                     updateBtnEl.textContent = 'Обновление...';
                     updateBtnEl.disabled = true;
                     updateBtnEl.style.setProperty('background', '#555', 'important');
                     updateBtnEl.style.setProperty('color', '#ccc', 'important');
                     window.__antigravity_pending_action = 'update';
                   };
                 } else {
                   updateBtnEl.disabled = true;
                   updateBtnEl.style.setProperty('cursor', 'default', 'important');
                   updateBtnEl.style.setProperty('background', '#222', 'important');
                   updateBtnEl.style.setProperty('color', '#555', 'important');
                   updateBtnEl.style.setProperty('border', '1px solid #333', 'important');
                   updateBtnEl.textContent = 'Актуально';
                   updateBtnEl.onclick = null;
                 }
              }
              
              window.__antigravity_features_badge_result = "Рендеринг выполнен (updateAvailable: " + updateAvailable + ")";
              return null;
           }
           
           window.__antigravity_features_render = renderFeatureBadge;
           renderFeatureBadge();
           
           if (!window.__antigravity_features_ui_observer) {
             window.__antigravity_features_ui_observer = new MutationObserver(() => {
               if (window.__antigravity_features_ui_timer) clearTimeout(window.__antigravity_features_ui_timer);
               window.__antigravity_features_ui_timer = setTimeout(() => {
                 if (window.__antigravity_features_render) window.__antigravity_features_render();
               }, 200);
             });
             window.__antigravity_features_ui_observer.observe(document.documentElement, {
               childList: true,
               subtree: true
             });
             window.addEventListener('popstate', () => {
               if (window.__antigravity_features_render) window.__antigravity_features_render();
             });
             setInterval(() => {
               if (window.__antigravity_features_render) window.__antigravity_features_render();
             }, 1000);
           }
           
           const action = window.__antigravity_pending_action || null;
           if (action) {
             window.__antigravity_pending_action = null;
           }
           return action;
        } catch(err) {
           window.__antigravity_features_debug_elements_error = "Критическая ошибка скрипта: " + err.message + "\\n" + err.stack;
           console.error("Error rendering features badge:", err);
           return null;
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


        // Проверяем, инициализирован ли скрипт на странице (на случай перезагрузки страницы)
        let needsInjection = !injectedPages.has(targetUrl);
        if (!needsInjection) {
          try {
            const checkInit = await pageRuntime.evaluate({
              expression: "!!window.__antigravity_translation_initialized",
              returnByValue: true
            });
            if (!checkInit || !checkInit.result || !checkInit.result.value) {
              needsInjection = true;
              injectedPages.delete(targetUrl);
              logDebug(`[Injector] Страница "${page.title}" была перезагружена, требуется повторная инжекция.`);
            }
          } catch (e) {
            needsInjection = true;
            injectedPages.delete(targetUrl);
          }
        }

        // 2. Обычная инжекция скрипта локализации
        let actionTriggered = null;
        if (needsInjection) {
          if (pageDomain) {
            await pageDomain.addScriptToEvaluateOnNewDocument({ source: injectionScript });
          }
          const evaluatePromise = pageRuntime.evaluate({ expression: injectionScript, returnByValue: true });
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("evaluate timeout")), 5000));
          const evalRes = await Promise.race([evaluatePromise, timeoutPromise]);
          if (evalRes && evalRes.result && evalRes.result.value) {
            actionTriggered = evalRes.result.value;
          }
          injectedPages.add(targetUrl);
          logDebug(`[Injector] Успешная инжекция на странице: "${page.title}"`);
        } else {
          // Оптимизированный опрос состояния с синхронизацией переменных и передачей кликов
          const queryScript = `
            (() => {
              window.__antigravity_features_state = {
                version: "${localVersion}",
                updateAvailable: ${updateAvailable},
                isUpdating: ${isUpdating},
                justUpdated: ${justUpdated},
                readyToRestart: ${readyToRestart},
                patchNeedsRestart: ${patchNeedsRestart},
                latestVersion: "${latestVersion}"
              };
              if (window.__antigravity_features_render) {
                window.__antigravity_features_render();
              }
              const action = window.__antigravity_pending_action || null;
              if (action) {
                window.__antigravity_pending_action = null;
              }
              const pendingLang = window.__antigravity_pending_lang_change || null;
              if (pendingLang) {
                window.__antigravity_pending_lang_change = null;
              }
              return { action, pendingLang };
            })()
          `;
          const evaluatePromise = pageRuntime.evaluate({ expression: queryScript, returnByValue: true });
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("evaluate timeout")), 2000));
          const evalRes = await Promise.race([evaluatePromise, timeoutPromise]);
          if (evalRes && evalRes.result && evalRes.result.value) {
            const resVal = evalRes.result.value;
            actionTriggered = resVal.action;
            const pendingLang = resVal.pendingLang;
            if (pendingLang && (pendingLang === 'ru' || pendingLang === 'en')) {
              const langFile = path.join(userProfileDir, ".gemini", "antigravity", "antigravity_lang.txt");
              await fs.writeFile(langFile, pendingLang);
              logDebug(`[Localization] Пользователь сменил язык в UI на: ${pendingLang}. Настройка сохранена на диск.`);
            }
          }
        }

        if (actionTriggered) {
          if (actionTriggered === "update") {
            logDebug("[Injector] Получен сигнал на запуск обновления!");
            triggerSelfUpdate();
          } else if (actionTriggered === "restart") {
            logDebug("[Injector] Получен сигнал на перезапуск IDE!");
            const scratchRestartPath = path.join(userProfileDir, ".gemini", "antigravity", "scratch", "restart_app.cmd");
            if (fsSync.existsSync(scratchRestartPath)) {
              require('child_process').exec(`wmic process call create "cmd.exe /c ${scratchRestartPath}"`, { cwd: __dirname });
            }
          }
        }

        // 2.5. Сбор и вывод отладочной информации о DOM
        try {
          const debugEval = await pageRuntime.evaluate({
            expression: `(() => {
              return JSON.stringify({
                elements: window.__antigravity_features_debug_elements || null,
                err: window.__antigravity_features_debug_elements_error || null,
                badgeResult: window.__antigravity_features_badge_result || null
              });
            })()`,
            returnByValue: true
          }).catch(() => null);

          if (debugEval && debugEval.result && debugEval.result.value) {
            const debugData = JSON.parse(debugEval.result.value);
            if (debugData.elements && debugData.elements.length > 0) {
              const debugStr = JSON.stringify(debugData.elements);
              if (global.__last_dom_debug !== debugStr) {
                global.__last_dom_debug = debugStr;
                logDebug(`[Debug DOM] На странице "${page.title}" обнаружены элементы настроек:\n${JSON.stringify(debugData.elements, null, 2)}`);
              }
            }
            if (debugData.err) {
              if (global.__last_dom_err !== debugData.err) {
                global.__last_dom_err = debugData.err;
                logDebug(`[Debug DOM Error] Ошибка рендеринга на странице "${page.title}": ${debugData.err}`);
              }
            }
            if (debugData.badgeResult) {
              if (global.__last_badge_result !== debugData.badgeResult) {
                global.__last_badge_result = debugData.badgeResult;
                logDebug(`[Debug Badge] Результат на странице "${page.title}": ${debugData.badgeResult}`);
              }
            }
          }
        } catch (deErr) {
          logDebug(`[Debug UI] Ошибка сбора отладки: ${deErr.message}`);
        }

        // 2.7. Сбор краш-логов из Chromium-инжектора (window.__antigravity_crash_logs)
        try {
          const crashLogsEval = await pageRuntime.evaluate({
            expression: `(() => {
              const logs = window.__antigravity_crash_logs || [];
              window.__antigravity_crash_logs = [];
              return JSON.stringify(logs);
            })()`,
            returnByValue: true
          }).catch(() => null);

          if (crashLogsEval && crashLogsEval.result && crashLogsEval.result.value) {
            const logs = JSON.parse(crashLogsEval.result.value);
            if (logs.length > 0) {
              const userProfileDir = process.env.USERPROFILE || 'C:\\Users\\wisey';
              const logPath = path.join(userProfileDir, '.gemini', 'antigravity', 'global_health.log');
              
              // Локальный хелпер ротации (чтобы не тянуть зависимости)
              const MAX_LOG_SIZE = 5 * 1024 * 1024;
              const MAX_BACKUPS = 3;
              const rotateLog = (file) => {
                try {
                  if (!fsSync.existsSync(file)) return;
                  const stats = fsSync.statSync(file);
                  if (stats.size < MAX_LOG_SIZE) return;
                  for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
                    const src = `${file}.${i}`;
                    const dest = `${file}.${i + 1}`;
                    if (fsSync.existsSync(src)) fsSync.renameSync(src, dest);
                  }
                  fsSync.renameSync(file, `${file}.1`);
                } catch (_) {}
              };

              rotateLog(logPath);

              for (const log of logs) {
                const logEntry = {
                  timestamp: log.time || new Date().toISOString(),
                  bridge: 'Chromium-Renderer',
                  type: log.type || 'error',
                  message: log.message || log.reason || 'Unknown renderer error',
                  stack: log.stack || '',
                  metadata: {
                    pageTitle: page.title || '',
                    pageUrl: page.url || ''
                  }
                };
                fsSync.appendFileSync(logPath, JSON.stringify(logEntry) + '\n', 'utf8');
                logDebug(`[Chromium-Renderer Error] Caught error: ${logEntry.message}`);
              }
            }
          }
        } catch (crashErr) {
          logDebug(`[Crash Logger] Ошибка сбора логов Chromium: ${crashErr.message}`);
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

// Проверка файла-флага для мгновенного мягкого завершения процесса
const EXIT_TRIGGER_FILE = path.join(userProfileDir, ".gemini", "antigravity", "scratch", "features_exit_trigger.tmp");
const exitCheckInterval = setInterval(() => {
  if (fsSync.existsSync(EXIT_TRIGGER_FILE)) {
    try {
      fsSync.unlinkSync(EXIT_TRIGGER_FILE);
    } catch(e) {}
    logDebug("[Lifecycle] Обнаружен файл-флаг выхода. Мягкое завершение процесса...");
    process.exit(0);
  }
}, 1000);
exitCheckInterval.unref();

// Запускаем инжектор локализации раз в 3 секунды
const uiTimeout = setTimeout(runUIInjection, 1000);
uiTimeout.unref();
const uiInterval = setInterval(runUIInjection, 3000);
uiInterval.unref();

// Запуск проверки обновлений при старте (через 10 секунд)
setTimeout(checkUpdatesBackground, 10000);

// Периодическая проверка обновлений каждые 5 минут
const updatesInterval = setInterval(checkUpdatesBackground, 300000);
updatesInterval.unref();
