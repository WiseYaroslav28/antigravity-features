const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function testAutoAttach() {
    let client;
    try {
        const portFile = "C:\\Users\\wisey\\AppData\\Roaming\\Antigravity\\DevToolsActivePort";
        const content = fs.readFileSync(portFile, "utf8");
        const port = parseInt(content.split("\n")[0], 10);
        
        console.log(`Connecting to port ${port}...`);
        
        // Connect to the first available target
        client = await CDP({ port });
        console.log("Connected to primary target.");
        
        const { Target } = client;
        
        Target.attachedToTarget(async ({sessionId, targetInfo}) => {
            console.log(`\n[ATTACHED] Target Type: ${targetInfo.type}, URL: ${targetInfo.url}`);
            try {
                // We can send commands to this specific sessionId
                const result = await client.send('Runtime.evaluate', {
                    expression: 'document.body.innerText.substring(0, 50)'
                }, sessionId);
                console.log(`[TEXT] ${result.result.value}`);
            } catch (e) {
                console.log(`[ERROR] ${e.message}`);
            }
        });
        
        console.log("Enabling auto-attach...");
        await Target.setAutoAttach({ autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
        
        console.log("Listening for 5 seconds. Please interact with the app (open settings, popups)...");
        await new Promise(r => setTimeout(r, 5000));
        
    } catch (err) {
        console.error(err);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

testAutoAttach();
