import { handleApprovalResponse } from '../agent/approvalManager';
import { TokenTrackingService } from '../tracking/tokenTrackingService';
import { executePrompt } from './agentController';
import { cancelExecution } from './agentController';
import { clearMessageHistory } from './agentController';
import { initializeAgent } from './agentController';
import { triggerReflection } from './reflectionController';
import { attachToTab, getTabState, getWindowForTab, forceResetPlaywright } from './tabManager';
import { BackgroundMessage } from './types';
import { logWithTimestamp, handleError, sendUIMessage } from './utils';
import backgroundModule from './index';

// De-dupe guard for quickPrompt autosend per tab
const quickPromptLastExecByTab = new Map<number, number>();
function executeOnceAskMode(tabId: number, prompt: string): void {
  const now = Date.now();
  const last = quickPromptLastExecByTab.get(tabId) || 0;
  // 3s window to prevent duplicate sends
  if (now - last < 3000) {
    logWithTimestamp(`Skipping duplicate execute for tab ${tabId}`);
    return;
  }
  quickPromptLastExecByTab.set(tabId, now);
  chrome.runtime.sendMessage({ action: 'executePrompt', prompt, tabId, askMode: true });
}

/**
 * Handle messages from the UI
 * @param message The message to handle
 * @param sender The sender of the message
 * @param sendResponse The function to send a response
 * @returns True if the message was handled, false otherwise
 */
export function handleMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  try {
    // Type guard to check if the message is a valid background message
    if (!isBackgroundMessage(message)) {
      logWithTimestamp(`Ignoring unknown message type: ${JSON.stringify(message)}`, 'warn');
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
    }

    // Handle the message based on its action
    switch (message.action) {
      case 'executePrompt':
        handleExecutePrompt(message, sendResponse);
        return true; // Keep the message channel open for async response

      case 'cancelExecution':
        handleCancelExecution(message, sendResponse);
        return true;

      case 'clearHistory':
        // Handle async function and keep message channel open
        handleClearHistory(message, sendResponse)
          .catch(error => {
            const errorMessage = handleError(error, 'clearing history');
            logWithTimestamp(`Error in async handleClearHistory: ${errorMessage}`, 'error');
            sendResponse({ success: false, error: errorMessage });
          });
        return true; // Keep the message channel open for async response

      case 'initializeTab':
        // This function uses setTimeout internally to handle async operations
        // We still return true to keep the message channel open
        handleInitializeTab(message, sendResponse);
        return true; // Keep the message channel open for async response
        
      case 'switchToTab':
        handleSwitchToTab(message, sendResponse);
        return true;
        
      case 'getTokenUsage':
        handleGetTokenUsage(message, sendResponse);
        return true;
        
      case 'approvalResponse':
        handleApprovalResponse(message.requestId, message.approved);
        sendResponse({ success: true });
        return true;
        
      case 'reflectAndLearn':
        handleReflectAndLearn(message, sendResponse);
        return true;
        
      case 'tokenUsageUpdated':
        // Just pass through token usage updates
        // This allows the TokenTrackingService to broadcast updates
        // that will be received by all UI components
        sendResponse({ success: true });
        return true;
        
      case 'updateOutput':
        // Just pass through output updates
        // This allows components to send UI updates
        sendResponse({ success: true });
        return true;
        
      case 'setPrompt':
        // Just pass through setPrompt messages
        // This allows context menu to set prompt in side panel
        sendResponse({ success: true });
        return true;
        
      case 'openSidePanel':
        (async () => {
          try {
            let tabId = (message as any).tabId as number | undefined;
            if (!tabId && sender.tab?.id) tabId = sender.tab.id;
            if (!tabId) {
              const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
              tabId = tabs[0]?.id;
            }
            if (!tabId) { sendResponse({ success: false, error: 'No tabId' }); return; }
            await chrome.sidePanel.open({ tabId });
            sendResponse({ success: true });
          } catch (e) {
            const err = handleError(e, 'openSidePanel');
            logWithTimestamp(err, 'warn');
            sendResponse({ success: false, error: err });
          }
        })();
        return true;

      case 'quickPrompt':
        // Handle quick prompt from content script – robustly determine tabId and route
        (async () => {
          try {
            const text = (message as any).text as string | undefined;
            let tabId = (message as any).tabId as number | undefined;
            if (!tabId && sender.tab?.id) tabId = sender.tab.id;
            if (!tabId) {
              const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
              tabId = tabs[0]?.id;
            }
            if (!text || !tabId) {
              sendResponse({ success: false, error: 'Missing text or tab ID' });
              return;
            }

            // Open the side panel first
            try { await chrome.sidePanel.open({ tabId }); } catch (e) {
              logWithTimestamp(`Error opening side panel: ${String(e)}`, 'warn');
            }

            // Immediately show the user's message for responsiveness
            try {
              sendUIMessage('updateOutput', { type: 'user', content: text }, tabId);
            } catch { /* no-op */ }

            // Store for polling fallback
            await chrome.storage.local.set({
              pendingPrompt: { prompt: text, timestamp: Date.now(), tabId }
            });

            // Prefill after a short delay (do NOT autosend here; autosend should come from prompt if desired)
            setTimeout(() => {
              chrome.runtime.sendMessage({ action: 'setPrompt', prompt: text, tabId });
            }, 400);

            sendResponse({ success: true });
          } catch (err) {
            const errorMessage = handleError(err, 'handling quickPrompt');
            logWithTimestamp(`quickPrompt error: ${errorMessage}`, 'error');
            sendResponse({ success: false, error: errorMessage });
          }
        })();
        return true;
        
      case 'providerConfigChanged':
        // Just pass through provider configuration change notifications
        // This allows the ProviderSelector component to refresh
        sendResponse({ success: true });
        return true;
        
      case 'forceResetPlaywright':
        // Handle async function and keep message channel open
        handleForceResetPlaywright(message, sendResponse)
          .catch(error => {
            const errorMessage = handleError(error, 'force resetting Playwright');
            logWithTimestamp(`Error in async handleForceResetPlaywright: ${errorMessage}`, 'error');
            sendResponse({ success: false, error: errorMessage });
          });
        return true; // Keep the message channel open for async response
        
      case 'requestApproval':
        // Just acknowledge receipt of the request approval message
        // The actual approval handling is done by the UI
        sendResponse({ success: true });
        return true;
        
      case 'checkAgentStatus':
        // Handle async function and keep message channel open
        handleCheckAgentStatus(message, sendResponse)
          .catch(error => {
            const errorMessage = handleError(error, 'checking agent status');
            logWithTimestamp(`Error in async handleCheckAgentStatus: ${errorMessage}`, 'error');
            sendResponse({ success: false, error: errorMessage });
          });
        return true; // Keep the message channel open for async response

      default:
        // This should never happen due to the type guard, but TypeScript requires it
        logWithTimestamp(`Unhandled message action: ${(message as any).action}`, 'warn');
        sendResponse({ success: false, error: 'Unhandled message action' });
        return false;
    }
  } catch (error) {
    const errorMessage = handleError(error, 'handling message');
    logWithTimestamp(`Error handling message: ${errorMessage}`, 'error');
    sendResponse({ success: false, error: errorMessage });
    return false;
  }
}

