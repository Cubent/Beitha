import { MemoryService } from '../tracking/memoryService';
import { setupMessageListeners } from './messageHandler';
import { cleanupOnUnload, setupTabListeners } from './tabManager';
import { logWithTimestamp } from './utils';

/**
 * Initialize the extension
 */
function initializeExtension(): void {
  logWithTimestamp('Beitha extension initialized');

  // Set up message listeners
  setupMessageListeners();

  // Set up tab listeners
  setupTabListeners();

  // Set up event listeners
  setupEventListeners();

  // Set up command listeners
  setupCommandListeners();

  // Set up context menu
  setupContextMenu();
}

/**
 * Set up event listeners for the extension
 */
function setupEventListeners(): void {
  // Listen for changes to Chrome storage
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      // Check if any provider configuration has changed
      const providerConfigChanged = Object.keys(changes).some(key =>
        key === 'provider' ||
        key === 'anthropicApiKey' ||
        key === 'openaiApiKey' ||
        key === 'geminiApiKey' ||
        key === 'ollamaApiKey' ||
        key === 'anthropicBaseUrl' ||
        key === 'openaiBaseUrl' ||
        key === 'geminiBaseUrl' ||
        key === 'ollamaBaseUrl'
      );

      if (providerConfigChanged) {
        // Notify all clients that provider configuration has changed
        chrome.runtime.sendMessage({
          action: 'providerConfigChanged'
        });

        logWithTimestamp('Provider configuration changed, notified clients');
      }
    }
  });

  // Open options page when the extension is first installed
  chrome.runtime.onInstalled.addListener((details) => {
    logWithTimestamp('Beitha extension installed');

    if (details.reason === 'install') {
      chrome.runtime.openOptionsPage();
    }

    // Initialize the memory database on install or update
    if (details.reason === 'install' || details.reason === 'update') {
      logWithTimestamp('Initializing memory database');
      const memoryService = MemoryService.getInstance();
      memoryService.init().then(async () => {
        logWithTimestamp('Memory database initialized successfully');

        // Import default memories only on fresh install
        if (details.reason === 'install') {
          try {
            logWithTimestamp('Importing default memories for new installation');
            const importedCount = await memoryService.importDefaultMemories();
            if (importedCount > 0) {
              logWithTimestamp(`Successfully imported ${importedCount} default memories`);
            } else {
              logWithTimestamp('No default memories were imported');
            }
          } catch (error) {
            logWithTimestamp(`Error importing default memories: ${error}`, 'error');
          }
        }
      }).catch(error => {
        logWithTimestamp(`Error initializing memory database: ${error}`, 'error');
      });
    }
  });

  // Open the side panel when the extension icon is clicked or Alt+Shift+B is pressed
  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      logWithTimestamp(`Opening side panel for tab ${tab.id}`);

      try {
        await chrome.sidePanel.open({ tabId: tab.id });
        logWithTimestamp(`Side panel opened for tab ${tab.id}`);
      } catch (error) {
        logWithTimestamp(`Error opening side panel: ${String(error)}`, 'error');
      }
    } else {
      logWithTimestamp('No tab ID available for action click', 'error');
    }
  });

  // Clean up when the extension is unloaded
  chrome.runtime.onSuspend.addListener(async () => {
    logWithTimestamp('Extension is being suspended, cleaning up resources');
    try {
      await cleanupOnUnload();
      logWithTimestamp('Cleanup completed successfully');

      // Delete the memory database on uninstall/disable
      try {
        logWithTimestamp('Deleting memory database');
        const request = indexedDB.deleteDatabase('beitha-memories');

        request.onsuccess = () => {
          logWithTimestamp('Memory database deleted successfully');
        };

        request.onerror = (event) => {
          logWithTimestamp(`Error deleting memory database: ${(event.target as IDBRequest).error}`, 'error');
        };
      } catch (error) {
        logWithTimestamp(`Exception deleting memory database: ${error}`, 'error');
      }
    } catch (error) {
      logWithTimestamp(`Error during cleanup: ${String(error)}`, 'error');
    }
  });

  // Additional cleanup on update or uninstall
  chrome.runtime.onUpdateAvailable.addListener(async (details) => {
    logWithTimestamp(`Extension update available: ${details.version}, cleaning up resources`);
    try {
      await cleanupOnUnload();
      logWithTimestamp('Cleanup before update completed successfully');

      // Delete the memory database before update
      try {
        logWithTimestamp('Deleting memory database before update');
        const request = indexedDB.deleteDatabase('beitha-memories');

        request.onsuccess = () => {
          logWithTimestamp('Memory database deleted successfully before update');
        };

        request.onerror = (event) => {
          logWithTimestamp(`Error deleting memory database before update: ${(event.target as IDBRequest).error}`, 'error');
        };
      } catch (error) {
        logWithTimestamp(`Exception deleting memory database before update: ${error}`, 'error');
      }
    } catch (error) {
      logWithTimestamp(`Error during pre-update cleanup: ${String(error)}`, 'error');
    }
  });

  // Try to listen for side panel events if available
  try {
    // @ts-expect-error - These events might not be in the type definitions yet
    if (chrome.sidePanel.onShown) {
      // @ts-expect-error - These events might not be in the type definitions yet
      chrome.sidePanel.onShown.addListener(async (info: { tabId?: number }) => {
        logWithTimestamp(`Side panel shown for tab ${info.tabId}`);

        if (info.tabId) {
          // Get the window ID for this tab
          try {
            const tab = await chrome.tabs.get(info.tabId);
            const windowId = tab.windowId;
            logWithTimestamp(`Side panel shown for tab ${info.tabId} in window ${windowId}`);

            // Send a message to initialize the tab
            chrome.runtime.sendMessage({
              action: 'initializeTab',
              tabId: info.tabId,
              windowId: windowId
            });
          } catch (error) {
            logWithTimestamp(`Error getting window ID for tab ${info.tabId}: ${String(error)}`, 'error');

            // Fall back to initializing without window ID
            chrome.runtime.sendMessage({
              action: 'initializeTab',
              tabId: info.tabId
            });
          }
        }
      });
    }

    // @ts-expect-error - These events might not be in the type definitions yet
    if (chrome.sidePanel.onHidden) {
      // @ts-expect-error - These events might not be in the type definitions yet
      chrome.sidePanel.onHidden.addListener((info: { tabId?: number }) => {
        logWithTimestamp(`Side panel hidden for tab ${info.tabId}`);
        // We don't need to clean up here, but we could if needed
      });
    }
  } catch (error) {
    logWithTimestamp("Side panel events not available: " + String(error), 'warn');
    logWithTimestamp("Using fallback approach for initialization");
  }
}

