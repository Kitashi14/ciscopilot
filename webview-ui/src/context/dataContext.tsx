import { createContext, useEffect, useState } from "react";
import { vscode } from "../vscode";

const DataContext = createContext({
  initialEdges: [],
  initialNodes: [],
  importModules: null,
});

export const DataContextProvider = (props: any) => {
  const [initialNodes, setInitialNodes] = useState<any>([]);
  const [initialEdges, setInitialEdges] = useState<any>([]);

  const position = { x: 0, y: 0 };
  const edgeType = "smoothstep";

  const fillGraphData = (currNode: any, nodes: any[], edges: any[])=>{
        if(!currNode.isUserDefined) return;
        console.log(currNode, nodes, edges);
        const sourceId = nodes.length;
        const len = currNode.childImports.length;
        for(let i=0; i<len; i++){
            const child = currNode.childImports[i];
            nodes.push({
                id: nodes.length + 1,
                input: child.isUserDefined && child.childImports.length? 'default': 'output',
                data: { label: child.moduleFileName, path: child.moduleFilePath},
                position,
                style: {
                    background: child.isUserDefined? "#1d4ed8": "#737373",
                    color: "#fff"
                }
            });
            edges.push({
                id: `e${edges.length + 1}`,
                source: sourceId,
                target: nodes.length,
                type: edgeType,
                animated: true,
                
            });
            fillGraphData(child, nodes, edges);
        }
        return;
  }

  const [importModules, setImportModules] = useState<any>(null);
  useEffect(() => {
    vscode.postMessage({
      command: "ready",
    });

    // Handle the message inside the webview
    window.addEventListener("message", (event) => {
      const message = event.data; // The JSON data our extension sent

      switch (message.command) {
        case "showImportModules":
          console.log("showImportModules", message.data);
          setImportModules(message.data);
          if(message.data){
            var nodes: any[] = [];
            var edges: any[] = [];
            nodes.push({
                id: 1,
                data: { label: message.data.rootFile.rootFileName, path: message.data.rootFile.rootPath},
                type: 'input',
                position,
                style: {
                    background: "#7e22ce",
                    color: "#fff"
                }
            });
            fillGraphData({
                isUserDefined: true,
                childImports: message.data.allImports,
            }, nodes, edges);
            setInitialNodes(nodes);
            setInitialEdges(edges);
            console.log(nodes,edges);
          }
         
          break;
      }
    });
  }, []);
  console.log(importModules);
  const context = {
    initialEdges,
    initialNodes,
    importModules,
  };

    return (
        <DataContext.Provider value={context}>{props.children}</DataContext.Provider>
    );
};

export default DataContext;