/**
 * Type guard to check if a message is a valid background message
 * @param message The message to check
 * @returns True if the message is a valid background message, false otherwise
 */
function isBackgroundMessage(message: any): message is BackgroundMessage {
  return (
    message &&
    typeof message === 'object' &&
    'action' in message &&
    (
      message.action === 'executePrompt' ||
      message.action === 'cancelExecution' ||
      message.action === 'clearHistory' ||
      message.action === 'initializeTab' ||
      message.action === 'switchToTab' ||
      message.action === 'getTokenUsage' ||
      message.action === 'approvalResponse' ||
      message.action === 'reflectAndLearn' ||
      message.action === 'tokenUsageUpdated' ||  // Add support for token usage updates
      message.action === 'updateOutput' ||       // Add support for output updates
      message.action === 'providerConfigChanged' ||  // Add support for provider config changes
      message.action === 'tabStatusChanged' ||
      message.action === 'targetCreated' ||
      message.action === 'targetDestroyed' ||
      message.action === 'targetChanged' ||
      message.action === 'agentStatusUpdate' ||
      message.action === 'updateStreamingChunk' ||
      message.action === 'finalizeStreamingSegment' ||
      message.action === 'startNewSegment' ||
      message.action === 'streamingComplete' ||
      message.action === 'updateLlmOutput' ||
      message.action === 'rateLimit' ||
      message.action === 'fallbackStarted' ||
      message.action === 'updateScreenshot' ||
      message.action === 'processingComplete' ||
      message.action === 'setPrompt' ||
      message.action === 'checkAgentStatus' ||
      message.action === 'forceResetPlaywright' ||
      message.action === 'requestApproval' ||
      message.action === 'quickPrompt' ||
      message.action === 'openSidePanel'
    )
  );
}

