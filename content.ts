console.log("CopyPaste+ content script loaded.");

document.addEventListener('copy', (e) => {
  console.log("Copy event detected by CopyPaste+!");
  const selectedText = window.getSelection()?.toString();
  if (selectedText) {
    console.log("Sending text to background:", selectedText);
    chrome.runtime.sendMessage({ type: "copiedText", text: selectedText });
  }
  e.stopImmediatePropagation();
}, true);

['cut', 'paste'].forEach(event => {
  document.addEventListener(event, e => e.stopImmediatePropagation(), true);
});
