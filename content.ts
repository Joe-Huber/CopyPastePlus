document.addEventListener("copy", (e) => {
  const selectedText = window.getSelection()?.toString();
  if (selectedText) {
    chrome.runtime.sendMessage({type: "copiedText", text: selectedText});
  }
});

['copy', 'cut', 'paste'].forEach(event => {
  document.addEventListener(event, e => e.stopImmediatePropagation(), true);
});