/**
 * Set up command listeners for keyboard shortcuts
 */
function setupCommandListeners(): void {
  logWithTimestamp('Setting up command listeners for keyboard shortcuts');

  // Log all registered commands to verify our command is registered
  chrome.commands.getAll().then(commands => {
    logWithTimestamp(`Registered commands: ${JSON.stringify(commands)}`);
  }).catch(error => {
    logWithTimestamp(`Error getting registered commands: ${String(error)}`, 'error');
  });

  // Listen for any commands (for future extensibility)
  chrome.commands.onCommand.addListener(async (command) => {
    logWithTimestamp(`Command received: ${command}`);

    // The _execute_action command is handled automatically by Chrome
    // and will trigger the action.onClicked handler

    // This listener is kept for future custom commands and debugging
  });

  logWithTimestamp('Command listeners set up');
}

/**
 * Set up context menu for text selection
 */
function setupContextMenu(): void {
  logWithTimestamp('Setting up context menu');

  // Create the main AI Actions menu
  chrome.contextMenus.create({
    id: 'beitha-ai-actions',
    title: 'AI Actions',
    contexts: ['selection']
  });

  // Create submenu items
  const aiActions = [
    { id: 'summarize', title: 'Summarize' },
    { id: 'translate', title: 'Translate' },
    { id: 'explain', title: 'Explain this' },
    { id: 'rewrite', title: 'Rewrite' },
    { id: 'expand', title: 'Expand' },
    { id: 'grammar', title: 'Grammar check' },
    { id: 'answer', title: 'Answer this question' },
    { id: 'explain-code', title: 'Explain Code' }
  ];

  aiActions.forEach(action => {
    chrome.contextMenus.create({
      id: action.id,
      parentId: 'beitha-ai-actions',
      title: action.title,
      contexts: ['selection']
    });
  });

  // Listen for context menu clicks
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId && info.selectionText && tab?.id) {
      logWithTimestamp(`Context menu action: ${info.menuItemId} for text: "${info.selectionText.substring(0, 50)}..."`);
      
      // Send the selected text to the AI with the specific action
      await handleContextMenuAction(info.menuItemId as string, info.selectionText, tab.id);
    }
  });

  logWithTimestamp('Context menu set up successfully');
}

/**
 * Handle context menu actions
 */
