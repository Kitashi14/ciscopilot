import { vscode } from "./vscode";
import { useEffect, useState } from "react";

function App() {
  const [importModules, setImportModules] = useState();
  useEffect(() => {
    vscode.postMessage({
      command: "ready",
    });

    // Handle the message inside the webview
    window.addEventListener('message', event => {

      const message = event.data; // The JSON data our extension sent

      switch (message.command) {
          case 'showImportModules':
              console.log('showImportModules',message.data);
              setImportModules(message.data);
              console.log(importModules);
              break;
      }
  });
  }, []);

  return (
    <div className="h-screen  flex flex-col  items-center p-10 gap-5">
      Hello
    </div>
  );
}

export default App;
