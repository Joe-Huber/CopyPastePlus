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

    // Capture phase listeners for reliability, without interfering with page code
    document.addEventListener('copy', handleCopyLike, true);
    document.addEventListener('cut', handleCopyLike, true);

    console.log('CopyPaste+ content script listeners attached');
  }
}