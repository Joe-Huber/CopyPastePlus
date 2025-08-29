import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface CopiedItem {
  id: string;
  text: string;
  timestamp: number;
  favorite: boolean;
  count: number;
}

const Popup = () => {
  const [allItems, setAllItems] = useState<CopiedItem[]>([]);

  useEffect(() => {
    const updateItems = () => {
      chrome.storage.local.get({ copiedItems: [] }, (result) => {
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
          chrome.storage.local.set({ copiedItems: items });
        }
        setAllItems(items);
      });
    };

    updateItems();
    // Listen for changes in storage
    chrome.storage.onChanged.addListener(updateItems);

    return () => {
      chrome.storage.onChanged.removeListener(updateItems);
    };
  }, []);

  const handleItemClick = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      window.close();
    });
  };

  const handleFavoriteClick = (itemToFavorite: CopiedItem) => {
    const updatedItems = allItems.map(item =>
      item.id === itemToFavorite.id ? { ...item, favorite: !item.favorite } : item
    );
    setAllItems(updatedItems);
    chrome.storage.local.set({ copiedItems: updatedItems });
  };

  const favorites = allItems.filter(item => item.favorite);
  const mostUsed = [...allItems].sort((a, b) => b.count - a.count).slice(0, 10);
  const recent = allItems;

  const renderList = (title: string, items: CopiedItem[]) => (
    <div>
      <h2>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <span onClick={() => handleItemClick(item.text)}>{item.text}</span>
            <button onClick={() => handleFavoriteClick(item)}>Favorite</button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div style={{ width: '300px' }}>
      <h1>CopyPaste+</h1>
      {renderList("Favorites", favorites)}
      {renderList("Most Used", mostUsed)}
      {renderList("Recent", recent)}
    </div>
  );
};

ReactDOM.render(<Popup />, document.getElementById('root'));
