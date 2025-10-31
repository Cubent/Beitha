import { DynamicTool } from "langchain/tools";
import type { Page } from "playwright-crx";
import { ToolFactory } from "./types";
import { installDialogListener, lastDialog, resetDialog, withActivePage } from "./utils";

export const browserClick: ToolFactory = (page: Page) =>
  new DynamicTool({
    name: "browser_click",
    description:
      "Click an element. Input may be a CSS selector or literal text to match on the page.",
    func: async (input: string) => {
      try {
        return await withActivePage(page, async (activePage) => {
          // Check if input looks like a CSS selector (contains CSS selector patterns)
          // Long text with spaces and punctuation is likely text content, not a selector
          const hasSelectorPatterns = /[#.[*=:>+~]/.test(input) || 
                                       input.startsWith('a[') ||
                                       input.startsWith('div[') ||
                                       input.startsWith('button[') ||
                                       input.startsWith('input[') ||
                                       input.startsWith('span[') ||
                                       input.startsWith('p[') ||
                                       input.startsWith('h1[') ||
                                       input.startsWith('h2[') ||
                                       input.startsWith('h3[') ||
                                       input.startsWith('h4[') ||
                                       input.startsWith('h5[') ||
                                       input.startsWith('h6[');
          
          // If it looks like text content (long, has spaces, punctuation, quotes), treat as text first
          const looksLikeText = input.length > 30 || 
                                (input.includes(' ') && !hasSelectorPatterns) ||
                                /[.,!?'"–—]/.test(input);
          
          // If it has clear selector patterns and doesn't look like text, try as selector first
          if (hasSelectorPatterns && !looksLikeText) {
            try {
              await activePage.click(input);
              return `Clicked selector: ${input}`;
            } catch (selectorError) {
              // If selector fails, fall back to text click
              // Continue to text click below
            }
          }
          
          // Try clicking by text (exact or partial match)
          // This handles both text content and fallback from failed selector attempts
          try {
            // Try exact match first
            try {
              await activePage.getByText(input, { exact: true }).first().click();
              return `Clicked element with exact text: ${input}`;
            } catch (exactError) {
              // Try partial match (more flexible)
              await activePage.getByText(input, { exact: false }).first().click();
              return `Clicked element containing text: ${input}`;
            }
          } catch (textError) {
            // If text matching fails and it looks like a selector, try that as fallback
            if (hasSelectorPatterns && !looksLikeText) {
              throw textError;
            }
            // Otherwise, try using locator with more flexible matching
            try {
              const locator = activePage.locator(`text="${input}"`).first();
              if (await locator.count() > 0) {
                await locator.click();
                return `Clicked element containing text: ${input}`;
              }
            } catch (locatorError) {
              // Last resort: try as CSS selector if it's short and simple
              if (input.length < 50 && !input.includes(' ')) {
                try {
                  await activePage.click(input);
                  return `Clicked selector: ${input}`;
                } catch (finalError) {
                  throw textError;
                }
              } else {
                throw textError;
              }
            }
            throw textError;
          }
        });
      } catch (error) {
        return `Error clicking '${input}': ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    },
  });

export const browserType: ToolFactory = (page: Page) =>
  new DynamicTool({
    name: "browser_type",
    description:
      "Type text. Format: selector|text (e.g. input[name=\"q\"]|hello)",
    func: async (input: string) => {
      try {
        return await withActivePage(page, async (activePage) => {
          const [selector, text] = input.split("|");
          if (!selector || !text) {
            return "Error: expected 'selector|text'";
          }
          await activePage.fill(selector, text);
          return `Typed "${text}" into ${selector}`;
        });
      } catch (error) {
        return `Error typing into '${input}': ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    },
  });

export const browserHandleDialog: ToolFactory = (page: Page) => {
  // Install dialog listener with the active page
  installDialogListener(page);

  return new DynamicTool({
    name: "browser_handle_dialog",
    description:
      "Accept or dismiss JavaScript alert/confirm/prompt dialogs ONLY. This tool is for native browser dialogs, NOT for cookie consent banners or privacy popups.\n" +
      "Input `accept` or `dismiss`. For prompt dialogs you may append `|text` to supply response text.\n" +
      "WARNING: Do NOT use this tool for cookie banners, privacy popups, or consent modals - use browser_dismiss_popups instead.",
    func: async (input: string) => {
      try {
        if (!lastDialog)
          return "Error: no dialog is currently open or was detected.";
        const [action, text] = input.split("|").map(s => s.trim().toLowerCase());
        if (action !== "accept" && action !== "dismiss")
          return "Error: first part must be `accept` or `dismiss`.";
        if (action === "accept")
          await lastDialog.accept(text || undefined);
        else await lastDialog.dismiss();
        const type = lastDialog.type();
        resetDialog();
        return `${action === "accept" ? "Accepted" : "Dismissed"} ${type} dialog.`;
      } catch (err) {
        return `Error handling dialog: ${
          err instanceof Error ? err.message : String(err)
        }`;
      }
    },
  });
};