/**
 * Handle the executePrompt message
 * @param message The message to handle
 * @param sendResponse The function to send a response
 */
function handleExecutePrompt(
  message: Extract<BackgroundMessage, { action: 'executePrompt' }>,
  sendResponse: (response?: any) => void
): void {
  console.log(`[MessageHandler] Received executePrompt message:`, {
    hasImageData: !!(message.imageData && message.imageData.length > 0),
    imageDataLength: message.imageData?.length || 0,
    imageDataSize: message.imageData?.reduce((total, img) => total + (img.source?.data?.length || 0), 0) || 0,
    promptLength: message.prompt.length,
    askMode: message.askMode
  });
  
  // Use the tabId from the message if available
  if (message.tabId) {
    executePrompt(message.prompt, message.tabId, false, message.askMode, message.imageData);
  } else {
    executePrompt(message.prompt, undefined, false, message.askMode, message.imageData);
  }
  sendResponse({ success: true });
}

/**
 * Handle the cancelExecution message
 * @param message The message to handle
 * @param sendResponse The function to send a response
 */
function handleCancelExecution(
  message: Extract<BackgroundMessage, { action: 'cancelExecution' }>,
  sendResponse: (response?: any) => void
): void {
  cancelExecution(message.tabId);
  sendResponse({ success: true });
}

/**
 * Handle the clearHistory message
 * @param message The message to handle
 * @param sendResponse The function to send a response
 */
async function handleClearHistory(
  message: Extract<BackgroundMessage, { action: 'clearHistory' }>,
  sendResponse: (response?: any) => void
): Promise<void> {
  await clearMessageHistory(message.tabId, message.windowId);
  
  // Reset token tracking
  try {
    const tokenTracker = TokenTrackingService.getInstance();
    tokenTracker.reset(message.windowId);
    
    // Notify UI of reset
    chrome.runtime.sendMessage({
      action: 'tokenUsageUpdated',
      content: tokenTracker.getUsage(),
      tabId: message.tabId,
      windowId: message.windowId
    });
  } catch (error) {
    logWithTimestamp(`Error resetting token tracking: ${String(error)}`, 'warn');
  }
  
  sendResponse({ success: true });
}

/**
 * Handle the initializeTab message
 * @param message The message to handle
 * @param sendResponse The function to send a response
 */
function handleInitializeTab(
  message: Extract<BackgroundMessage, { action: 'initializeTab' }>,
  sendResponse: (response?: any) => void
): void {
  // Initialize the tab as soon as the side panel is opened
  if (message.tabId) {
    // Use setTimeout to make this asynchronous and return the response immediately
    setTimeout(async () => {
      try {
        // Get the tab title before attaching
        let tabTitle = "Unknown Tab";
        try {
          const tab = await chrome.tabs.get(message.tabId);
          if (tab && tab.title) {
            tabTitle = tab.title;
          }
        } catch (titleError) {
          handleError(titleError, 'getting tab title');
        }
        
        await attachToTab(message.tabId, message.windowId);
        await initializeAgent(message.tabId);
        
        // Get the tab state to check if attachment was successful
        const tabState = getTabState(message.tabId);
        if (tabState) {
          // Tab connection successful (no UI message needed)
        }
        
        logWithTimestamp(`Tab ${message.tabId} in window ${message.windowId || 'unknown'} initialized from side panel`);
      } catch (error) {
        handleError(error, 'initializing tab from side panel');
      }
    }, 0);
  }
  sendResponse({ success: true });
}

/**
 * Handle the switchToTab message
 * @param message The message to handle
 * @param sendResponse The function to send a response
 */
function handleSwitchToTab(
  message: Extract<BackgroundMessage, { action: 'switchToTab' }>,
  sendResponse: (response?: any) => void
): void {
  if (message.tabId) {
    // Get the window ID for this tab if available
    const windowId = getWindowForTab(message.tabId);
    
    // Focus the window first if we have a window ID
    if (windowId) {
      chrome.windows.update(windowId, { focused: true });
    }
    
    // Then focus the tab
    chrome.tabs.update(message.tabId, { active: true });
    
    logWithTimestamp(`Switched to tab ${message.tabId} in window ${windowId || 'unknown'}`);
  }
  sendResponse({ success: true });
}

