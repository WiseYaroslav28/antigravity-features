const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const username = process.env.USERNAME || process.env.USER;
const resourcesDir = path.join('C:', 'Users', username, 'AppData', 'Local', 'Programs', 'Antigravity', 'resources');
const asarPath = path.join(resourcesDir, 'app.asar');
const tempDir = path.join(__dirname, 'temp_asar');
const preloadExtracted = path.join(tempDir, 'dist', 'preload.js');
const localizationFile = path.join(__dirname, 'localization_injected.js');

try {
    // Clean up temp dir if exists
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    // Extract full archive
    console.log('[AutoPatcher] Extracting app.asar...');
    execSync(`npx asar extract "${asarPath}" "${tempDir}"`, { stdio: 'inherit' });

    // --- PATCH PRELOAD.JS ---
    const preloadExtracted = path.join(tempDir, 'dist', 'preload.js');
    let preloadContent = fs.readFileSync(preloadExtracted, 'utf8');

    const beginMarker = '// BEGIN ANTIGRAVITY TRANSLATION INJECTION';
    let originalPreload = preloadContent;
    if (originalPreload.includes(beginMarker)) {
        originalPreload = originalPreload.substring(0, originalPreload.indexOf(beginMarker)).trim();
    }

    const localizationCode = fs.readFileSync(localizationFile, 'utf8');
    const injectionCode = `
// BEGIN ANTIGRAVITY TRANSLATION INJECTION
if (!window.__antigravity_translation_initialized) {
    window.__antigravity_translation_initialized = true;
    try {
        ${localizationCode}
        window.__antigravity_translation_success = true;
    } catch(e) {
        console.error("Localization Error:", e);
    }
}
// END ANTIGRAVITY TRANSLATION INJECTION
`;
    const expectedPreload = originalPreload + '\n' + injectionCode;

    // --- PATCH UTILS.JS (WINDOW STATE) ---
    const utilsExtracted = path.join(tempDir, 'dist', 'utils.js');
    let expectedUtils = null;
    let utilsContent = "";
    if (fs.existsSync(utilsExtracted)) {
        utilsContent = fs.readFileSync(utilsExtracted, 'utf8');
        let tempUtils = utilsContent;
        if (!tempUtils.includes('ANTIGRAVITY WINDOW STATE PATCH')) {
            tempUtils = tempUtils.replace('function createWindow(url) {', `function createWindow(url) {
// ANTIGRAVITY WINDOW STATE PATCH
const fsState = require('fs');
const pathState = require('path');
const stateFile = pathState.join(require('electron').app.getPath('userData'), 'antigravity-window-state.json');
let windowState = {};
try { if (fsState.existsSync(stateFile)) windowState = JSON.parse(fsState.readFileSync(stateFile, 'utf8')); } catch(e){}
`);
            tempUtils = tempUtils.replace('        width: 1400,\n        height: 900,', `        width: windowState.width || 1400,\n        height: windowState.height || 900,\n        x: windowState.x,\n        y: windowState.y,`);
            tempUtils = tempUtils.replace('devTools: !electron_1.app.isPackaged,\n        },\n    });', `devTools: !electron_1.app.isPackaged,\n        },\n    });
    // Restore maximized state and save on close
    if (windowState.isMaximized) win.maximize();
    win.on('close', () => {
        if (!win.isDestroyed()) {
            const bounds = win.getBounds();
            const isMaximized = win.isMaximized();
            fsState.writeFileSync(stateFile, JSON.stringify(Object.assign({}, bounds, { isMaximized })));
        }
    });`);
        } else if (!tempUtils.includes("win.on('close'")) {
            tempUtils = tempUtils.replace('devTools: !electron_1.app.isPackaged,\n        },\n    });', `devTools: !electron_1.app.isPackaged,\n        },\n    });
    // Restore maximized state and save on close
    if (windowState.isMaximized) win.maximize();
    win.on('close', () => {
        if (!win.isDestroyed()) {
            const bounds = win.getBounds();
            const isMaximized = win.isMaximized();
            fsState.writeFileSync(stateFile, JSON.stringify(Object.assign({}, bounds, { isMaximized })));
        }
    });`);
        }
        expectedUtils = tempUtils;
    }

    // Проверяем, изменился ли контент (убирая влияние CRLF/LF на Windows)
    const cleanStr = (str) => str ? str.replace(/\r/g, '').trim() : '';
    const preloadChanged = cleanStr(preloadContent) !== cleanStr(expectedPreload);
    const utilsChanged = expectedUtils !== null && cleanStr(utilsContent) !== cleanStr(expectedUtils);

    if (!preloadChanged && !utilsChanged) {
        console.log('[AutoPatcher] app.asar is already patched and up-to-date.');
        fs.rmSync(tempDir, { recursive: true, force: true });
        process.exit(0); // 0 means patch is already up to date, no restart required
    }

    console.log('[AutoPatcher] Applying patch changes...');
    fs.writeFileSync(preloadExtracted, expectedPreload);
    if (expectedUtils !== null) {
        fs.writeFileSync(utilsExtracted, expectedUtils);
    }

    console.log('[AutoPatcher] Packing new ASAR...');
    const patchedAsar = path.join(__dirname, 'app.asar.patched');
    execSync(`npx asar pack "${tempDir}" "${patchedAsar}"`, { stdio: 'inherit' });

    // Clean up extracted files
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('[AutoPatcher] Patch created successfully at', patchedAsar);
    process.exit(1); // 1 means patch created, restart required

} catch (err) {
    console.error('[AutoPatcher] Critical Error:', err.message);
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    process.exit(2); // Error
}
