"use client";

import { CornerRightUp, MousePointer, Square, Plug, Plus, FileText, Image, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useAutoResizeTextarea } from "@/components/hooks/use-auto-resize-textarea";

interface AIInputProps {
  id?: string
  placeholder?: string
  minHeight?: number
  maxHeight?: number
  onSubmit?: (value: string, files?: File[], images?: string[]) => void
  className?: string
  onGlobeClick?: () => void
  isGlobeActive?: boolean
  currentTabTitle?: string
  currentTabFavicon?: string
  currentTabStatus?: string
  onCancel?: () => void
  showCancel?: boolean
  onAttachClick?: () => void
  inputValue?: string
  onInputValueChange?: (value: string) => void
}

export function AIInput({
  id = "ai-input",
  placeholder = "Type your message...",
  minHeight = 48,
  maxHeight = 200,
  onSubmit,
  className,
  onGlobeClick,
  isGlobeActive = false,
  currentTabTitle,
  currentTabFavicon,
  currentTabStatus,
  onCancel,
  showCancel = false,
  onAttachClick,
  inputValue: externalInputValue,
  onInputValueChange
}: AIInputProps) {
  const { textareaRef, adjustHeight, resetHeight } = useAutoResizeTextarea({
    minHeight,
    maxHeight,
  });
  const [internalInputValue, setInternalInputValue] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  
  const inputValue = externalInputValue !== undefined ? externalInputValue : internalInputValue;
  
  // Convert file to data URL
  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Process dropped files
  const processFiles = async (files: FileList) => {
    console.log('processFiles called with:', files.length, 'files');
    const MAX_IMAGES_PER_MESSAGE = 5;
    const imageFiles: File[] = [];
    const otherFiles: File[] = [];

    // Separate image files from other files
    Array.from(files).forEach(file => {
      console.log('Processing file:', file.name, file.type);
      if (file.type.startsWith('image/')) {
        imageFiles.push(file);
      } else {
        otherFiles.push(file);
      }
    });

    console.log('Image files:', imageFiles.length, 'Other files:', otherFiles.length);

    // Add other files to attachedFiles
    if (otherFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...otherFiles]);
    }

    // Process image files (limit to 5)
    if (imageFiles.length > 0) {
      const limitedImages = imageFiles.slice(0, MAX_IMAGES_PER_MESSAGE);
      const dataURLs = await Promise.all(limitedImages.map(fileToDataURL));
      console.log('Created data URLs:', dataURLs.length);
      setSelectedImages(prev => [...prev, ...dataURLs]);
    }
  };

  const handleReset = () => {
    console.log('handleReset called with:', { inputValue, attachedFiles: attachedFiles.length, selectedImages: selectedImages.length });
    if (!inputValue.trim() && attachedFiles.length === 0 && selectedImages.length === 0) return;
    onSubmit?.(inputValue, attachedFiles, selectedImages);
    if (externalInputValue !== undefined) {
      onInputValueChange?.("");
    } else {
      setInternalInputValue("");
    }
    setAttachedFiles([]);
    setSelectedImages([]);
    resetHeight();
  };

  const handleGlobeClick = () => {
    onGlobeClick?.();
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    console.log('Drag over detected');
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    console.log('Drag leave detected');
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    console.log('Drop detected with files:', e.dataTransfer.files.length);
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFiles(files);
    }
  };

  // Paste handler
  const handlePaste = async (e: React.ClipboardEvent) => {
    console.log('Paste detected');
    const items = e.clipboardData.items;
    const files: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          // Check if it's an image or PDF
          if (file.type.startsWith('image/') || file.type === 'application/pdf') {
            files.push(file);
          }
        }
      }
    }
    
    if (files.length > 0) {
      console.log('Paste files found:', files.length);
      setIsPasting(true);
      try {
        await processFiles(files as any);
      } finally {
        setIsPasting(false);
      }
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [inputValue]);

  return (
    <div className={cn("w-full py-3", className)}>
      <div 
        className={cn(
          "relative max-w-xl w-full mx-auto bg-black/5 dark:bg-white/5 rounded-3xl p-2 transition-colors",
          isDragOver && "bg-blue-500/10 border-2 border-blue-500 border-dashed",
          isPasting && "bg-green-500/10 border-2 border-green-500 border-dashed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <textarea
          id={id}
          placeholder={placeholder}
          className="w-full bg-transparent text-black dark:text-white border-none outline-none resize-none pl-2 pr-2 ai-input-textarea"
          style={{
            height: '18px',
            paddingTop: '9px',
            paddingBottom: '9px',
            lineHeight: '1.2',
            fontSize: '16px',
            overflowY: 'auto'
          }}
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => {
            if (externalInputValue !== undefined) {
              onInputValueChange?.(e.target.value);
            } else {
              setInternalInputValue(e.target.value);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleReset();
            }
          }}
          onPaste={handlePaste}
        />

        {/* Plus button, Agent button, and file attachments */}
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className="w-8 h-8 bg-black/8 dark:bg-white/8 rounded-full hover:bg-black/12 dark:hover:bg-white/12 transition-colors flex items-center justify-center"
              onClick={(e) => {
                // Show dropdown with options
                const dropdown = document.createElement('div');
                dropdown.className = 'absolute bottom-full left-0 mb-2 bg-black/8 dark:bg-white/8 rounded-lg shadow-lg border border-black/10 dark:border-white/10 z-50 backdrop-blur-sm';
                dropdown.innerHTML = `
                  <div class="py-1">
                    <button class="w-full px-4 py-2 text-left text-sm hover:bg-black/12 dark:hover:bg-white/12 flex items-center gap-2 text-black/70 dark:text-white/70" data-action="document">
                      <svg class="w-4 h-4 text-black/70 dark:text-white/70" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"></path></svg>
                      Add Document
                    </button>
                    <button class="w-full px-4 py-2 text-left text-sm hover:bg-black/12 dark:hover:bg-white/12 flex items-center gap-2 text-black/70 dark:text-white/70" data-action="image">
                      <svg class="w-4 h-4 text-black/70 dark:text-white/70" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path></svg>
                      Add Image
                    </button>
                  </div>
                `;
                
                // Create hidden file inputs
                const docInput = document.createElement('input');
                docInput.type = 'file';
                docInput.accept = '.pdf,.doc,.docx,.txt';
                docInput.multiple = true;
                docInput.style.display = 'none';
                
                const imgInput = document.createElement('input');
                imgInput.type = 'file';
                imgInput.accept = '.png,.jpg,.jpeg,.gif,.webp';
                imgInput.multiple = true;
                imgInput.style.display = 'none';
                
                // Handle file selection
                docInput.onchange = async (fileEvent) => {
                  const files = (fileEvent.target as HTMLInputElement).files;
                  if (files) {
                    await processFiles(files);
                  }
                };
                
                imgInput.onchange = async (fileEvent) => {
                  const files = (fileEvent.target as HTMLInputElement).files;
                  if (files) {
                    await processFiles(files);
                  }
                };
                
                document.body.appendChild(docInput);
                document.body.appendChild(imgInput);
                
                // Position dropdown
                const button = e.currentTarget;
                const rect = button.getBoundingClientRect();
                dropdown.style.left = rect.left + 'px';
                dropdown.style.bottom = (window.innerHeight - rect.top) + 'px';
                
                document.body.appendChild(dropdown);
                
                // Handle dropdown clicks
                dropdown.addEventListener('click', (dropdownEvent) => {
                  const target = dropdownEvent.target as HTMLElement;
                  const action = target.getAttribute('data-action');
                  dropdown.remove();
                  
                  if (action === 'document') {
                    docInput.click();
                  } else if (action === 'image') {
                    imgInput.click();
                  }
                });
                
                // Remove dropdown when clicking outside
                setTimeout(() => {
                  document.addEventListener('click', () => {
                    dropdown.remove();
                  }, { once: true });
                }, 100);
              }}
            >
              <Plus className="w-4 h-4 text-black/70 dark:text-white/70" />
            </button>
            
            {/* Agent button like before */}
            <button
              onClick={handleGlobeClick}
              className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-lg transition-all duration-200",
                isGlobeActive ? "bg-blue-500/10 text-blue-500" : "bg-black/8 dark:bg-white/8 text-black/70 dark:text-white/70"
              )}
            >
              <MousePointer className="w-4 h-4" />
              <span className="text-sm">Agent</span>
            </button>
            
            {/* Show attached files with previews */}
            {attachedFiles.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {attachedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-1 bg-black/8 dark:bg-white/8 px-2 py-1 rounded text-xs max-w-24">
                    <FileText className="w-4 h-4 text-black/70 dark:text-white/70" />
                    <span className="truncate text-black/70 dark:text-white/70">
                      {file.name.length > 8 ? file.name.substring(0, 8) + '...' : file.name}
                    </span>
                    <button
                      onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
                      className="text-black/50 dark:text-white/50 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Show image thumbnails */}
            {selectedImages.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {selectedImages.map((dataURL, index) => (
                  <div key={index} className="flex items-center gap-1 bg-black/8 dark:bg-white/8 px-2 py-1 rounded text-xs max-w-24">
                    <img 
                      src={dataURL} 
                      alt={`Image ${index + 1}`}
                      className="w-4 h-4 object-cover rounded"
                    />
                    <span className="truncate text-black/70 dark:text-white/70">
                      Image {index + 1}
                    </span>
                    <button
                      onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                      className="text-black/50 dark:text-white/50 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Small tab on the right side when connected */}
        {isGlobeActive && (
          <div className="absolute -top-8 right-4 bg-black/5 dark:bg-white/5 rounded-t-lg px-3 py-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              {currentTabTitle ? (
                <>
                  {(currentTabStatus === 'detached' || currentTabStatus === 'error' || currentTabStatus === 'unknown') && (
                    <button
                      onClick={onAttachClick}
                      className="text-black/70 dark:text-white/70 hover:text-blue-500 transition-colors"
                      title="Reconnect to current tab"
                    >
                      <Plug className="w-3 h-3" />
                    </button>
                  )}
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                    currentTabStatus === 'attached' ? 'bg-green-500 animate-pulse' : 
                    currentTabStatus === 'detached' ? 'bg-red-500' : 
                    currentTabStatus === 'running' ? 'bg-blue-500 animate-pulse' :
                    currentTabStatus === 'idle' ? 'bg-green-500' :
                    currentTabStatus === 'error' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'
                  )}></div>
                  {currentTabFavicon && (
                    <img 
                      src={currentTabFavicon} 
                      alt="Site favicon" 
                      className="w-3 h-3 flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <span className="text-black/70 dark:text-white/70 truncate max-w-28">
                    {currentTabTitle}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Globe button */}
        {/* Globe button hidden */}
        
        {/* Cancel button */}
        {showCancel && (
          <button
            onClick={onCancel}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 rounded-xl bg-red-500/10 hover:bg-red-500/20 py-1 px-1 transition-all duration-200",
              inputValue ? "right-10" : "right-6"
            )}
          >
            <Square className="w-4 h-4 text-red-600" />
          </button>
        )}
        
        {/* Submit button */}
        <button
          onClick={handleReset}
          type="button"
          className={cn(
            "absolute top-1/2 -translate-y-1/2 right-3",
            "rounded-xl bg-black/5 dark:bg-white/5 py-1 px-1",
            "transition-all duration-200",
            inputValue 
              ? "opacity-100 scale-100" 
              : "opacity-0 scale-95 pointer-events-none"
          )}
        >
          <CornerRightUp className="w-4 h-4 text-black/70 dark:text-white/70" />
        </button>
      </div>
    </div>
  );
}