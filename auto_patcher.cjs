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
    if (preloadContent.includes(beginMarker)) {
        console.log('[AutoPatcher] Found old preload injection, stripping it...');
        preloadContent = preloadContent.substring(0, preloadContent.indexOf(beginMarker)).trim();
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
    fs.writeFileSync(preloadExtracted, preloadContent + '\n' + injectionCode);

    // --- PATCH UTILS.JS (WINDOW STATE) ---
    const utilsExtracted = path.join(tempDir, 'dist', 'utils.js');
    if (fs.existsSync(utilsExtracted)) {
        let utilsContent = fs.readFileSync(utilsExtracted, 'utf8');
        if (!utilsContent.includes('ANTIGRAVITY WINDOW STATE PATCH')) {
            console.log('[AutoPatcher] Patching utils.js for window state...');
            utilsContent = utilsContent.replace('function createWindow(url) {', `function createWindow(url) {
// ANTIGRAVITY WINDOW STATE PATCH
const fsState = require('fs');
const pathState = require('path');
const stateFile = pathState.join(require('electron').app.getPath('userData'), 'antigravity-window-state.json');
let windowState = {};
try { if (fsState.existsSync(stateFile)) windowState = JSON.parse(fsState.readFileSync(stateFile, 'utf8')); } catch(e){}
`);
            utilsContent = utilsContent.replace('        width: 1400,\n        height: 900,', `        width: windowState.width || 1400,\n        height: windowState.height || 900,\n        x: windowState.x,\n        y: windowState.y,`);
            utilsContent = utilsContent.replace('devTools: !electron_1.app.isPackaged,\n        },\n    });', `devTools: !electron_1.app.isPackaged,\n        },\n    });
    // Restore maximized state and save on close
    if (windowState.isMaximized) win.maximize();
    win.on('close', () => {
        if (!win.isDestroyed()) {
            const bounds = win.getBounds();
            const isMaximized = win.isMaximized();
            fsState.writeFileSync(stateFile, JSON.stringify(Object.assign({}, bounds, { isMaximized })));
        }
    });`);
            fs.writeFileSync(utilsExtracted, utilsContent);
        } else if (!utilsContent.includes("win.on('close'")) {
            console.log('[AutoPatcher] Fixing incomplete utils.js patch...');
            utilsContent = utilsContent.replace('devTools: !electron_1.app.isPackaged,\n        },\n    });', `devTools: !electron_1.app.isPackaged,\n        },\n    });
    // Restore maximized state and save on close
    if (windowState.isMaximized) win.maximize();
    win.on('close', () => {
        if (!win.isDestroyed()) {
            const bounds = win.getBounds();
            const isMaximized = win.isMaximized();
            fsState.writeFileSync(stateFile, JSON.stringify(Object.assign({}, bounds, { isMaximized })));
        }
    });`);
            fs.writeFileSync(utilsExtracted, utilsContent);
        }
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
