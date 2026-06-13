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
  
  // Ловим все необработанные исключения в браузере
  client.on('Runtime.exceptionThrown', (params) => {
    console.log(`[Exception]`, params.exceptionDetails.exception.description || params.exceptionDetails.text);
    if (params.exceptionDetails.stackTrace) {
      console.log("Stack:");
      params.exceptionDetails.stackTrace.callFrames.forEach(f => {
        console.log(`  at ${f.functionName} (${f.url}:${f.lineNumber}:${f.columnNumber})`);
      });
    }
  });
  
  client.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error' || params.type === 'warning') {
      console.log(`[Console ${params.type}]`, params.args.map(a => a.value || a.description).join(' '));
    }
  });
  
  console.log("Listening for exceptions for 10 seconds...");
  
  // Перезагрузим страницу, чтобы спровоцировать инжекцию при старте
  await Runtime.evaluate({ expression: "window.location.reload()" });
  
  setTimeout(async () => {
    await client.close();
    console.log("Done.");
  }, 10000);
  
}).catch(err => {
  console.error(err);
});
