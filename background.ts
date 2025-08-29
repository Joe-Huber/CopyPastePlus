interface CopiedItem {
  id: string;
  text: string;
  timestamp: number;
  favorite: boolean;
  count: number;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in background script:", request);
  if (request.type === "copiedText") {
    const newText = request.text;
    chrome.storage.local.get({ copiedItems: [] }, (result) => {
      console.log("Current items from storage:", result.copiedItems);
      let items = result.copiedItems;

      // Handle migration from old string[] format
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
});
