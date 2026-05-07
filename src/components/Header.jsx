import Divider from './Divider';
import { DownloadIcon, UploadIcon, MousePointer2Icon, PenIcon } from 'lucide-react';

export default function Header({ selectedTool, setSelectedTool, selectedCellType, setSelectedCellType, cellTypes }) {

  const handlePointerClick = () => setSelectedTool('pointer');
  const handlePenClick = () => setSelectedTool('pen');

  return (
    <header className='header'>
      <input type='text' placeholder='Project name' className='project-name' />
      <button className='icon-button'>
        <DownloadIcon strokeWidth={2} />
      </button>
      <button className='icon-button'>
        <UploadIcon />
      </button>
      <Divider />
      <button className={`icon-button ${selectedTool === 'pointer' ? 'active' : ''}`} onClick={handlePointerClick}>
        <MousePointer2Icon />
      </button>
      <button className={`icon-button ${selectedTool === 'pen' ? 'active' : ''}`} onClick={handlePenClick}>
        <PenIcon />
      </button>
      {selectedTool === 'pen' && (
        <div className='pen-toolbar'>
          {Object.values(cellTypes)
            .filter((type) => type.id !== 'empty')
            .map((type) => (
              <button
                key={type.id}
                type='button'
                className={`cell-type ${selectedCellType === type.id ? 'active' : ''}`}
                style={{ borderColor: type.border }}
                onClick={() => setSelectedCellType(type.id)}
              >
                {type.symbol || type.label[0]}
              </button>
            ))}
        </div>
      )}
    </header >
  );
}