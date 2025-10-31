// Content script for quick prompt functionality
// This runs on web pages to show a floating action button when text is selected

let quickPromptButton: HTMLElement | null = null;
let selectedText = '';
let selectionTimeout: ReturnType<typeof setTimeout> | null = null;
let quickPromptButtonTimeout: ReturnType<typeof setTimeout> | null = null;
let isPromptOpen = false;
let isInteracting = false;
let suppressSelectionUntil = 0;

let shadowHost: HTMLElement | null = null;
let shadowRootRef: ShadowRoot | null = null;
let lastChipX = 0;
let lastChipY = 0;

function ensureShadow(): ShadowRoot {
  if (shadowRootRef && shadowHost && document.body.contains(shadowHost)) return shadowRootRef;
  // Create host anchored to viewport
  shadowHost = document.createElement('div');
  shadowHost.id = 'beitha-shadow-host';
  shadowHost.setAttribute('style', [
    'position: fixed',
    'inset: 0',
    'z-index: 2147483647',
    'pointer-events: none' // children will enable pointer events
  ].join(';'));
  shadowRootRef = shadowHost.attachShadow({ mode: 'open' });
  document.body.appendChild(shadowHost);

  // Inject base styles in shadow
  const style = document.createElement('style');
  style.textContent = `
    @keyframes beithaFadeScaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
    @keyframes beithaToastIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes beithaToastOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(6px); } }
  `;
  shadowRootRef.appendChild(style);
  return shadowRootRef;
}

