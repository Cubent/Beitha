import React, { useRef, useState, useEffect } from 'react';
import { MemoryService } from '../../tracking/memoryService';

interface InlineMemoryManagementProps {
  onClose: () => void;
}

export const InlineMemoryManagement: React.FC<InlineMemoryManagementProps> = ({ onClose }) => {
  const [memoryCount, setMemoryCount] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load memory count
  const loadMemoryCount = async () => {
    try {
      const memoryService = MemoryService.getInstance();
      await memoryService.init();
      const memories = await memoryService.getAllMemories();
      setMemoryCount(memories.length);
    } catch (error) {
      console.error('Error loading memory count:', error);
    }
  };

  // Export memories function
  const handleExportMemories = async () => {
    try {
      setExportStatus('Exporting...');
      const memoryService = MemoryService.getInstance();
      await memoryService.init();
      const memories = await memoryService.getAllMemories();
      
      const jsonData = JSON.stringify(memories, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const date = new Date().toISOString().split('T')[0];
      const filename = `browserbee-memories-${date}.json`;
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setExportStatus(`Successfully exported ${memories.length} memories!`);
      setTimeout(() => setExportStatus(''), 3000);
    } catch (error) {
      setExportStatus(`Error exporting memories: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Import memories function
  const handleImportMemories = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      
      setImportStatus('Importing...');
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const memories = JSON.parse(content);
          
          if (!Array.isArray(memories)) {
            throw new Error('Invalid format: Expected an array of memories');
          }
          
          const memoryService = MemoryService.getInstance();
          await memoryService.init();
          
          let importedCount = 0;
          for (const memory of memories) {
            if (!memory.domain || !memory.taskDescription || !memory.toolSequence) {
              console.warn('Skipping invalid memory:', memory);
              continue;
            }
            
            if (!memory.createdAt) {
              memory.createdAt = Date.now();
            }
            
            await memoryService.storeMemory(memory);
            importedCount++;
          }
          
          await loadMemoryCount();
          
          setImportStatus(`Successfully imported ${importedCount} memories!`);
          setTimeout(() => setImportStatus(''), 3000);
          
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } catch (error) {
          setImportStatus(`Error parsing import file: ${error instanceof Error ? error.message : String(error)}`);
        }
      };
      
      reader.readAsText(file);
    } catch (error) {
      setImportStatus(`Error importing memories: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Trigger file input click
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  useEffect(() => {
    loadMemoryCount();
  }, []);

  return (
    <div className="flex flex-col h-screen p-4 bg-white" style={{ border: 'none', outline: 'none' }}>
      {/* Thin header with close button */}
      <header className="mb-1 py-1 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-900">Memory Management</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg font-bold"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </header>
      
      <div className="flex-1 overflow-auto p-3 bg-white scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#d1d5db #f3f4f6'
      }}>
        <p className="text-gray-700 mb-4 text-sm">
          Beitha stores memories of successful interactions with websites to help improve future interactions. You can export these memories for backup or transfer to another device, and import them back later.
        </p>
        
        <div className="flex items-center mb-4">
          <span className="font-medium mr-2 text-gray-900 text-sm">Current memories:</span>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-sm">{memoryCount}</span>
        </div>
        
        <div className="flex flex-wrap gap-3 mb-4">
          <button 
            onClick={handleExportMemories} 
            className="px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            disabled={memoryCount === 0}
          >
            Export Memories
          </button>
          
          <button 
            onClick={triggerFileInput} 
            className="px-3 py-1.5 bg-gray-200 text-gray-900 rounded hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            Import Memories
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportMemories}
            accept=".json"
            className="hidden"
          />
        </div>
        
        {exportStatus && (
          <div className={`px-3 py-2 rounded text-sm mb-2 ${
            exportStatus.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}>
            {exportStatus}
          </div>
        )}
        
        {importStatus && (
          <div className={`px-3 py-2 rounded text-sm ${
            importStatus.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}>
            {importStatus}
          </div>
        )}
      </div>
    </div>
  );
};

