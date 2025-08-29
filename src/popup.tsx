import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface CopiedItem {
  id: string;
  text: string;
  timestamp: number;
  favorite: boolean;
  count: number;
}

type View = 'main' | 'recent';

const Popup = () => {
  const [allItems, setAllItems] = useState<CopiedItem[]>([]);
  const [view, setView] = useState<View>('main');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const updateItems = () => {
      chrome.storage.local.get({ copiedItems: [] }, (result) => {
        let items = result.copiedItems;
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
    chrome.storage.onChanged.addListener(updateItems);

    return () => {
      chrome.storage.onChanged.removeListener(updateItems);
    };
  }, []);



  const handleFavoriteClick = (itemToFavorite: CopiedItem) => {
    const updatedItems = allItems.map(item =>
      item.id === itemToFavorite.id ? { ...item, favorite: !item.favorite } : item
    );
    setAllItems(updatedItems);
    chrome.storage.local.set({ copiedItems: updatedItems });
  };

  const handleDeleteClick = (id: string) => {
    const updatedItems = allItems.filter(item => item.id !== id);
    setAllItems(updatedItems);
    chrome.storage.local.set({ copiedItems: updatedItems });
  };

  const clearNonFavorites = () => {
    const kept = allItems.filter(item => item.favorite);
    setAllItems(kept);
    chrome.storage.local.set({ copiedItems: kept });
  };

  const hasNonFavorites = allItems.some(item => !item.favorite);

  const handleItemClick = async (item: CopiedItem) => {
    const text = item.text;
    const flash = () => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1000);
    };

    try {
      await navigator.clipboard.writeText(text);
      flash();
      return;
    } catch (err) {
      console.warn('Popup: navigator.clipboard.writeText failed, trying background fallback', err);
    }

    try {
      chrome.runtime.sendMessage({ type: 'popupCopy', text }, (resp) => {
        if (resp && resp.ok) flash();
      });
    } catch (err) {
      console.error('Popup: failed to message background for copy', err);
    }
  };

  const renderList = (title: string, items: CopiedItem[]) => (
    <div>
      <h2>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id} className={copiedId === item.id ? 'copied' : ''}>
              <span onClick={() => handleItemClick(item)}>{item.text}</span>
              {copiedId === item.id && <span className="copied-badge">✓</span>}
              <div className="item-actions">
                <button
                  className={`star-btn ${item.favorite ? 'favorited' : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleFavoriteClick(item); }}
                  aria-label={item.favorite ? 'Unfavorite' : 'Favorite'}
                  title={item.favorite ? 'Unfavorite' : 'Favorite'}
                >
                  {item.favorite ? '★' : '☆'}
                </button>
                <button
                  className="trash-btn"
                  onClick={(e) => { e.stopPropagation(); handleDeleteClick(item.id); }}
                  aria-label="Delete"
                  title="Delete"
                >🗑</button>
              </div>
          </li>
        ))}
      </ul>
    </div>
  );

  if (view === 'recent') {
    return (
      <div style={{ width: '300px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setView('main')}>Back</button>
          <button onClick={clearNonFavorites} disabled={!hasNonFavorites}>Clear non-favorites</button>
        </div>
        {renderList("Recent Items", allItems)}
      </div>
    );
  }

  const favorites = allItems.filter(item => item.favorite);
  const mostUsed = [...allItems].sort((a, b) => b.count - a.count).slice(0, 10);
  const mostRecent = [...allItems].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

  return (
    <div style={{ width: '300px' }}>
      <h1>CopyPaste+</h1>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button onClick={clearNonFavorites} disabled={!hasNonFavorites}>Clear non-favorites</button>
        <button onClick={() => setView('recent')}>View All Recent Copies</button>
      </div>
      {renderList("Favorites", favorites)}
      {renderList("Most Used", mostUsed)}
      {renderList("Most Recent", mostRecent)}
    </div>
  );
};

ReactDOM.render(<Popup />, document.getElementById('root'));
