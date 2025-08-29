interface CopiedItem {
  id: string;
  text: string;
  timestamp: number;
  favorite: boolean;
  count: number;
}

function updateStorageWithText(newText: string) {
  chrome.storage.local.get({ copiedItems: [] }, (result) => {
    console.log("Current items from storage:", result.copiedItems);
    let items: any = result.copiedItems;

    if (items.length > 0 && typeof items[0] === 'string') {
      items = items.map((text: any) => ({
        id: self.crypto.randomUUID(),
        text: text as string,
        timestamp: Date.now(),
        favorite: false,
        count: 1,
      }));
    }

    const existingItemIndex = items.findIndex((item: CopiedItem) => item.text === newText);

    if (existingItemIndex !== -1) {
      items[existingItemIndex].timestamp = Date.now();
      items[existingItemIndex].count++;
    } else {
      const newItem: CopiedItem = {
        id: self.crypto.randomUUID(),
        text: newText,
        timestamp: Date.now(),
        favorite: false,
        count: 1,
      };
      items.push(newItem);
    }

    items.sort((a: CopiedItem, b: CopiedItem) => b.timestamp - a.timestamp);

    if (items.length > 100) {
      items = items.slice(0, 100);
    }

    chrome.storage.local.set({ copiedItems: items }, () => {
      console.log("Updated items saved to storage:", items);
    });
  });
}

async function ensureOffscreenDocument() {
  const offscreen = (chrome as any).offscreen;
  if (!offscreen) {
    throw new Error('Offscreen API unavailable in this Chrome version');
  }
  const url = chrome.runtime.getURL('src/offscreen.html');
  try {
    await offscreen.createDocument({
      url,
      reasons: ['CLIPBOARD'],
      justification: 'Write text on item click from popup',
    });
    console.log('Offscreen document created');
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (/Only one offscreen document|already exists/i.test(msg)) {
      console.log('Offscreen document already exists');
    } else {
      console.error('Failed to create offscreen document', e);
      throw e;
    }
  }
}

function writeClipboardViaOffscreen(text: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureOffscreenDocument();
      const requestId = self.crypto.randomUUID();

      const listener = (msg: any) => {
        if (msg && msg.type === 'write-clipboard-result' && msg.requestId === requestId) {
          chrome.runtime.onMessage.removeListener(listener);
          if (msg.ok) resolve();
          else reject(new Error(msg.error || 'Clipboard write failed'));
        }
      };
      chrome.runtime.onMessage.addListener(listener);

      chrome.runtime.sendMessage({ type: 'write-clipboard', text, requestId });

      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(listener);
        reject(new Error('Clipboard write timed out'));
      }, 4000);
    } catch (err) {
      reject(err as any);
    }
  });
}

async function writeClipboardInActiveTab(text: string): Promise<void> {
  // Inject copy routine into the active tab as a fallback when Offscreen API isn't available
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs && tabs[0];
  if (!tab || !tab.id) throw new Error('No active tab available to perform clipboard copy');

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [text],
    func: (t: string) => {
      try {
        // Try async clipboard API in page context first
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(t).then(() => true).catch(() => false);
        }
      } catch (_) {}
      try {
        // Fallback to execCommand copy in page context
        const ta = document.createElement('textarea');
        ta.value = t;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (_) {
        return false;
      }
    },
    world: 'MAIN',
  });

  // results may contain a promise if writeText returned a promise; normalize
  let ok = false;
  if (Array.isArray(results) && results[0]) {
    const r = results[0].result as any;
    if (r && typeof (r as Promise<boolean>).then === 'function') {
      try { ok = await (r as Promise<boolean>); } catch { ok = false; }
    } else {
      ok = !!r;
    }
  }

  if (!ok) {
    throw new Error('Active tab clipboard copy failed');
  }
}

async function writeClipboard(text: string): Promise<void> {
  // Try offscreen path first if available; otherwise fall back to active tab injection
  const hasOffscreen = !!(chrome as any).offscreen;
  if (hasOffscreen) {
    try {
      await writeClipboardViaOffscreen(text);
      return;
    } catch (e) {
      console.warn('Offscreen copy failed, falling back to tab injection', e);
    }
  }
  await writeClipboardInActiveTab(text);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background script received a message:", request);

  if (request.type === 'copiedText') {
    updateStorageWithText(request.text);
  }

  if (request.type === 'popupCopy') {
    const text = request.text as string;
    writeClipboard(text)
      .then(() => {
        updateStorageWithText(text);
        sendResponse({ ok: true });
      })
      .catch((err) => {
        console.error('popupCopy failed', err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true; // keep the message channel open for async response
  }
});