// Create the floating action button
function createQuickPromptButton(x: number, y: number): void {
  // Remove existing button if it exists
  if (quickPromptButton) {
    quickPromptButton.remove();
  }

  // Clamp and store final chip position so we can reuse for panel
  let cx = Math.max(8, x);
  let cy = Math.max(8, y);
  if (cx + 36 > window.innerWidth) cx = Math.max(8, window.innerWidth - 36);
  if (cy + 36 > window.innerHeight) cy = Math.max(8, window.innerHeight - 36);
  lastChipX = cx;
  lastChipY = cy;

  // Create the button element
  quickPromptButton = document.createElement('div');
  quickPromptButton.id = 'beitha-quick-prompt';
  quickPromptButton.setAttribute('style', 'position: fixed; pointer-events: auto;');
  quickPromptButton.innerHTML = `
    <div style="position: fixed; top: ${cy}px; left: ${cx}px; background: rgba(242,242,242,0.7); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); color: #111827; border: 1px solid rgba(229,231,235,0.7); border-radius: 9999px; width: 36px; height: 36px; cursor: pointer; z-index: 1; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: inline-flex; align-items: center; justify-content: center; user-select: none; transition: background 120ms ease,border-color 120ms ease; pointer-events: auto;" onmouseover="this.style.background='rgba(234,234,234,0.8)'" onmouseout="this.style.background='rgba(242,242,242,0.7)'">
      <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMTA4MCIgem9vbUFuZFBhbj0ibWFnbmlmeSIgdmlld0JveD0iMCAwIDgxMCA4MDkuOTk5OTkzIiBoZWlnaHQ9IjEwODAiIHByZXNlcnZlQXNwZWN0UmF0aW89InhNaWRZTWlkIG1lZXQiIHZlcnNpb249IjEuMCI+PGRlZnM+PGNsaXBQYXRoIGlkPSIzYTYwODJlYjM2Ij48cGF0aCBkPSJNIDE5OCAxMy4xNDA2MjUgTCA3MjQuMDQ2ODc1IDEzLjE0MDYyNSBMIDcyNC4wNDY4NzUgNTM5IEwgMTk4IDUzOSBaIE0gMTk4IDEzLjE0MDYyNSAiIGNsaXAtcnVsZT0ibm9uemVybyIvPjwvY2xpcFBhdGg+PGNsaXBQYXRoIGlkPSI2MjE5MzJlNTQyIj48cGF0aCBkPSJNIDg1Ljc5Njg3NSAyODMgTCA0NTkgMjgzIEwgNDU5IDc5Ni44OTA2MjUgTCA4NS43OTY4NzUgNzk2Ljg5MDYyNSBaIE0gODUuNzk2ODc1IDI4MyAiIGNsaXAtcnVsZT0ibm9uemVybyIvPjwvY2xpcFBhdGg+PC9kZWZzPjxnIGNsaXAtcGF0aD0idXJsKCMzYTYwODJlYjM2KSI+PHBhdGggZmlsbD0iIzQwM2UzZSIgZD0iTSAyNDAuNjU2MjUgNTM4LjU0Njg3NSBMIDY4Mi4yOTI5NjkgNTM4LjU0Njg3NSBDIDcwNS4zMjAzMTIgNTM4LjU0Njg3NSA3MjQuMTY3OTY5IDUxOS42OTkyMTkgNzI0LjE2Nzk2OSA0OTYuNjcxODc1IEwgNzI0LjE2Nzk2OSA1NS4wMTE3MTkgQyA3MjQuMTY3OTY5IDMxLjk4NDM3NSA3MDUuMzIwMzEyIDEzLjE0MDYyNSA2ODIuMjkyOTY5IDEzLjE0MDYyNSBMIDI0MC42NTYyNSAxMy4xNDA2MjUgQyAyMTcuNjI4OTA2IDEzLjE0MDYyNSAxOTguNzg1MTU2IDMxLjk4NDM3NSAxOTguNzg1MTU2IDU1LjAxMTcxOSBDIDE5OC43ODUxNTYgMjAyLjIyNjU2MiAxOTguNzg1MTU2IDM0OS40Mzc1IDE5OC43ODUxNTYgNDk2LjY0ODQzOCBDIDE5OC43ODUxNTYgNTE5LjY5OTIxOSAyMTcuNjI4OTA2IDUzOC41NDY4NzUgMjQwLjY1NjI1IDUzOC41NDY4NzUgIiBmaWxsLW9wYWNpdHk9IjEiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPjwvZz48ZyBjbGlwLXBhdGg9InVybCgjNjIxOTMyZTU0MikiPjxwYXRoIGZpbGw9IiM2NTY1NjUiIGQ9Ik0gMTE1LjU3ODEyNSA3OTYuODU1NDY5IEwgNDI5LjIwMzEyNSA3OTYuODU1NDY5IEMgNDQ1LjU1NDY4OCA3OTYuODU1NDY5IDQ1OC45NDkyMTkgNzgzLjQ2MDkzOCA0NTguOTQ5MjE5IDc2Ny4xMDU0NjkgTCA0NTguOTQ5MjE5IDMxMy4yMDMxMjUgQyA0NTguOTQ5MjE5IDI5Ni44NTE1NjIgNDQ1LjU1NDY4OCAyODMuNDU3MDMxIDQyOS4yMDMxMjUgMjgzLjQ1NzAzMSBMIDExNS41NzgxMjUgMjgzLjQ1NzAzMSBDIDk5LjIyNjU2MiAyODMuNDU3MDMxIDg1LjgzMjAzMSAyOTYuODUxNTYyIDg1LjgzMjAzMSAzMTMuMjAzMTI1IEwgODUuODMyMDMxIDc2Ny4xMjg5MDYgQyA4NS44MzIwMzEgNzgzLjQ4NDM3NSA5OS4yMDMxMjUgNzk2Ljg1NTQ2OSAxMTUuNTc4MTI1IDc5Ni44NTU0NjkgIiBmaWxsLW9wYWNpdHk9IjEiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPjwvZz48cGF0aCBmaWxsPSIjMjkyODI4IiBkPSJNIDI0MC42NTYyNSA1MzguNTQ2ODc1IEwgNDU4LjkyNTc4MSA1MzguNTQ2ODc1IEwgNDU4LjkyNTc4MSAzMTMuMjAzMTI1IEMgNDU4LjkyNTc4MSAyOTYuODUxNTYyIDQ0NS41MzEyNSAyODMuNDU3MDMxIDQyOS4xNzk2ODggMjgzLjQ1NzAzMSBMIDE5OC43ODUxNTYgMjgzLjQ1NzAzMSBMIDE5OC43ODUxNTYgNDk2LjY0ODQzOCBDIDE5OC43ODUxNTYgNTE5LjY5OTIxOSAyMTcuNjI4OTA2IDUzOC41NDY4NzUgMjQwLjY1NjI1IDUzOC41NDY4NzUgIiBmaWxsLW9wYWNpdHk9IjEiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPjwvc3ZnPg==" alt="Beitha" style="display:inline-block; height:18px; width:auto;" />
    </div>
  `;

  // Strong suppression so page handlers don't steal the click
  const suppress = (e: Event) => {
    isInteracting = true;
    suppressSelectionUntil = Date.now() + 500;
    e.preventDefault();
    e.stopPropagation();
    // @ts-ignore
    if ((e as any).stopImmediatePropagation) (e as any).stopImmediatePropagation();
  };
  // Bind on wrapper and inner for robustness
  quickPromptButton.addEventListener('pointerdown', suppress, true);
  quickPromptButton.addEventListener('mousedown', suppress, true);

  const inner = quickPromptButton.firstElementChild as HTMLElement | null;
  if (inner) {
    inner.addEventListener('pointerdown', suppress, true);
    inner.addEventListener('mousedown', suppress, true);
    inner.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleQuickPrompt();
    });
    inner.setAttribute('role', 'button');
    inner.setAttribute('tabindex', '0');
    inner.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleQuickPrompt();
      }
    });
  }

  quickPromptButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleQuickPrompt();
  });

  // Add to shadow root
  ensureShadow().appendChild(quickPromptButton);

  // Auto-remove after 10 seconds if not clicked
  if (quickPromptButtonTimeout) clearTimeout(quickPromptButtonTimeout);
  quickPromptButtonTimeout = setTimeout(() => {
    if (quickPromptButton && !isPromptOpen) {
      quickPromptButton.remove();
      quickPromptButton = null;
    }
  }, 10000);
}