async function handleContextMenuAction(action: string, selectedText: string, tabId: number): Promise<void> {
  try {
    // Create a prompt based on the action
    const actionPrompts: Record<string, string> = {
      'summarize': `Please summarize the following text in a clear and concise way:\n\n"${selectedText}"`,
      'translate': `Please translate the following text to English (or specify the target language if you can detect it):\n\n"${selectedText}"`,
      'explain': `Please explain the following text in simple terms:\n\n"${selectedText}"`,
      'rewrite': `Please rewrite the following text to make it clearer and more professional:\n\n"${selectedText}"`,
      'expand': `Please expand on the following text with more detail and context:\n\n"${selectedText}"`,
      'grammar': `Please check the grammar and fix any errors in the following text:\n\n"${selectedText}"`,
      'answer': `Please answer the following question or provide information about this topic:\n\n"${selectedText}"`,
      'explain-code': `Please explain the following code:\n\n"${selectedText}"`
    };

    const prompt = actionPrompts[action] || `Please help with the following text:\n\n"${selectedText}"`;
    
    // Open the side panel first
    try {
      await chrome.sidePanel.open({ tabId });
    } catch (error) {
      logWithTimestamp(`Error opening side panel: ${error}`, 'warn');
    }

    // Store the prompt in chrome.storage and let the side panel poll for it
    // This is more reliable than runtime messages when the side panel is just opening
    chrome.storage.local.set({
      'pendingPrompt': {
        prompt: prompt,
        timestamp: Date.now(),
        tabId: tabId
      }
    }, () => {
      logWithTimestamp('Stored prompt in chrome.storage.local');
    });

    // Also try sending via runtime message after a delay to give the side panel time to load
    setTimeout(() => {
      logWithTimestamp(`Sending setPrompt message after delay: "${prompt.substring(0, 100)}..."`);
      chrome.runtime.sendMessage({
        action: 'setPrompt',
        prompt: prompt,
        tabId: tabId
      }, (response) => {
        if (chrome.runtime.lastError) {
          logWithTimestamp(`Error sending setPrompt message: ${chrome.runtime.lastError.message}`, 'error');
        } else {
          logWithTimestamp(`setPrompt message sent successfully, response: ${JSON.stringify(response)}`);
        }
      });
    }, 1000); // Wait 1 second for the side panel to fully load

    logWithTimestamp(`Context menu action "${action}" executed successfully`);
  } catch (error) {
    logWithTimestamp(`Error handling context menu action: ${error}`, 'error');
  }
}

/**
 * Handle quick prompt from content script
 */
async function handleQuickPrompt(text: string, tabId: number): Promise<void> {
  try {
    logWithTimestamp(`Quick prompt triggered with text: "${text.substring(0, 100)}..."`);

    // Create a general prompt for the selected text
    const prompt = `Please help with the following text:\n\n"${text}"`;
    
    // Open the side panel first
    try {
      await chrome.sidePanel.open({ tabId });
    } catch (error) {
      logWithTimestamp(`Error opening side panel: ${error}`, 'warn');
    }

    // Immediately show the user's message in the UI for responsiveness
    import('./utils').then(({ sendUIMessage }) => {
      sendUIMessage('updateOutput', {
        type: 'user',
        content: prompt
      }, tabId);
    }).catch(() => {/* noop */});

    // Store the prompt in chrome.storage and let the side panel poll for it
    chrome.storage.local.set({
      'pendingPrompt': {
        prompt: prompt,
        timestamp: Date.now(),
        tabId: tabId
      }
    }, () => {
      logWithTimestamp('Stored quick prompt in chrome.storage.local');
    });

    // Also try sending via runtime message after a short delay
    setTimeout(() => {
      logWithTimestamp(`Sending quick prompt message after delay: "${prompt.substring(0, 100)}..."`);
      chrome.runtime.sendMessage({
        action: 'setPrompt',
        prompt: prompt,
        tabId: tabId
      }, () => {
        // After prompt is set, execute in Ask mode for immediate action
        chrome.runtime.sendMessage({
          action: 'executePrompt',
          prompt: prompt,
          tabId: tabId,
          askMode: true
        });
      });
    }, 800);

    logWithTimestamp(`Quick prompt executed successfully`);
  } catch (error) {
    logWithTimestamp(`Error handling quick prompt: ${error}`, 'error');
  }
}

// Initialize the extension
initializeExtension();

// Export for use in other modules
export default {
  initializeExtension,
  setupEventListeners,
  setupCommandListeners,
  setupContextMenu,
  handleQuickPrompt
};
