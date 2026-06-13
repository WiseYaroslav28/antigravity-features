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
  const { Page } = client;
  
  await Page.enable();
  
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
