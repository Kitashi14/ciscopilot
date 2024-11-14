import  { useContext } from 'react';
import { Canvas } from 'reaflow';
import DataContext from '../context/dataContext';

export const Graph2 = () => {
    const context = useContext(DataContext);
    const { initialNodes, initialEdges } = context;
    const nodes = initialNodes.map((node: any) => {
        return {
            id: node.id,
            text: node.data.label,
        }
    });
    const edges = initialEdges.map((edge: any) => {
        return {
            id: edge.id,
            from: edge.source,
            to: edge.target,
        }
    });
    console.log(nodes, edges);
    return(
        <div style={{
            border: 'solid 1px #12131e',
            height: 500,
            width: 700
          }}>
            <style>
      {`
        body #root > div {
          background-color: white;
          background-image: -webkit-repeating-radial-gradient(top center,rgba(0,0,0,.2),rgba(0,0,0,.2) 1px,transparent 0,transparent 100%);
        }
        .edge {
          stroke: #b1b1b7;
          stroke-dasharray: 5;
          animation: dashdraw .5s linear infinite;
          stroke-width: 1;
        }
        @keyframes dashdraw {
          0% { stroke-dashoffset: 10; }
        }
      `}
    </style>
        <Canvas className="canvas"
        animated={false}
            nodes={nodes}
            edges={edges}
            direction="RIGHT"
            onLayoutChange={layout => console.log('Layout', layout)}
        />
        </div>
    )
};