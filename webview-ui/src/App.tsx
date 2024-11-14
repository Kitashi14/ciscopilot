
import { Graph } from "./components/graph";

function App() {

  return (
    <div className="h-screen  flex flex-col  items-center p-10 gap-5">
      <div className="font-semibold text-lg">Import Tree</div>
      <Graph/>
    </div>
  );
}

export default App;