/**
 * Handle the getTokenUsage message
 * @param message The message to handle
 * @param sendResponse The function to send a response
 */
function handleGetTokenUsage(
  message: Extract<BackgroundMessage, { action: 'getTokenUsage' }>,
  sendResponse: (response?: any) => void
): void {
  try {
    const tokenTracker = TokenTrackingService.getInstance();
    const usage = tokenTracker.getUsage();
    
    // Get the window ID if available
    const windowId = message.windowId;
    const tabId = message.tabId;
    
    // Send the usage directly in the response
    sendResponse({ 
      success: true, 
      usage 
    });
    
    // Also broadcast it to all clients
    chrome.runtime.sendMessage({
      action: 'tokenUsageUpdated',
      content: usage,
      tabId,
      windowId
    });
  } catch (error) {
    const errorMessage = handleError(error, 'getting token usage');
    logWithTimestamp(`Error getting token usage: ${errorMessage}`, 'error');
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Handle the reflectAndLearn message
 * @param message The message to handle
 * @param sendResponse The function to send a response
 */
function handleReflectAndLearn(
  message: Extract<BackgroundMessage, { action: 'reflectAndLearn' }>,
  sendResponse: (response?: any) => void
): void {
  try {
    console.log("MEMORY DEBUG: handleReflectAndLearn called", { tabId: message.tabId });
    
    // Trigger the reflection process
    triggerReflection(message.tabId);
    
    console.log("MEMORY DEBUG: triggerReflection called successfully");
    sendResponse({ success: true });
  } catch (error) {
    console.error("MEMORY DEBUG: Error in handleReflectAndLearn", error);
    const errorMessage = handleError(error, 'triggering reflection');
    logWithTimestamp(`Error triggering reflection: ${errorMessage}`, 'error');
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Handle the forceResetPlaywright message
 * @param message The message to handle
 * @param sendResponse The function to send a response
 */
async function handleForceResetPlaywright(
  message: Extract<BackgroundMessage, { action: 'forceResetPlaywright' }>,
  sendResponse: (response?: any) => void
): Promise<void> {
  try {
    logWithTimestamp('Force resetting Playwright instance');
    
    // Call the forceResetPlaywright function from tabManager
    const result = await forceResetPlaywright();
    
    // Get the current tab and window ID if possible
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tabId = tabs[0]?.id;
    const windowId = tabs[0]?.windowId;
    
    // Notify UI components about the reset
    chrome.runtime.sendMessage({
      action: 'updateOutput',
      content: {
        type: 'system',
        content: `Playwright instance has been force reset. ${result ? 'Success' : 'Failed'}`
      },
      tabId,
      windowId
    });
    
    sendResponse({ success: result });
  } catch (error) {
    const errorMessage = handleError(error, 'force resetting Playwright instance');
    logWithTimestamp(`Error force resetting Playwright instance: ${errorMessage}`, 'error');
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Handle the checkAgentStatus message
 * @param message The message to handle
 * @param sendResponse The function to send a response
 */
async function handleCheckAgentStatus(
  message: Extract<BackgroundMessage, { action: 'checkAgentStatus' }>,
  sendResponse: (response?: any) => void
): Promise<void> {
  try {
    // Get the window ID for this tab
    const windowId = message.windowId || (message.tabId ? getWindowForTab(message.tabId) : null);
    
    if (!windowId) {
      logWithTimestamp(`Cannot check agent status: No window ID found for tab ${message.tabId}`, 'warn');
      sendResponse({ success: false, error: 'No window ID found' });
      return;
    }
    
    // Get the agent status from agentController using dynamic import
    const { getAgentStatus } = await import('./agentController');
    const status = getAgentStatus(windowId);
    
    // Return the status directly in the response
    sendResponse({ 
      success: true, 
      status: status.status,
      timestamp: status.timestamp,
      lastHeartbeat: status.lastHeartbeat
    });
  } catch (error) {
    const errorMessage = handleError(error, 'checking agent status');
    logWithTimestamp(`Error checking agent status: ${errorMessage}`, 'error');
    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Set up message listeners
 */
export function setupMessageListeners(): void {
  chrome.runtime.onMessage.addListener(handleMessage);
}
