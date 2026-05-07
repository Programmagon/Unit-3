import './App.css';
import { useState } from 'react';
import Header from './components/Header';
import Canvas from './components/Canvas';

const CELL_TYPES = {
  empty: { id: 'empty', label: 'Empty', symbol: '', color: '#f8fafc', border: '#d1d5db' },
  cable: { id: 'cable', label: 'Wire', symbol: '╳', color: '#111827', border: '#4b5563' },
  inverse: { id: 'inverse', label: 'Inverse', symbol: '!', color: '#9d174d', border: '#be123c' },
  delay: { id: 'delay', label: 'Delay', symbol: 'D', color: '#1d4ed8', border: '#2563eb' },
};

function createEmptyGrid() {
  return new Map();
}

function App() {
  const [selectedTool, setSelectedTool] = useState('pointer');
  const [selectedCellType, setSelectedCellType] = useState('cable');
  const [grid, setGrid] = useState(createEmptyGrid);

  return (
    <div className='app'>
      <Header
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        selectedCellType={selectedCellType}
        setSelectedCellType={setSelectedCellType}
        cellTypes={CELL_TYPES}
      />
      <Canvas
        selectedTool={selectedTool}
        selectedCellType={selectedCellType}
        grid={grid}
        setGrid={setGrid}
        cellTypes={CELL_TYPES}
      />
    </div>
  );
}

export default App;