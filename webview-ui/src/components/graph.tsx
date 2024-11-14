import { useContext, useEffect, useState } from "react";
import {
  ReactFlow,
  ConnectionLineType,
  Panel,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import dagre from "@dagrejs/dagre";

import "@xyflow/react/dist/style.css";

import DataContext from "../context/dataContext";
import { vscode } from "../vscode";

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

const nodeWidth = 250;
const nodeHeight = 36;

const getLayoutedElements = (nodes: any, edges: any, direction = "TB") => {
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node: any) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge: any) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node: any) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? "left" : "top",
      sourcePosition: isHorizontal ? "right" : "bottom",
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };

    return newNode;
  });

  return { nodes: newNodes, edges };
};

export const Graph = () => {
  const context = useContext(DataContext);
  const { initialNodes, initialEdges } = context;
  const [direc, setDirection] = useState<string>("TB");
  const [nodes, setNodes] = useNodesState<any>([]);
  const [edges, setEdges] = useEdgesState<any>([]);

  useEffect(() => {
    const fn = async () => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            initialNodes,
            initialEdges,
            "TB"
          );
          setDirection("TB");
          setNodes([...layoutedNodes]);
          setEdges([...layoutedEdges]);
          console.log("initialNodes", initialNodes, nodes, layoutedNodes);
    }
    fn();
  }, [context.importModules]);

  const onLayout = (direction: any) => {
    if(direction == direc) return;
      const { nodes: layoutedNodes, edges: layoutedEdges } =
      getLayoutedElements(nodes, edges, direction);
      
      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
      setDirection(direction);
    };
  const onNodeClick = (event: any, node: any) => {
    console.log("click node", node, event);
    vscode.postMessage({
        command: "openFile",
        data: node.data.path,
    })
  };
  console.log(initialEdges, initialNodes);
  console.log(nodes, edges);
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodeClick={onNodeClick}
    //   panOnDrag={false}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      connectionLineType={ConnectionLineType.SmoothStep}
      fitView={true}
    >
      <Panel position="top-right">
        <div className="flex flex-row space-x-2 justify-center items-center"> <VSCodeButton  onClick={() => onLayout("LR")}>
            Refresh
        </VSCodeButton>
        {/* <VSCodeButton  onClick={() => onLayout("TB")}>
          Vertical layout
        </VSCodeButton> */}
        </div>
       
      </Panel>
    </ReactFlow>
  );
};
