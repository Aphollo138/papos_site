import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import EmojiPicker, { Theme, EmojiClickData, SuggestionMode } from 'emoji-picker-react';

interface ChatEmojiPickerProps {
  isMobile?: boolean;
}

export const ChatEmojiPicker: React.FC<ChatEmojiPickerProps> = ({ isMobile = false }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const isLight =
      document.documentElement.getAttribute('data-bs-theme') === 'light' ||
      document.body.classList.contains('light-theme') ||
      localStorage.getItem('papos_theme') === 'light';
    return isLight ? Theme.LIGHT : Theme.DARK;
  });

  useEffect(() => {
    const checkTheme = () => {
      const isLight =
        document.documentElement.getAttribute('data-bs-theme') === 'light' ||
        document.body.classList.contains('light-theme') ||
        localStorage.getItem('papos_theme') === 'light';
      setTheme(isLight ? Theme.LIGHT : Theme.DARK);
    };

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-bs-theme', 'class'],
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    window.addEventListener('storage', checkTheme);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', checkTheme);
    };
  }, []);

  const handleEmojiClick = (emojiData: EmojiClickData, event: MouseEvent) => {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    const emoji = emojiData?.emoji;
    if (!emoji) return;

    const input = document.getElementById('message-input') as HTMLTextAreaElement | HTMLInputElement | null;
    if (input) {
      const startPos = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
      const endPos = typeof input.selectionEnd === 'number' ? input.selectionEnd : input.value.length;
      const originalValue = input.value;

      // Inserir emoji preservando todo o texto pré-existente
      input.value = originalValue.substring(0, startPos) + emoji + originalValue.substring(endPos);

      // Reposicionar o cursor logo após o emoji inserido
      const newPos = startPos + emoji.length;
      input.selectionStart = newPos;
      input.selectionEnd = newPos;

      // Manter foco no campo para digitação contínua
      try {
        input.focus();
      } catch (err) {
        // Ignora erros de foco em navegadores restritivos
      }

      // Notificar eventos de input para auto-redimensionamento e contadores
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  return (
    <div
      className="papos-react-emoji-wrapper"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <EmojiPicker
        onEmojiClick={handleEmojiClick}
        theme={theme}
        width="100%"
        height={isMobile ? 360 : 390}
        searchPlaceHolder="Pesquisar emoji..."
        lazyLoadEmojis={true}
        previewConfig={{ showPreview: false }}
        skinTonesDisabled={false}
        suggestedEmojisMode={SuggestionMode.RECENT}
      />
    </div>
  );
};

function mountEmojiPickers() {
  const desktopContainer = document.getElementById('emoji-grid-container');
  if (desktopContainer && desktopContainer.dataset.reactMounted !== 'true') {
    desktopContainer.dataset.reactMounted = 'true';
    desktopContainer.innerHTML = '';
    const root = createRoot(desktopContainer);
    root.render(<ChatEmojiPicker isMobile={false} />);
  }

  const mobileContainer = document.getElementById('mobile-emoji-grid-container');
  if (mobileContainer && mobileContainer.dataset.reactMounted !== 'true') {
    mobileContainer.dataset.reactMounted = 'true';
    mobileContainer.innerHTML = '';
    const root = createRoot(mobileContainer);
    root.render(<ChatEmojiPicker isMobile={true} />);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountEmojiPickers);
} else {
  mountEmojiPickers();
}
