import { DynamicTool } from "langchain/tools";
import type { Page, Frame } from "playwright-crx";
import { ToolFactory } from "./types";
import { withActivePage } from "./utils";
import { normalizeDomain } from '../../tracking/domainUtils';
import { MemoryService } from '../../tracking/memoryService';
import { logWithTimestamp } from '../../background/utils';

export const browserDismissPopups: ToolFactory = (page: Page) =>
  new DynamicTool({
    name: "browser_dismiss_popups",
    description:
      "Dismiss cookie consent banners, privacy popups, and blocking modals (e.g., Fides/NYTimes). Use this tool for ANY cookie/privacy banner or blocking popup on the page - it will automatically find and click Accept/Agree/Consent buttons. Works with iframes and multilingual banners. IMPORTANT: Use this tool for cookie/privacy consent banners, NOT browser_handle_dialog (which is only for JavaScript alert/confirm/prompt dialogs).",
    func: async (_input: string) => {
      try {
        return await withActivePage(page, async (activePage) => {
          const acceptNameRegexes = [
            /accept( all|\s+and\s+continue)?/i,
            /agree/i,
            /consent/i,
            /allow/i,
            /ok(ay)?/i,
            /accetta( e continua)?/i,
            /consenti/i,
            /acept(ar|o|o todo|ar todo)/i,
            /j'?accepte|tout accepter/i,
            /autoriser|autorisez/i,
            /akzeptieren|zustimmen|alle akzeptieren/i,
            /akkoord|toestaan|alles accepteren/i
          ];

          const clickedReasons: string[] = [];

          const tryClickInFrame = async (frame: Frame): Promise<boolean> => {
            // Priority 1: Try inside dialogs first
            for (const regex of acceptNameRegexes) {
              const loc = frame.locator('[role="dialog"], [aria-modal="true"], [class*="fides" i], [id*="fides" i]').locator('button, [role="button"], input[type="submit"], input[type="button"]').filter({ hasText: regex });
              if (await loc.count().catch(() => 0)) {
                try {
                  await loc.first().click({ timeout: 1500 });
                  clickedReasons.push(`accept(dialog):${regex}`);
                  return true;
                } catch {}
              }
            }

            // Priority 2: Any visible accept button in the frame
            for (const regex of acceptNameRegexes) {
              const byRole = frame.getByRole('button', { name: regex });
              if (await byRole.count().catch(() => 0)) {
                try {
                  await byRole.first().click({ timeout: 1500 });
                  clickedReasons.push(`accept(role):${regex}`);
                  return true;
                } catch {}
              }

              const generic = frame.locator('button, [role="button"], input[type="submit"], input[type="button"]').filter({ hasText: regex });
              if (await generic.count().catch(() => 0)) {
                try {
                  await generic.first().click({ timeout: 1500 });
                  clickedReasons.push(`accept(any):${regex}`);
                  return true;
                } catch {}
              }
            }

            // Avoid clicking navigation links like "Manage preferences" or policy links
            const disallowText = /(manage (privacy )?preferences|cookie policy|privacy policy)/i;
            const disallowHref = /(cookie|privacy)/i;
            const links = frame.locator('a').filter({ hasText: disallowText });
            try {
              if (await links.count()) {
                // Intentionally do nothing with these links
              }
            } catch {}

            // Priority 3: Close/X controls
            const xSelectors = [
              '[aria-label*="close" i]','[title*="close" i]',
              '.close, .Close, .button-close, .modal-close, .fides-close',
              'button[aria-label*="dismiss" i]'
            ].join(',');
            const x = frame.locator(xSelectors).first();
            try {
              if (await x.count()) {
                await x.click({ timeout: 1200 });
                clickedReasons.push('close(x)');
                return true;
              }
            } catch {}

            return false;
          };

          // Retry loop across all frames
          let dismissed = false;
          for (let attempt = 0; attempt < 4; attempt++) {
            const frames = activePage.frames();
            for (const f of frames) {
              if (await tryClickInFrame(f)) {
                await activePage.waitForTimeout(250);
                dismissed = true;
                break;
              }
            }
            if (dismissed) break;
            await activePage.waitForTimeout(300);
          }

          // If we successfully dismissed popups, save a memory for this domain
          if (dismissed && clickedReasons.length > 0) {
            try {
              const currentUrl = activePage.url();
              const domain = normalizeDomain(currentUrl);
              
              if (domain) {
                const memoryService = MemoryService.getInstance();
                const memory = {
                  domain,
                  taskDescription: "Dismiss cookie consent banners and popups",
                  toolSequence: ["browser_dismiss_popups"],
                  createdAt: Date.now()
                };
                await memoryService.storeMemory(memory);
                logWithTimestamp(`Saved memory for cookie banner dismissal on ${domain}`);
              }
            } catch (memoryError) {
              // Log but don't fail the tool if memory saving fails
              logWithTimestamp(`Error saving memory for cookie banner dismissal: ${memoryError instanceof Error ? memoryError.message : String(memoryError)}`, 'warn');
            }
          }

          if (dismissed) {
            return `Dismissed popups: ${clickedReasons.join(', ')}`;
          }

          // Fallback: DOM evaluation heuristics (same as before, but used only if locator approach fails)
          const result: string = await activePage.evaluate(async () => {
            const clicked: string[] = [];

            const tryClick = (el: Element, reason: string) => {
              try { (el as HTMLElement).click(); clicked.push(reason); return true; } catch { return false; }
            };

            try { const b = document.body as HTMLElement; if (b) { if (b.style.overflow === "hidden") b.style.overflow = ""; if (b.style.position === "fixed") b.style.position = ""; } } catch {}

            const collectContainers = () => Array.from(document.querySelectorAll<HTMLElement>('[id*="cookie" i],[class*="cookie" i],[aria-label*="cookie" i],[id*="consent" i],[class*="consent" i],[aria-label*="consent" i],[role="dialog"],[aria-modal="true"],[class*="fides" i],[id*="fides" i]'));
            const addClickable = (root: ParentNode | Document, s: Set<HTMLElement>) => root.querySelectorAll<HTMLElement>('button,[role="button"],input[type="button"],input[type="submit"],[aria-label],[title]').forEach((e)=>s.add(e));
            const textOf = (el: HTMLElement)=> (el.innerText||el.textContent||"").trim();
            const acceptRegexes = [/accept( all|\s+and\s+continue)?/i,/agree/i,/consent/i,/allow/i,/ok(ay)?/i,/accetta( e continua)?/i,/consenti/i,/acept(ar|o|o todo|ar todo)/i,/j'?accepte|tout accepter/i,/autoriser|autorisez/i,/akzeptieren|zustimmen|alle akzeptieren/i,/akkoord|toestaan|alles accepteren/i];
            const closeRegexes = [/close|dismiss|got it|understood|understand/i,/chiudi|chiudere/i,/ok/i];
            const disallowText = /(manage (privacy )?preferences|cookie policy|privacy policy)/i;
            const disallowHref = /(cookie|privacy)/i;
            const isVisible = (el: HTMLElement)=>{ const r=el.getBoundingClientRect(); const st=getComputedStyle(el); return r.width>0&&r.height>0&&st.visibility!=='hidden'&&st.display!=='none'; };

            for (let attempt=0; attempt<3 && clicked.length===0; attempt++) {
              const clickable = new Set<HTMLElement>();
              const containers = collectContainers();
              const dialogish = containers.filter(c=>c.matches('[role="dialog"], [aria-modal="true"], [class*="fides" i], [id*="fides" i]'));
              dialogish.forEach((c)=>addClickable(c, clickable));
              if (clickable.size===0) addClickable(document, clickable);
              containers.forEach((c)=>addClickable(c, clickable));

              for (const el of clickable) {
                if (!isVisible(el as HTMLElement)) continue; const txt = textOf(el as HTMLElement); if (!txt) continue;
                if (disallowText.test(txt)) continue;
                if (el instanceof HTMLAnchorElement && (disallowHref.test(el.href||'') || disallowText.test(txt))) continue;
                if (acceptRegexes.some(r=>r.test(txt))) { if (tryClick(el, `accept:'${txt.slice(0,50)}'`)) break; }
              }

              if (clicked.length===0) {
                for (const c of dialogish.length?dialogish:containers) {
                  const btn = c.querySelector<HTMLElement>('button,[role="button"],input[type="submit"],input[type="button"]');
                  if (btn && isVisible(btn)) { const txt=textOf(btn); if (disallowText.test(txt)) continue; if (tryClick(btn, txt?`container-button:'${txt.slice(0,50)}'`:'container-button')) break; }
                }
              }

              if (clicked.length===0) {
                const x = document.querySelector<HTMLElement>('[aria-label*="close" i], [title*="close" i], .close, .Close, .button-close, .modal-close, .fides-close, button[aria-label*="dismiss" i]');
                if (x && isVisible(x)) { if (tryClick(x, 'icon-close')) break; }
              }

              if (clicked.length===0) await new Promise(r=>setTimeout(r,250));
            }

            await new Promise(r=>setTimeout(r,200));
            return clicked.length?`Dismissed popups (fallback): ${clicked.join(', ')}`:'No obvious popups/cookie banners found or clickable.';
          });

          // If fallback successfully dismissed popups, save a memory for this domain
          if (result && typeof result === 'string' && result.startsWith('Dismissed popups')) {
            try {
              const currentUrl = activePage.url();
              const domain = normalizeDomain(currentUrl);
              
              if (domain) {
                const memoryService = MemoryService.getInstance();
                const memory = {
                  domain,
                  taskDescription: "Dismiss cookie consent banners and popups",
                  toolSequence: ["browser_dismiss_popups"],
                  createdAt: Date.now()
                };
                await memoryService.storeMemory(memory);
                logWithTimestamp(`Saved memory for cookie banner dismissal on ${domain}`);
              }
            } catch (memoryError) {
              // Log but don't fail the tool if memory saving fails
              logWithTimestamp(`Error saving memory for cookie banner dismissal: ${memoryError instanceof Error ? memoryError.message : String(memoryError)}`, 'warn');
            }
          }

          await activePage.waitForTimeout(200);
          return result;
        });
      } catch (error) {
        return `Error dismissing popups: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
