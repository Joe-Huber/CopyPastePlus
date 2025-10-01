console.log("CopyPaste+ content script initializing", {
  href: location.href,
  topFrame: window.top === window,
});

// Guard against contexts where the extension APIs are unavailable (e.g., some sandboxed/opaque frames)
const EXT_AVAILABLE = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
if (!EXT_AVAILABLE) {
  console.warn('CopyPaste+ content: chrome.runtime unavailable in this frame; skipping listeners.');
} else {
  // Prevent duplicate initialization if injected multiple times
  const w = window as any;
  if (w.__cpp_inited) {
    console.debug('CopyPaste+ content: listeners already attached in this frame.');
  } else {
    w.__cpp_inited = true;

    const getCopiedText = (e: ClipboardEvent): string | null => {
      try {
        const target = e.target as Element | null;
        // Handle input/textarea selections
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          const start = target.selectionStart ?? 0;
          const end = target.selectionEnd ?? 0;
          if (start !== end) {
            const fromField = target.value.substring(start, end).trim();
            if (fromField) return fromField;
          }
        }
        // Fallback to window selection
        const sel = window.getSelection()?.toString() ?? '';
        if (sel.trim()) return sel.trim();
        // As a last resort, if page code set clipboardData
        if (e.clipboardData) {
          const dt = e.clipboardData.getData('text/plain');
          if (dt && dt.trim()) return dt.trim();
        }
      } catch (err) {
        console.error('CopyPaste+ content: error extracting copied text', err);
      }
      return null;
    };

    const sendCopied = (text: string) => {
      try {
        chrome.runtime.sendMessage({ type: 'copiedText', text });
      } catch (err) {
        console.error('CopyPaste+ content: failed to send message to background', err);
      }
    };

    const handleCopyLike = (e: ClipboardEvent) => {
      try {
        const text = getCopiedText(e);
        if (text) {
          console.debug('CopyPaste+ captured text:', text.slice(0, 200));
          sendCopied(text);
        }
      } catch (err) {
        console.error('CopyPaste+ content: handler error', err);
      }
      // Do NOT stop propagation; avoid breaking page behavior
    };

    // Enable copy on sites that block it: CSS override, remove inline blockers, and capture-phase unblocking
    (function enableCopyInit() {
      try {
        // 1) CSS override to force-enable selection across the page
        const injectEnableSelectionCSS = () => {
          const id = 'cpp-allow-copy-style';
          if (document.getElementById(id)) return;
          const style = document.createElement('style');
          style.id = id;
          style.textContent = `
html, body, body * {
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
  user-select: text !important;
}
[unselectable="on"], [unselectable="true"] {
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
  user-select: text !important;
}
`;
          (document.head || document.documentElement).appendChild(style);
        };

        // 2) Remove inline attributes that block copying and selection
        const BLOCK_ATTRS = ['oncopy','oncut','onpaste','oncontextmenu','onselectstart','ondragstart'] as const;
        const processElement = (el: Element) => {
          for (const a of BLOCK_ATTRS) {
            if (el.hasAttribute(a)) el.removeAttribute(a);
            try { (el as any)[a] = null; } catch { /* noop */ }
          }
          const unselectable = el.getAttribute('unselectable');
          if (unselectable === 'on' || unselectable === 'true') el.removeAttribute('unselectable');
        };
        const neuterInlineBlockers = (root?: ParentNode) => {
          const scope: ParentNode = root || document;
          if ((scope as any).querySelectorAll) {
            (scope as Document | Element | DocumentFragment).querySelectorAll('*').forEach(processElement);
          }
          if (scope instanceof Document) {
            if (scope.documentElement) processElement(scope.documentElement);
          } else if (scope instanceof Element) {
            processElement(scope);
          }
        };
        const observeMutations = () => {
          const mo = new MutationObserver((muts) => {
            for (const m of muts) {
              if (m.type === 'attributes') {
                const name = m.attributeName;
                if (!name) continue;
                if (BLOCK_ATTRS.includes(name as any) || name === 'unselectable') {
                  if (m.target instanceof Element) processElement(m.target);
                }
              } else if (m.type === 'childList') {
                m.addedNodes.forEach((n) => {
                  if (n.nodeType === Node.ELEMENT_NODE) neuterInlineBlockers(n as Element);
                });
              }
            }
          });
          mo.observe(document, { subtree: true, childList: true, attributes: true });
        };

        // 3) Capture-phase unblocking for copy/cut sequences triggered by user (Ctrl/Cmd+C/X)
        let lastCopyKeyTs = 0;
        const onKeyDownCapture = (e: KeyboardEvent) => {
          const key = (e.key || '').toLowerCase();
          if ((e.ctrlKey || e.metaKey) && (key === 'c' || key === 'x')) {
            lastCopyKeyTs = Date.now();
          }
        };
        const onCopyCutCapture = (e: Event) => {
          if (Date.now() - lastCopyKeyTs < 1500) {
            // Mirror our own capture to persist the copied text even if we block page handlers
            try { handleCopyLike(e as ClipboardEvent); } catch { /* noop */ }
            if (typeof (e as any).stopImmediatePropagation === 'function') {
              (e as any).stopImmediatePropagation();
            } else {
              e.stopPropagation();
            }
            // DO NOT call preventDefault; allow native copy/cut to proceed
          }
        };

        // Execute the steps
        injectEnableSelectionCSS();
        neuterInlineBlockers();
        observeMutations();
        document.addEventListener('keydown', onKeyDownCapture, true);
        document.addEventListener('copy', onCopyCutCapture, true);
        document.addEventListener('cut', onCopyCutCapture, true);
      } catch (err) {
        console.warn('CopyPaste+ content: enableCopyInit failed', err);
      }
    })();

    // Capture phase listeners for reliability, without interfering with page code
    document.addEventListener('copy', handleCopyLike, true);
    document.addEventListener('cut', handleCopyLike, true);

    console.log('CopyPaste+ content script listeners attached');
  }
}