// Handle quick prompt click
function handleQuickPrompt(): void {
  // Allow opening even if selection text was cleared by the click
  if (!selectedText.trim()) {
    const sel = window.getSelection();
    selectedText = sel ? (sel.toString().trim() || selectedText) : selectedText;
  }
  if (!quickPromptButton) return;

  // Mark prompt as open immediately to avoid cleanup from selectionchange
  isPromptOpen = true;

  // Use the stored chip coordinates so panel opens exactly where chip is
  const x = lastChipX;
  const y = lastChipY;

  // Create panel BEFORE removing chip to avoid outside clicks closing it instantly
  showPromptPanel(x, y);

  if (quickPromptButtonTimeout) clearTimeout(quickPromptButtonTimeout);
  quickPromptButton.remove();
  quickPromptButton = null;
}

function showPromptPanel(x: number, y: number): void {
  // Build container
  const panel = document.createElement('div');
  panel.id = 'beitha-quick-prompt-panel';
  panel.setAttribute('style', [
    'position: fixed',
    `top: ${y}px`,
    `left: ${x}px`,
    'z-index: 1',
    'transform-origin: top left',
    'transition: transform 120ms ease, opacity 120ms ease, top 120ms ease, left 120ms ease',
    'opacity: 0',
    'transform: scale(0.92)',
    'pointer-events: auto'
  ].join(';'));

  // Inner content (white card with input)
  const card = document.createElement('div');
  card.setAttribute('style', [
    'background: rgba(242,242,242,0.7)',
    'backdrop-filter: blur(10px)',
    '-webkit-backdrop-filter: blur(10px)',
    'color: #111827',
    'border: 1px solid rgba(229,231,235,0.6)',
    'border-radius: 20px',
    'box-shadow: 0 12px 32px rgba(0,0,0,0.20)',
    'min-width: 300px',
    'max-width: 520px',
    'padding: 14px 16px',
    'display: flex',
    'align-items: center',
    'gap: 12px',
    'font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
    'pointer-events: auto'
  ].join(';'));

  const input = document.createElement('input');
  input.type = 'text';
  input.value = selectedText;
  input.placeholder = 'Ask Beitha…';
  input.setAttribute('style', [
    'flex: 1',
    'border: none',
    'outline: none',
    'font-size: 13px',
    'background: transparent',
    'color: #111827'
  ].join(';'));

  const sendBtn = document.createElement('button');
  sendBtn.setAttribute('aria-label', 'Send');
  sendBtn.setAttribute('style', [
    'background: #d1d3d4',
    'color: #111827',
    'border: none',
    'border-radius: 9999px',
    'width: 32px',
    'height: 32px',
    'display: inline-flex',
    'align-items: center',
    'justify-content: center',
    'cursor: pointer',
    'box-shadow: 0 2px 6px rgba(0,0,0,0.12)'
  ].join(';'));
  sendBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 12L21 3L13.5 21L11.8 13.2L3 12Z" fill="currentColor"/>
    </svg>
  `;

  card.appendChild(input);
  card.appendChild(sendBtn);
  panel.appendChild(card);
  ensureShadow().appendChild(panel);

  // Smooth show (double rAF to ensure layout is committed)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      panel.style.top = `${y}px`;
      panel.style.left = `${x}px`;
      panel.style.opacity = '1';
      panel.style.transform = 'scale(1)';
      panel.style.animation = 'beithaFadeScaleIn 140ms ease';
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });

  const closePanel = () => {
    isPromptOpen = false;
    isInteracting = false;
    panel.remove();
  };

  const submit = () => {
    const prompt = input.value.trim();
    if (!prompt) return;

    // Open side panel then prefill ONLY (no autosend)
    chrome.runtime.sendMessage({ action: 'openSidePanel' }, () => {
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'setPrompt', prompt });
      }, 200);
    });

    showToast('Added to Beitha');
    closePanel();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      closePanel();
    }
  });

  sendBtn.addEventListener('click', (e) => {
    e.preventDefault();
    submit();
  });

  // Outside click: use document but ignore clicks inside shadow host
  setTimeout(() => {
    const outsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (shadowHost && shadowHost.contains(target)) return; // click inside shadow/UI
      closePanel();
      document.removeEventListener('mousedown', outsideClick, true);
    };
    document.addEventListener('mousedown', outsideClick, true);
  }, 0);
}

function showToast(message: string): void {
  const root = ensureShadow();
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.setAttribute('style', [
    'position: fixed',
    'bottom: 18px',
    'right: 18px',
    'background: #f2f2f2',
    'color: #111827',
    'border: 1px solid #e5e7eb',
    'border-radius: 14px',
    'padding: 10px 14px',
    'box-shadow: 0 8px 28px rgba(0,0,0,0.18)',
    'font-size: 12px',
    'z-index: 2'
  ].join(';'));
  root.appendChild(toast);
  toast.style.animation = 'beithaToastIn 160ms ease forwards';
  setTimeout(() => {
    toast.style.animation = 'beithaToastOut 180ms ease forwards';
    setTimeout(() => toast.remove(), 200);
  }, 1400);
}

// Handle text selection with debouncing
function handleTextSelection(): void {
  // Suppress selection handling while interacting/opening or panel is open
  if (isPromptOpen || isInteracting || Date.now() < suppressSelectionUntil) return;

  if (selectionTimeout) {
    clearTimeout(selectionTimeout);
  }

  selectionTimeout = setTimeout(() => {
    if (isPromptOpen) return; // double-check guard
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';

    if (text && text.length > 0 && selection) {
      selectedText = text;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      let buttonX = rect.right + window.scrollX + 5;
      let buttonY = rect.top + window.scrollY;
      if (buttonX + 36 > window.innerWidth) buttonX = rect.left + window.scrollX - 42;
      if (buttonY < 0) buttonY = rect.bottom + window.scrollY + 5;

      if (!isPromptOpen) {
        createQuickPromptButton(buttonX, buttonY);
      }
    } else {
      if (!isPromptOpen && quickPromptButton && !isInteracting) {
        quickPromptButton.remove();
        quickPromptButton = null;
      }
    }
  }, 80);
}

// Listen for text selection
// (selectionchange can be too aggressive; rely on mouseup/keyup with debounce)
document.addEventListener('mouseup', handleTextSelection);
document.addEventListener('keyup', handleTextSelection);
// document.addEventListener('selectionchange', handleTextSelection);

// Listen for clicks to remove button
document.addEventListener('click', (e) => {
  if (quickPromptButton && !quickPromptButton.contains(e.target as Node)) {
    quickPromptButton.remove();
    quickPromptButton = null;
  }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (quickPromptButton) {
    quickPromptButton.remove();
    quickPromptButton = null;
  }
});

// Inject styles once for smoother animations
(function injectBeithaStyles() {
  const id = 'beitha-quick-prompt-styles-global';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    /* reserved global styles if needed */
  `;
  document.head.appendChild(style);
})();

console.log('Beitha quick prompt content script loaded');

// Add a test to see if the script is working
document.addEventListener('DOMContentLoaded', () => {
  console.log('Beitha content script: DOM loaded, script is active');
});
