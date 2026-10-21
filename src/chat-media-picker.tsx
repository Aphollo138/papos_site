import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import EmojiPicker, { Theme, EmojiClickData, SuggestionMode } from 'emoji-picker-react';

export function EmojiPickerApp() {
  const [theme, setTheme] = useState<Theme>(() => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light' ||
                    document.body.getAttribute('data-theme') === 'light' ||
                    localStorage.getItem('papos_theme') === 'light';
    return isLight ? Theme.LIGHT : Theme.DARK;
  });

  useEffect(() => {
    const updateTheme = () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light' ||
                      document.body.getAttribute('data-theme') === 'light' ||
                      localStorage.getItem('papos_theme') === 'light';
      setTheme(isLight ? Theme.LIGHT : Theme.DARK);
    };

    window.addEventListener('papos_theme_change', updateTheme);

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      window.removeEventListener('papos_theme_change', updateTheme);
      observer.disconnect();
    };
  }, []);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const input = document.getElementById('message-input') as HTMLTextAreaElement | HTMLInputElement | null;
    if (!input) return;

    const startPos = input.selectionStart ?? input.value.length;
    const endPos = input.selectionEnd ?? input.value.length;
    const text = input.value;
    const emoji = emojiData.emoji;

    input.value = text.substring(0, startPos) + emoji + text.substring(endPos);
    const nextCursor = startPos + emoji.length;
    input.setSelectionRange(nextCursor, nextCursor);
    input.focus();

    // Trigger input event to toggle send button state and auto-resize
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  return (
    <div className="papos-emoji-picker-container" style={{ width: '100%', maxWidth: '100%' }}>
      <EmojiPicker
        onEmojiClick={handleEmojiClick}
        theme={theme}
        width="100%"
        height={300}
        lazyLoadEmojis={true}
        searchPlaceHolder="Pesquisar emoji..."
        suggestedEmojisMode={SuggestionMode.RECENT}
        previewConfig={{
          showPreview: false
        }}
      />
    </div>
  );
}

export function mountEmojiPicker() {
  const container = document.getElementById('emoji-picker-react-root');
  if (!container || (container as any).__reactRootMounted) return;

  try {
    const root = createRoot(container);
    root.render(<EmojiPickerApp />);
    (container as any).__reactRootMounted = true;
  } catch (err) {
    console.error('Error mounting EmojiPickerReact:', err);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountEmojiPicker);
  } else {
    mountEmojiPicker();
  }
}

// Attach to window so chat.js can safely invoke it when opening the emojis tab
if (typeof window !== 'undefined') {
  (window as any).mountEmojiPicker = mountEmojiPicker;
}
