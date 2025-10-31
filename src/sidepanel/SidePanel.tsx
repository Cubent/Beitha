import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBrain, faTrash, faQuestion, faCog } from '@fortawesome/free-solid-svg-icons';
import { ConfigManager } from '../background/configManager';
import { TokenTrackingService } from '../tracking/tokenTrackingService';
import { ApprovalRequest } from './components/ApprovalRequest';
import { MessageDisplay } from './components/MessageDisplay';
import { OutputHeader } from './components/OutputHeader';
import { PromptForm } from './components/PromptForm';
import { ProviderSelector } from './components/ProviderSelector';
import { TabStatusBar } from './components/TabStatusBar';
import { TokenUsageDisplay } from './components/TokenUsageDisplay';
import { extractTextFromPDF, formatPDFResult, PDFProcessingResult } from '../utils/pdfProcessor';
import { WelcomeScreen } from './components/WelcomeScreen';
import { InlineMemoryManagement } from './components/InlineMemoryManagement';
import { useChromeMessaging } from './hooks/useChromeMessaging';
import { useMessageManagement } from './hooks/useMessageManagement';
import { useTabManagement } from './hooks/useTabManagement';

export function SidePanel() {
  // State for tab status
  const [tabStatus, setTabStatus] = useState<'attached' | 'detached' | 'unknown' | 'running' | 'idle' | 'error'>('unknown');
  
  // State for mode switch (Ask vs Do) - load from storage
  const [mode, setMode] = useState<'ask' | 'do'>('do');
  
  // State for globe functionality - active when in Do mode
  const [isGlobeActive, setIsGlobeActive] = useState(true); // Start in Do mode

  // State for approval requests
  const [approvalRequests, setApprovalRequests] = useState<Array<{
    requestId: string;
    toolName: string;
    toolInput: string;
    reason: string;
  }>>([]);

  // State to track if any LLM providers are configured
  const [hasConfiguredProviders, setHasConfiguredProviders] = useState<boolean>(false);

  // State for input value to handle welcome screen prompts
  const [inputValue, setInputValue] = useState<string>('');
  
  // State for tab favicon
  const [tabFavicon, setTabFavicon] = useState<string>('');
  
  // State for showing memory management inline
  const [showMemoryManagement, setShowMemoryManagement] = useState<boolean>(false);

  // Load saved mode from storage when component mounts
  useEffect(() => {
    const loadSavedMode = async () => {
      try {
        const result = await chrome.storage.local.get(['browserbee_mode']);
        if (result.browserbee_mode) {
          setMode(result.browserbee_mode);
          setIsGlobeActive(result.browserbee_mode === 'do');
        }
      } catch (error) {
        console.error('Error loading saved mode:', error);
      }
    };

    loadSavedMode();
  }, []);

  // Check if any providers are configured when component mounts
  useEffect(() => {
    const checkProviders = async () => {
      const configManager = ConfigManager.getInstance();
      const providers = await configManager.getConfiguredProviders();
      setHasConfiguredProviders(providers.length > 0);
    };

    checkProviders();

    // Listen for provider configuration changes
    const handleMessage = (message: any) => {
      if (message.action === 'providerConfigChanged') {
        checkProviders();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // Use custom hooks to manage state and functionality
  const {
    tabId,
    windowId,
    tabTitle,
    setTabTitle
  } = useTabManagement(mode);

  // Fetch favicon when tabId changes
  useEffect(() => {
    if (!tabId) return;
    
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting tab for favicon:', chrome.runtime.lastError);
        return;
      }
      
      if (tab && tab.favIconUrl) {
        setTabFavicon(tab.favIconUrl);
      } else {
        setTabFavicon('');
      }
    });
  }, [tabId]);

  const {
    messages,
    streamingSegments,
    isStreaming,
    isProcessing,
    setIsProcessing,
    outputRef,
    addMessage,
    addSystemMessage,
    updateStreamingChunk,
    startStreaming,
    finalizeStreamingSegment,
    startNewSegment,
    completeStreaming,
    clearMessages,
    currentSegmentId
  } = useMessageManagement();

  // Heartbeat interval for checking agent status
  useEffect(() => {
    if (!isProcessing) return;

    const interval = setInterval(() => {
      // Request agent status
      chrome.runtime.sendMessage({
        action: 'checkAgentStatus',
        tabId,
        windowId
      });
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, [isProcessing, tabId, windowId]);

  // Handlers for approval requests
  const handleApprove = (requestId: string) => {
    // Send approval to the background script
    approveRequest(requestId);
    // Remove the request from the list
    setApprovalRequests(prev => prev.filter(req => req.requestId !== requestId));
    // Add a system message to indicate approval
    addSystemMessage(`✅ Approved action: ${requestId}`);
  };

  const handleReject = (requestId: string) => {
    // Send rejection to the background script
    rejectRequest(requestId);
    // Remove the request from the list
    setApprovalRequests(prev => prev.filter(req => req.requestId !== requestId));
    // Add a system message to indicate rejection
    addSystemMessage(`❌ Rejected action: ${requestId}`);
  };

  // Set up Chrome messaging with callbacks
  const {
    executePrompt,
    cancelExecution,
    clearHistory,
    approveRequest,
    rejectRequest
  } = useChromeMessaging({
    tabId,
    windowId,
    onUpdateOutput: (content) => {
      addMessage({ ...content, isComplete: true });
    },
    onUpdateStreamingChunk: (content) => {
      updateStreamingChunk(content.content);
    },
    onFinalizeStreamingSegment: (id, content) => {
      finalizeStreamingSegment(id, content);
    },
    onStartNewSegment: (id) => {
      startNewSegment(id);
    },
    onStreamingComplete: () => {
      completeStreaming();
    },
    onSetPrompt: (prompt: string) => {
      setInputValue(prompt);
    },
    onUpdateLlmOutput: (content) => {
      addMessage({ type: 'llm', content, isComplete: true });
    },
    onRateLimit: () => {
      addSystemMessage("⚠️ Rate limit reached. Retrying automatically...");
      // Ensure the UI stays in processing mode
      setIsProcessing(true);
      // Update the tab status to running
      setTabStatus('running');
    },
    onFallbackStarted: (message) => {
      addSystemMessage(message);
      // Ensure the UI stays in processing mode
      setIsProcessing(true);
      // Update the tab status to running
      setTabStatus('running');
    },
    onUpdateScreenshot: (content) => {
      addMessage({ ...content, isComplete: true });
    },
    onProcessingComplete: () => {
      setIsProcessing(false);
      completeStreaming();
      // Also update the tab status to idle to ensure the UI indicator changes
      setTabStatus('idle');
    },
    onRequestApproval: (request) => {
      // Add the request to the list
      setApprovalRequests(prev => [...prev, request]);
    },
    setTabTitle,
    // New event handlers for tab events
    onTabStatusChanged: (status, _tabId) => {
      // Update the tab status state
      setTabStatus(status);
    },
    onTargetChanged: (_tabId, _url) => {
      // We don't need to do anything here as TabStatusBar handles this
    },
    onActiveTabChanged: (oldTabId, newTabId, title, url) => {
      // Update the tab title when the agent switches tabs
      console.log(`SidePanel: Active tab changed from ${oldTabId} to ${newTabId}`);
      setTabTitle(title);

      // Add a system message to indicate the tab change
      addSystemMessage(`Switched to tab: ${title} (${url})`);
    },
    onPageDialog: (tabId, dialogInfo) => {
      // Add a system message about the dialog
      addSystemMessage(`📢 Dialog: ${dialogInfo.type} - ${dialogInfo.message}`);
    },
    onPageError: (tabId, error) => {
      // Add a system message about the error
      addSystemMessage(`❌ Page Error: ${error}`);
    },
    onAgentStatusUpdate: (status, lastHeartbeat) => {
      // Log agent status updates for debugging
      console.log(`Agent status update: ${status}, lastHeartbeat: ${lastHeartbeat}, diff: ${Date.now() - lastHeartbeat}ms`);

      // Update the tab status based on agent status
      if (status === 'running' || status === 'idle' || status === 'error') {
        setTabStatus(status);
      }

      // If agent is running, ensure UI is in processing mode
      if (status === 'running') {
        setIsProcessing(true);
      }

      // If agent is idle, ensure UI is not in processing mode
      if (status === 'idle') {
        setIsProcessing(false);
      }
    }
  });

  // Function to compress images to fit Chrome extension limits
  const compressImages = async (imageData: { type: string; source: { type: string; media_type: string; data: string } }[], targetSizeBytes: number) => {
    const compressedImages = [];
    
    for (const img of imageData) {
      let compressedData = img.source.data;
      let quality = 0.8; // Start with 80% quality
      
      // Keep compressing until we're under the target size
      while (compressedData.length > targetSizeBytes / imageData.length && quality > 0.1) {
        try {
          // Create a canvas to compress the image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const imgElement = new Image();
          
          await new Promise((resolve, reject) => {
            imgElement.onload = () => {
              // Calculate new dimensions (reduce by 10% each iteration)
              const scale = Math.sqrt(targetSizeBytes / imageData.length / (imgElement.width * imgElement.height * 4));
              canvas.width = Math.max(100, imgElement.width * scale);
              canvas.height = Math.max(100, imgElement.height * scale);
              
              // Draw and compress
              ctx?.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
              const compressedBase64 = canvas.toDataURL(img.source.media_type, quality).split(',')[1];
              compressedData = compressedBase64;
              resolve(compressedBase64);
            };
            imgElement.onerror = reject;
            imgElement.src = `data:${img.source.media_type};base64,${img.source.data}`;
          });
          
          quality -= 0.1; // Reduce quality for next iteration
        } catch (error) {
          console.error('Error compressing image:', error);
          break;
        }
      }
      
      compressedImages.push({
        ...img,
        source: {
          ...img.source,
          data: compressedData
        }
      });
    }
    
    return compressedImages;
  };

  // Handle form submission
  const handleSubmit = async (prompt: string, files?: File[], images?: string[]) => {
    console.log('handleSubmit received:', { prompt, files: files?.length, images: images?.length });
    setIsProcessing(true);
    startStreaming(); // Start streaming immediately
    // Update the tab status to running
    setTabStatus('running');

    // Add user message to the chat with file info
    let messageContent = prompt;
    if (files && files.length > 0) {
      const fileNames = files.map(f => f.name).join(', ');
      messageContent += `\n\n[Attached files: ${fileNames}]`;
    }
    if (images && images.length > 0) {
      messageContent += `\n\n[Attached images: ${images.length} image(s)]`;
    }
    addMessage({ type: 'user', content: messageContent, attachedFiles: files, images: images });

    // Process files if any
    let fileContents = '';
    let hasImages = false;
    let imageData: { type: string; source: { type: string; media_type: string; data: string } }[] = [];
    
    // Gemini 2.5 Flash limits
    const MAX_IMAGES = 3000;
    const MAX_IMAGE_SIZE = 7 * 1024 * 1024; // 7MB in bytes
    const SUPPORTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

    // Process images from data URLs (drag & drop images) - Convert to Anthropic image block format
    if (images && images.length > 0) {
      hasImages = true;
      
      // Validate image count (max 5 per message as per architecture)
      const MAX_IMAGES_PER_MESSAGE = 5;
      const limitedImages = images.slice(0, MAX_IMAGES_PER_MESSAGE);
      
      for (let index = 0; index < limitedImages.length; index++) {
        const dataURL = limitedImages[index];
        try {
          // Parse data URL to get MIME type and base64 data
          const [header, base64Data] = dataURL.split(',');
          const mimeType = header.match(/data:([^;]+)/)?.[1];
          
          if (!mimeType || !SUPPORTED_MIME_TYPES.includes(mimeType)) {
            console.warn(`Unsupported image type: ${mimeType}`);
            continue;
          }

          // Calculate size from base64 data
          const sizeInBytes = (base64Data.length * 3) / 4;
          if (sizeInBytes > MAX_IMAGE_SIZE) {
            console.warn(`Image too large: ${sizeInBytes} bytes. Maximum allowed: ${MAX_IMAGE_SIZE} bytes`);
            continue;
          }

          // Calculate estimated tokens for image (square root formula with 1.5x fudge factor)
          const estimatedTokens = Math.ceil(Math.sqrt(sizeInBytes) * 1.5);

          // Convert to Anthropic image block format
          imageData.push({
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: base64Data
            }
          });
        } catch (error) {
          console.error('Error processing image data URL:', error);
        }
      }
    }
    
    if (files && files.length > 0) {
      // Validate file counts
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      const pdfFiles = files.filter(f => f.type === 'application/pdf');
      
      if (imageFiles.length > MAX_IMAGES) {
        addSystemMessage(`Error: Maximum ${MAX_IMAGES} images allowed per request. You uploaded ${imageFiles.length} images.`);
        return;
      }
      
      if (pdfFiles.length > 3) {
        addSystemMessage(`Error: Maximum 3 PDF files allowed per request. You uploaded ${pdfFiles.length} PDFs.`);
        return;
      }
      
      for (const file of files) {
        try {
          if (file.type === 'application/pdf') {
            // Process PDF file silently
            const pdfResult = await extractTextFromPDF(file, 25000);
            
            if (!pdfResult.success) {
              addSystemMessage(`❌ ${pdfResult.error}`);
              continue; // Skip this file and continue with others
            }
            
            // Add the extracted text to file contents
            fileContents += `\n\n[PDF Document: ${file.name}]\n${pdfResult.text}`;
            
          } else if (file.type.startsWith('image/')) {
            // Validate MIME type
            if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
              addSystemMessage(`Error: Unsupported image format ${file.type}. Supported formats: PNG, JPEG, WebP`);
              return;
            }
            
            // Validate file size
            if (file.size > MAX_IMAGE_SIZE) {
              addSystemMessage(`Error: Image ${file.name} is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 7MB.`);
              return;
            }
            
            // For images, convert to base64 and prepare for vision API
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                // Remove the data:image/...;base64, prefix
                const base64Data = result.split(',')[1];
                resolve(base64Data);
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            
            imageData.push({
              type: "image",
              source: {
                type: "base64",
                media_type: file.type,
                data: base64
              }
            });
            hasImages = true;
            fileContents += `\n\n[Image: ${file.name}]`;
          } else {
            // For text files, read the content
            const text = await file.text();
            fileContents += `\n\n[Document: ${file.name}]\n${text}`;
          }
        } catch (error) {
          console.error('Error processing file:', error);
          fileContents += `\n\n[Error reading file: ${file.name}]`;
        }
      }
    }

    const fullPrompt = prompt + fileContents;

    // Calculate total message size to check Chrome extension limits
    const totalImageSize = imageData.reduce((total, img) => total + (img.source?.data?.length || 0), 0);
    const estimatedMessageSize = JSON.stringify({ prompt: fullPrompt, imageData }).length;
    
    console.log('Final imageData being sent:', { 
      hasImages, 
      imageDataLength: imageData.length, 
      totalImageSize,
      estimatedMessageSize,
      exceedsChromeLimit: estimatedMessageSize > 1024 * 1024, // 1MB limit
      imageData: imageData.map(img => ({
        type: img.type,
        sourceType: img.source.type,
        mediaType: img.source.media_type,
        dataLength: img.source.data.length,
        dataPreview: img.source.data.substring(0, 50) + '...'
      }))
    });
    
    // Warn if message might be too large for Chrome extension
    if (estimatedMessageSize > 1024 * 1024) {
      console.warn(`[SidePanel] Message size (${estimatedMessageSize} bytes) exceeds Chrome extension 1MB limit!`);
      
      // Try to compress images to fit Chrome extension limits
      if (hasImages) {
        console.log(`[SidePanel] Attempting to compress images to fit Chrome extension limits...`);
        addSystemMessage(`Image is too large (${Math.round(estimatedMessageSize / 1024)}KB). Compressing to fit Chrome extension limits...`);
        
        // Compress images by reducing quality
        const compressedImageData = await compressImages(imageData, 1024 * 1024); // Target 1MB
        imageData = compressedImageData;
        
        const newEstimatedSize = JSON.stringify({ prompt: fullPrompt, imageData }).length;
        console.log(`[SidePanel] After compression: ${newEstimatedSize} bytes (was ${estimatedMessageSize} bytes)`);
        
        if (newEstimatedSize > 1024 * 1024) {
          addSystemMessage(`Warning: Image is still too large after compression. Consider using a smaller image.`);
        } else {
          addSystemMessage(`Image compressed successfully. Proceeding with analysis...`);
        }
      }
    }

    try {
      if (mode === 'ask') {
        // Ask mode - just chat without tools
        await executePrompt(fullPrompt, true, hasImages ? imageData : undefined); // Pass true to indicate ask mode
      } else {
        // Do mode - use browser automation tools
        await executePrompt(fullPrompt, false, hasImages ? imageData : undefined);
      }
    } catch (error) {
      console.error('Error:', error);
      addSystemMessage('Error: ' + (error instanceof Error ? error.message : String(error)));
      setIsProcessing(false);
      // Update the tab status to error
      setTabStatus('error');
    }
  };

  // Handle cancellation - also reject any pending approval requests
  const handleCancel = () => {
    // If there are any pending approval requests, reject them all
    if (approvalRequests.length > 0) {
      // Add a system message to indicate that approvals were rejected due to cancellation
      addSystemMessage(`❌ Cancelled execution - all pending approval requests were automatically rejected`);

      // Reject each pending approval request
      approvalRequests.forEach(req => {
        rejectRequest(req.requestId);
      });

      // Clear the approval requests
      setApprovalRequests([]);
    }

    // Cancel the execution
    cancelExecution();

    // Update the tab status to idle
    setTabStatus('idle');
  };

  // Handle globe click - toggle between Ask and Do modes
  const handleGlobeClick = async () => {
    const newMode = mode === 'ask' ? 'do' : 'ask';
    setMode(newMode);
    setIsGlobeActive(newMode === 'do');
    
    // Save the mode to storage
    try {
      await chrome.storage.local.set({ browserbee_mode: newMode });
    } catch (error) {
      console.error('Error saving mode:', error);
    }
  };

  // Handle attach to current tab
  const handleAttachClick = async () => {
    try {
      // Get the current tab ID and title
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tabs && tabs[0] && tabs[0].id) {
        const activeTabId = tabs[0].id;
        const windowId = tabs[0].windowId;
        const activeTabTitle = tabs[0].title || 'Unknown Tab';

        // Initialize tab attachment
        chrome.runtime.sendMessage({
          action: 'initializeTab',
          tabId: activeTabId,
          windowId: windowId
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error initializing tab:', chrome.runtime.lastError);
          } else if (response && response.success) {
            console.log(`Tab ${activeTabId} in window ${windowId} initialized successfully`);
            // Update the tab title and status
            setTabTitle(activeTabTitle);
            setTabStatus('attached');
          }
        });
      }
    } catch (error) {
      console.error('Error attaching to current tab:', error);
    }
  };

  // Handle welcome screen prompt click
  const handlePromptClick = (prompt: string) => {
    setInputValue(prompt);
  };

  // Handle clearing history
  const handleClearHistory = () => {
    clearMessages();
    clearHistory();

    // Reset token tracking
    const tokenTracker = TokenTrackingService.getInstance();
    tokenTracker.reset();
  };

  // Handle reflect and learn
  const handleReflectAndLearn = () => {
    // Send message to background script to trigger reflection
    chrome.runtime.sendMessage({
      action: 'reflectAndLearn',
      tabId
    });

    // Add a system message to indicate reflection is happening
    addSystemMessage("🧠 Reflecting on this session to learn useful patterns...");
  };

  // Function to navigate to the options page
  const navigateToOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  // Show memory management inline if requested
  if (showMemoryManagement) {
    return (
      <div className="flex flex-col h-screen bg-white" style={{ border: 'none', outline: 'none' }}>
        <InlineMemoryManagement onClose={() => setShowMemoryManagement(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen p-4 bg-white" style={{ border: 'none', outline: 'none' }}>
      {/* Thin header with beta preview and settings */}
      <header className="mb-1 py-1 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 font-medium">BETA PREVIEW</span>
          <button
            onClick={() => setShowMemoryManagement(true)}
            className="p-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="Open Memory Management"
            title="Memory Management"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-3.5 h-3.5 text-gray-600 fill-current">
              <path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28 18.9-43.5 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.5-6.5-30.1-15.1-43.5-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28-18.9 43.5-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C205.3 1.2 219.5 0 234 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.5 6.5 30.1 15.1 43.5 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/>
            </svg>
          </button>
        </div>
      </header>

      {hasConfiguredProviders ? (
        <>
          <div className="flex flex-col flex-grow gap-4 overflow-hidden md:flex-row">
            <div className="bg-white flex-1 flex flex-col overflow-hidden">
              <div
                ref={outputRef}
                className={`p-3 overflow-auto bg-white flex-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 ${
                  messages.length === 0 && !isStreaming ? 'flex flex-col' : ''
                }`}
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#d1d5db #f3f4f6'
                }}
              >
                {messages.length === 0 && !isStreaming ? (
                  <WelcomeScreen onPromptClick={handlePromptClick} />
                ) : (
                  <MessageDisplay
                    messages={messages}
                    streamingSegments={streamingSegments}
                    isStreaming={isStreaming}
                    currentPageTitle={tabTitle}
                    currentPageUrl={tabId ? `Tab ${tabId}` : undefined}
                  />
                )}
              </div>
            </div>
          </div>


          {/* Display approval requests */}
          {approvalRequests.map(req => (
            <ApprovalRequest
              key={req.requestId}
              requestId={req.requestId}
              toolName={req.toolName}
              toolInput={req.toolInput}
              reason={req.reason}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}

           <PromptForm
             onSubmit={handleSubmit}
             onCancel={handleCancel}
             isProcessing={isProcessing}
             tabStatus={tabStatus}
             mode={mode}
             onGlobeClick={handleGlobeClick}
             isGlobeActive={isGlobeActive}
             currentTabTitle={tabTitle}
             currentTabFavicon={tabFavicon}
             onAttachClick={handleAttachClick}
             inputValue={inputValue}
             onInputValueChange={setInputValue}
           />
          
          
          <ProviderSelector isProcessing={isProcessing} />
          
          {/* Token Usage Display - Hidden per user request */}
          {/* <TokenUsageDisplay /> */}
        </>
      ) : (
        <div className="flex flex-col flex-grow items-center justify-center">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold mb-2">No LLM provider configured</h2>
            <p className="text-gray-600 mb-4">
              You need to configure an LLM provider before you can use Beitha.
            </p>
            <button
              onClick={navigateToOptions}
              className="btn btn-primary"
            >
              Configure Providers
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
