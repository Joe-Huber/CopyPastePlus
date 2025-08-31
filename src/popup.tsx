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
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [truncateItems, setTruncateItems] = useState<boolean>(true);
  const [hideMostRecent, setHideMostRecent] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const updateItems = () => {
      chrome.storage.local.get({ copiedItems: [], truncateItems: true, hideMostRecent: false, theme: 'dark' }, (result) => {
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
        setTruncateItems(result.truncateItems);
        setHideMostRecent(result.hideMostRecent);
        setTheme(result.theme);
      });
    };

    updateItems();
    chrome.storage.onChanged.addListener(updateItems);

    return () => {
      chrome.storage.onChanged.removeListener(updateItems);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const id = 'light-theme-css';
    const href = './popup.light.css';
    const existing = document.getElementById(id) as HTMLLinkElement | null;
    if (theme === 'light') {
      if (!existing) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      }
    } else {
      if (existing) existing.remove();
    }
  }, [theme]);


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
          <li key={item.id} className={copiedId === item.id ? 'copied' : ''} onClick={() => handleItemClick(item)}>
              <span className={`item-text ${truncateItems ? 'truncate' : 'wrap'}`}>{item.text}</span>
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
      <div className="popup-container">
        <div className="top-bar">
          <h1>CopyPaste+</h1>
          <button
            className="icon-btn settings-btn"
            aria-label={settingsOpen ? 'Close settings' : 'Open settings'}
            title="Settings"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            ⚙️
          </button>
        </div>
        <div className="controls-row">
          <button onClick={() => setView('main')}>Back</button>
          <button onClick={clearNonFavorites} disabled={!hasNonFavorites}>Clear non-favorites</button>
        </div>
        {renderList("Recent Items", allItems)}

        {settingsOpen && (
          <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3 id="settings-title" style={{ margin: 0, fontSize: '14px' }}>Settings</h3>
                <button
                  className="icon-btn close-btn"
                  aria-label="Close settings"
                  title="Close"
                  onClick={() => setSettingsOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className="modal-content">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={theme === 'light'}
                    onChange={(e) => {
                      const light = (e.target as HTMLInputElement).checked;
                      const next = light ? 'light' : 'dark';
                      setTheme(next);
                      chrome.storage.local.set({ theme: next });
                    }}
                  />
                  Use light mode
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <input
                    type="checkbox"
                    checked={truncateItems}
                    onChange={(e) => {
                      const val = (e.target as HTMLInputElement).checked;
                      setTruncateItems(val);
                      chrome.storage.local.set({ truncateItems: val });
                    }}
                  />
                  Truncate long items
                </label>
                <p style={{ marginTop: 8, color: 'var(--muted)' }}>
                  When enabled, long items are shortened with an ellipsis.
                </p>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <input
                    type="checkbox"
                    checked={hideMostRecent}
                    onChange={(e) => {
                      const val = (e.target as HTMLInputElement).checked;
                      setHideMostRecent(val);
                      chrome.storage.local.set({ hideMostRecent: val });
                    }}
                  />
                  Hide "Most Recent" on main page
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const favorites = allItems.filter(item => item.favorite);
  const mostUsed = [...allItems].sort((a, b) => b.count - a.count).slice(0, 10);
  const mostRecent = [...allItems].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

  return (
    <div className="popup-container">
      <div className="top-bar">
        <h1>CopyPaste+</h1>
        <button
          className="icon-btn settings-btn"
          aria-label={settingsOpen ? 'Close settings' : 'Open settings'}
          title="Settings"
          onClick={() => setSettingsOpen((v) => !v)}
        >
          ⚙️
        </button>
      </div>

      <div className="controls-row">
        <button onClick={clearNonFavorites} disabled={!hasNonFavorites}>Clear non-favorites</button>
        <button onClick={() => setView('recent')}>View All Recent Copies</button>
      </div>

      {renderList("Favorites", favorites)}
      {renderList("Most Used", mostUsed)}
      {!hideMostRecent && renderList("Most Recent", mostRecent)}

      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="settings-title" style={{ margin: 0, fontSize: '14px' }}>Settings</h3>
              <button
                className="icon-btn close-btn"
                aria-label="Close settings"
                title="Close"
                onClick={() => setSettingsOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-content">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={theme === 'light'}
                  onChange={(e) => {
                    const light = (e.target as HTMLInputElement).checked;
                    const next = light ? 'light' : 'dark';
                    setTheme(next);
                    chrome.storage.local.set({ theme: next });
                  }}
                />
                Use light mode
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={truncateItems}
                  onChange={(e) => {
                    const val = (e.target as HTMLInputElement).checked;
                    setTruncateItems(val);
                    chrome.storage.local.set({ truncateItems: val });
                  }}
                />
                Truncate long items
              </label>
              <p style={{ marginTop: 8, color: 'var(--muted)' }}>
                When enabled, long items are shortened with an ellipsis.
              </p>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={hideMostRecent}
                  onChange={(e) => {
                    const val = (e.target as HTMLInputElement).checked;
                    setHideMostRecent(val);
                    chrome.storage.local.set({ hideMostRecent: val });
                  }}
                />
                Hide "Most Recent" on main page
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ReactDOM.render(<Popup />, document.getElementById('root'));
