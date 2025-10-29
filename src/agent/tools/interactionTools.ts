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
          const isCssSelector = /[#.[*=:>+~]/.test(input) || 
                               input.includes(' ') || 
                               input.includes('>') || 
                               input.includes('+') || 
                               input.includes('~') ||
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
          
          if (isCssSelector) {
            await activePage.click(input);
            return `Clicked selector: ${input}`;
          }
          await activePage.getByText(input).click();
          return `Clicked element containing text: ${input}`;
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
      "Accept or dismiss the most recent alert/confirm/prompt dialog.\n" +
      "Input `accept` or `dismiss`. For prompt dialogs you may append `|text` to supply response text.",
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
