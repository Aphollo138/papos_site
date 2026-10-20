import React, { useState, useEffect, useRef, useMemo } from 'react';
import EmojiPicker, { Theme as EmojiTheme, EmojiClickData } from 'emoji-picker-react';
import { GifPicker, Theme as GifTheme } from 'gif-picker-react';
import 'gif-picker-react/style.css';
import { Giphy } from 'gif-picker-react/providers/giphy';
import { Klipy } from 'gif-picker-react/providers/klipy';

// Declaração de tipos globais expostos para integração com o chat
declare global {
  interface Window {
    insertEmojiAtCursor?: (emoji: string) => void;
    sendMediaMessage?: (mediaType: 'gif' | 'sticker', mediaUrl: string, caption?: string) => void;
    PaposMediaPicker?: {
      open: (tab?: 'emojis' | 'gifs' | 'stickers') => void;
      close: () => void;
      toggle: (tab?: 'emojis' | 'gifs' | 'stickers') => void;
      isOpen: () => boolean;
    };
  }
}

export interface StickerItem {
  id: string;
  name: string;
  pack: 'divertidas' | 'reacoes' | 'animais' | 'memes';
  url: string;
  category: string;
}

const STICKER_PACKS: Record<string, { label: string; icon: string; items: StickerItem[] }> = {
  divertidas: {
    label: 'Divertidas',
    icon: '🎉',
    items: [
      { id: 'festa', name: 'Partiu Festa!', pack: 'divertidas', url: '/assets/stickers/divertidas/festa.svg', category: 'festa comemoração animado' },
      { id: 'danca', name: 'No Passinho', pack: 'divertidas', url: '/assets/stickers/divertidas/danca.svg', category: 'dança música passinho festa' },
      { id: 'pipoquinha', name: 'De Olho...', pack: 'divertidas', url: '/assets/stickers/divertidas/pipoquinha.svg', category: 'pipoca fofoca observando cinema' },
      { id: 'foguete', name: 'Bora Voar!', pack: 'divertidas', url: '/assets/stickers/divertidas/foguete.svg', category: 'foguete voar bora sucesso' },
      { id: 'cafezinho', name: 'Pausa pro Café', pack: 'divertidas', url: '/assets/stickers/divertidas/cafezinho.svg', category: 'café pausa descanso bom dia' },
      { id: 'dormindo', name: 'Partiu Sono', pack: 'divertidas', url: '/assets/stickers/divertidas/dormindo.svg', category: 'dormir sono noite zzz cansado' },
      { id: 'rock', name: 'Show Demais', pack: 'divertidas', url: '/assets/stickers/divertidas/rock.svg', category: 'show rock metal incrível top' },
      { id: 'parabens', name: 'Mandou Bem!', pack: 'divertidas', url: '/assets/stickers/divertidas/parabens.svg', category: 'campeão troféu parabéns vitória' }
    ]
  },
  reacoes: {
    label: 'Reações',
    icon: '❤️',
    items: [
      { id: 'amei', name: 'Amei Demais!', pack: 'reacoes', url: '/assets/stickers/reacoes/amei.svg', category: 'amor coração amei lindo fofo' },
      { id: 'chocado', name: 'Eitaaa!', pack: 'reacoes', url: '/assets/stickers/reacoes/chocado.svg', category: 'eita chocado susto bicho surpresa' },
      { id: 'chorando_rir', name: 'Morri de Rir', pack: 'reacoes', url: '/assets/stickers/reacoes/chorando_rir.svg', category: 'rir risada engraçado choro kkk' },
      { id: 'palmas', name: 'Palmas!', pack: 'reacoes', url: '/assets/stickers/reacoes/palmas.svg', category: 'palmas parabéns aplausos show' },
      { id: 'joinha', name: '100% Aprovado', pack: 'reacoes', url: '/assets/stickers/reacoes/joinha.svg', category: 'joinha top sim aprovado legal' },
      { id: 'duvida', name: 'Será Mesmo?', pack: 'reacoes', url: '/assets/stickers/reacoes/duvida.svg', category: 'dúvida hum pensativo será pergunta' },
      { id: 'calor', name: 'Que Calor!', pack: 'reacoes', url: '/assets/stickers/reacoes/calor.svg', category: 'calor sol quente derretendo' },
      { id: 'perfeito', name: 'Nota Dez!', pack: 'reacoes', url: '/assets/stickers/reacoes/perfeito.svg', category: 'cem nota dez perfeito nota 10' }
    ]
  },
  animais: {
    label: 'Animais',
    icon: '🐱',
    items: [
      { id: 'gatinho', name: 'Miau Miau', pack: 'animais', url: '/assets/stickers/animais/gatinho.svg', category: 'gato gatinho pet miau fofo' },
      { id: 'doguinho', name: 'Au Au Feliz', pack: 'animais', url: '/assets/stickers/animais/doguinho.svg', category: 'cachorro cão dog feliz au au' },
      { id: 'pandinha', name: 'Zen Total', pack: 'animais', url: '/assets/stickers/animais/pandinha.svg', category: 'panda calmo paz zen relax' },
      { id: 'raposinha', name: 'Esperta!', pack: 'animais', url: '/assets/stickers/animais/raposinha.svg', category: 'raposa esperta astuta fofa' },
      { id: 'coelhinho', name: 'Saltitando', pack: 'animais', url: '/assets/stickers/animais/coelhinho.svg', category: 'coelho pulo páscoa fofo' },
      { id: 'ursinho', name: 'Abraço!', pack: 'animais', url: '/assets/stickers/animais/ursinho.svg', category: 'urso abraço carinho quentinho' },
      { id: 'leaozinho', name: 'Poderoso', pack: 'animais', url: '/assets/stickers/animais/leaozinho.svg', category: 'leão rei poder selva líder' },
      { id: 'pinguim', name: 'Na Pose!', pack: 'animais', url: '/assets/stickers/animais/pinguim.svg', category: 'pinguim gelo frio elegante pose' }
    ]
  },
  memes: {
    label: 'Memes',
    icon: '😎',
    items: [
      { id: 'eita_bicho', name: 'Eita Bicho!', pack: 'memes', url: '/assets/stickers/memes/eita_bicho.svg', category: 'eita bicho meme choque fofoca' },
      { id: 'calabreso', name: 'Calma Calabreso', pack: 'memes', url: '/assets/stickers/memes/calabreso.svg', category: 'calabreso calma meme zoeira' },
      { id: 'stonks', name: 'Stonks!', pack: 'memes', url: '/assets/stickers/memes/stonks.svg', category: 'stonks lucro sucesso gênio meme' },
      { id: 'foco_cafe', name: 'Foco & Café', pack: 'memes', url: '/assets/stickers/memes/foco_cafe.svg', category: 'foco café trabalho estresse' },
      { id: 'valeu_a_pena', name: 'Valeu a Pena', pack: 'memes', url: '/assets/stickers/memes/valeu_a_pena.svg', category: 'valeu a pena pôr do sol paz' },
      { id: 'deu_ruim', name: 'Deu Ruim!', pack: 'memes', url: '/assets/stickers/memes/deu_ruim.svg', category: 'deu ruim perigo erro problema' },
      { id: 'segredo', name: 'Segredo Nosso', pack: 'memes', url: '/assets/stickers/memes/segredo.svg', category: 'segredo silêncio não conta bico calado' },
      { id: 'manda_mais', name: 'Manda Mais!', pack: 'memes', url: '/assets/stickers/memes/manda_mais.svg', category: 'manda mais fofoca fogo quero mais' }
    ]
  }
};

// GIFs de reação instantânea (curados, rápidos e otimizados)
const CURATED_REACTION_GIFS = [
  { id: 'g1', title: 'Palmas e Aplausos', tag: 'palmas parabens show', url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif' },
  { id: 'g2', title: 'Chorando de Rir', tag: 'rir risada kkk gargalhada', url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif' },
  { id: 'g3', title: 'Dança Comemorando', tag: 'festa dança alegria vitória', url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif' },
  { id: 'g4', title: 'Gato Digitando', tag: 'gato digitando pc trabalho', url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif' },
  { id: 'g5', title: 'Coração e Amor', tag: 'amor carinho fofo coracao', url: 'https://media.giphy.com/media/uw0KqTWZPAhuU/giphy.gif' },
  { id: 'g6', title: 'Eita Chocado', tag: 'eita choque susto o que', url: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif' },
  { id: 'g7', title: 'Joinha Aprovado', tag: 'joinha sim positivo top', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
  { id: 'g8', title: 'Pipoca Fofoca', tag: 'pipoca vendo treta olhando', url: 'https://media.giphy.com/media/t3cL1iXeWEAgU/giphy.gif' },
  { id: 'g9', title: 'Café da Manhã', tag: 'cafe bom dia cansado sono', url: 'https://media.giphy.com/media/oZEBLigo84eCw/giphy.gif' },
  { id: 'g10', title: 'Calma Lá', tag: 'calma espera calma calabreso', url: 'https://media.giphy.com/media/yiADANv89n7UQuS5kJ/giphy.gif' },
  { id: 'g11', title: 'Mente Explodindo', tag: 'uau mente genial incrivel', url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif' },
  { id: 'g12', title: 'Abraço Carinhoso', tag: 'abraco amor amigo fofo', url: 'https://media.giphy.com/media/l8ooT5ImBBZICfZAAO/giphy.gif' }
];

export const MediaPicker: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'emojis' | 'gifs' | 'stickers'>('emojis');
  const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') !== 'light');
  
  // Stickers state
  const [stickerPack, setStickerPack] = useState<'divertidas' | 'reacoes' | 'animais' | 'memes' | 'recent' | 'favorites'>('divertidas');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('papos_favorite_stickers') || '[]');
    } catch {
      return [];
    }
  });
  const [recents, setRecents] = useState<StickerItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('papos_recent_stickers') || '[]');
    } catch {
      return [];
    }
  });
  const [stickerSearch, setStickerSearch] = useState('');
  
  // GIFs state
  const [gifSearchTerm, setGifSearchTerm] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Monitor theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Expose global window control
  useEffect(() => {
    window.PaposMediaPicker = {
      open: (tab = 'emojis') => {
        setActiveTab(tab);
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
      toggle: (tab = 'emojis') => {
        setIsOpen(prev => {
          if (!prev) setActiveTab(tab);
          return !prev;
        });
      },
      isOpen: () => isOpen
    };

    return () => {
      delete window.PaposMediaPicker;
    };
  }, [isOpen]);

  // Click outside and Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ignorar cliques dentro do próprio painel
      if (panelRef.current && panelRef.current.contains(target)) {
        return;
      }

      // Ignorar botões de abertura
      if (target.closest('#btn-emoji-picker') || target.closest('#btn-mobile-open-emojis')) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside as any);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as any);
    };
  }, [isOpen]);

  // Inserção de Emoji respeitando o cursor e atualizando o input
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const input = document.getElementById('message-input') as HTMLTextAreaElement | null;
    if (input) {
      const emoji = emojiData.emoji;
      const startPos = input.selectionStart || 0;
      const endPos = input.selectionEnd || 0;
      const originalText = input.value;

      input.value = originalText.substring(0, startPos) + emoji + originalText.substring(endPos);
      input.selectionStart = input.selectionEnd = startPos + emoji.length;
      input.focus();

      // Disparar eventos para garantir auto-redimensionamento e alternância do botão mic/enviar
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  // Envio de Figurinha
  const handleStickerClick = (sticker: StickerItem) => {
    // Atualizar recentes
    const updatedRecents = [sticker, ...recents.filter(s => s.id !== sticker.id)].slice(0, 20);
    setRecents(updatedRecents);
    try {
      localStorage.setItem('papos_recent_stickers', JSON.stringify(updatedRecents));
    } catch {}

    // Enviar mensagem
    if (window.sendMediaMessage) {
      window.sendMediaMessage('sticker', sticker.url, sticker.name);
    }

    setIsOpen(false);
  };

  // Alternar favorito de figurinha
  const toggleFavorite = (e: React.MouseEvent, stickerId: string) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(stickerId) ? prev.filter(id => id !== stickerId) : [...prev, stickerId];
      try {
        localStorage.setItem('papos_favorite_stickers', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Envio de GIF
  const handleGifSelect = (gifUrl: string, title?: string) => {
    if (!gifUrl) return;
    if (window.sendMediaMessage) {
      window.sendMediaMessage('gif', gifUrl, title || 'GIF');
    }
    setIsOpen(false);
  };

  // Provider de GIF (Giphy ou Klipy)
  const giphyKey = import.meta.env.VITE_GIPHY_API_KEY || '';
  const klipyKey = import.meta.env.VITE_KLIPY_API_KEY || '';

  const gifProvider = useMemo(() => {
    if (giphyKey && typeof Giphy === 'function') {
      try {
        return Giphy(giphyKey);
      } catch (e) {
        console.warn('Erro ao inicializar Giphy Provider:', e);
      }
    }
    if (klipyKey && typeof Klipy === 'function') {
      try {
        return Klipy(klipyKey);
      } catch (e) {
        console.warn('Erro ao inicializar Klipy Provider:', e);
      }
    }
    return null;
  }, [giphyKey, klipyKey]);

  // Lista de figurinhas filtradas
  const displayedStickers = useMemo(() => {
    let list: StickerItem[] = [];

    if (stickerPack === 'recent') {
      list = recents;
    } else if (stickerPack === 'favorites') {
      const all: StickerItem[] = [];
      Object.values(STICKER_PACKS).forEach(p => all.push(...p.items));
      list = all.filter(s => favorites.includes(s.id));
    } else {
      list = STICKER_PACKS[stickerPack]?.items || [];
    }

    if (stickerSearch.trim()) {
      const q = stickerSearch.toLowerCase().trim();
      return list.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
    }

    return list;
  }, [stickerPack, favorites, recents, stickerSearch]);

  // GIFs filtrados da lista de reações rápidas
  const filteredCuratedGifs = useMemo(() => {
    if (!gifSearchTerm.trim()) return CURATED_REACTION_GIFS;
    const q = gifSearchTerm.toLowerCase().trim();
    return CURATED_REACTION_GIFS.filter(g => g.title.toLowerCase().includes(q) || g.tag.toLowerCase().includes(q));
  }, [gifSearchTerm]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="papos-unified-media-picker"
      style={{
        position: 'fixed',
        zIndex: 1060,
        backgroundColor: isDark ? 'rgba(17, 21, 28, 0.98)' : 'rgba(255, 255, 255, 0.98)',
        color: isDark ? '#f3f4f6' : '#111827',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'}`,
        boxShadow: isDark
          ? '0 20px 45px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)'
          : '0 20px 40px -10px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        borderRadius: '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'opacity 0.18s ease, transform 0.18s ease'
      }}
      role="dialog"
      aria-label="Seletor de Emojis, GIFs e Figurinhas"
    >
      {/* CABEÇALHO DO PAINEL COM ABAS UNIFICADAS */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)'
        }}
      >
        {/* Abas */}
        <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
          <button
            type="button"
            className={`media-picker-tab-btn ${activeTab === 'emojis' ? 'active' : ''}`}
            onClick={() => setActiveTab('emojis')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.84rem',
              backgroundColor: activeTab === 'emojis' ? (isDark ? '#22c55e' : '#16a34a') : 'transparent',
              color: activeTab === 'emojis' ? '#ffffff' : (isDark ? '#9ca3af' : '#6b7280'),
              transition: 'all 0.15s ease'
            }}
          >
            <span>😀</span>
            <span>Emojis</span>
          </button>

          <button
            type="button"
            className={`media-picker-tab-btn ${activeTab === 'gifs' ? 'active' : ''}`}
            onClick={() => setActiveTab('gifs')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.84rem',
              backgroundColor: activeTab === 'gifs' ? (isDark ? '#22c55e' : '#16a34a') : 'transparent',
              color: activeTab === 'gifs' ? '#ffffff' : (isDark ? '#9ca3af' : '#6b7280'),
              transition: 'all 0.15s ease'
            }}
          >
            <span>🎞️</span>
            <span>GIFs</span>
          </button>

          <button
            type="button"
            className={`media-picker-tab-btn ${activeTab === 'stickers' ? 'active' : ''}`}
            onClick={() => setActiveTab('stickers')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.84rem',
              backgroundColor: activeTab === 'stickers' ? (isDark ? '#22c55e' : '#16a34a') : 'transparent',
              color: activeTab === 'stickers' ? '#ffffff' : (isDark ? '#9ca3af' : '#6b7280'),
              transition: 'all 0.15s ease'
            }}
          >
            <span>🧸</span>
            <span>Figurinhas</span>
          </button>
        </div>

        {/* Botão Fechar */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          title="Fechar painel (Esc)"
          aria-label="Fechar"
          style={{
            background: 'none',
            border: 'none',
            color: isDark ? '#9ca3af' : '#6b7280',
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: '1rem',
            lineHeight: 1,
            borderRadius: '6px',
            transition: 'color 0.15s ease'
          }}
        >
          ✕
        </button>
      </div>

      {/* CONTEÚDO DA ABA SELECIONADA */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        
        {/* ABA 1: EMOJIS (emoji-picker-react) */}
        {activeTab === 'emojis' && (
          <div style={{ flex: 1, width: '100%', height: '100%', minHeight: '350px' }}>
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={isDark ? EmojiTheme.DARK : EmojiTheme.LIGHT}
              width="100%"
              height="100%"
              searchPlaceHolder="Pesquisar emoji..."
              lazyLoadEmojis={true}
              skinTonesDisabled={false}
              previewConfig={{ showPreview: false }}
            />
          </div>
        )}

        {/* ABA 2: GIFS (gif-picker-react / Curados) */}
        {activeTab === 'gifs' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {gifProvider ? (
              // Modo com chave de API ativa (Giphy ou Klipy oficial)
              <div style={{ flex: 1, height: '100%', width: '100%' }}>
                <GifPicker
                  provider={gifProvider}
                  onGifClick={(gif) => {
                    const url = (gif as any)?.images?.fixed_width?.url || (gif as any)?.images?.original?.url || (gif as any)?.url || '';
                    handleGifSelect(url, (gif as any)?.title || 'GIF');
                  }}
                  theme={isDark ? GifTheme.DARK : GifTheme.LIGHT}
                  width="100%"
                  height="100%"
                  autoFocusSearch={false}
                />
              </div>
            ) : (
              // Modo com Reações Rápidas e orientações transparentes para configurar VITE_GIPHY_API_KEY
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {/* Barra de Pesquisa */}
                <div style={{ padding: '8px 12px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
                  <input
                    type="text"
                    value={gifSearchTerm}
                    onChange={(e) => setGifSearchTerm(e.target.value)}
                    placeholder="Pesquisar GIFs de reações..."
                    style={{
                      width: '100%',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db'}`,
                      backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#f9fafb',
                      color: isDark ? '#ffffff' : '#111827',
                      fontSize: '0.84rem',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Banner de Status de API */}
                <div
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.72rem',
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)',
                    color: isDark ? '#93c5fd' : '#1d4ed8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  <span>💡 Para ativar busca ilimitada GIPHY/Klipy, defina <code>VITE_GIPHY_API_KEY</code> na Render.</span>
                  <a
                    href="https://developers.giphy.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline', whiteSpace: 'nowrap' }}
                  >
                    Obter Chave
                  </a>
                </div>

                {/* Grid de GIFs */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '10px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '8px',
                    alignContent: 'start'
                  }}
                >
                  {filteredCuratedGifs.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      onClick={() => handleGifSelect(gif.url, gif.title)}
                      title={`Enviar ${gif.title}`}
                      style={{
                        padding: 0,
                        border: 'none',
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        position: 'relative',
                        aspectRatio: '16 / 10',
                        transition: 'transform 0.12s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      <img
                        src={gif.url}
                        alt={gif.title}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          backgroundColor: 'rgba(0,0,0,0.65)',
                          color: '#ffffff',
                          fontSize: '0.68rem',
                          padding: '2px 4px',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden'
                        }}
                      >
                        {gif.title}
                      </span>
                    </button>
                  ))}
                  {filteredCuratedGifs.length === 0 && (
                    <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '24px 8px', color: '#9ca3af', fontSize: '0.82rem' }}>
                      Nenhum GIF correspondente encontrado.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 3: FIGURINHAS (Packs, Recentes e Favoritas) */}
        {activeTab === 'stickers' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Seletor de Pacotes */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                padding: '6px 8px',
                overflowX: 'auto',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
                scrollbarWidth: 'none'
              }}
            >
              {/* Recentes */}
              <button
                type="button"
                onClick={() => setStickerPack('recent')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  backgroundColor: stickerPack === 'recent' ? (isDark ? 'rgba(255,255,255,0.15)' : '#e5e7eb') : 'transparent',
                  color: isDark ? '#ffffff' : '#111827'
                }}
              >
                <span>🕒</span>
                <span>Recentes</span>
              </button>

              {/* Favoritas */}
              <button
                type="button"
                onClick={() => setStickerPack('favorites')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  backgroundColor: stickerPack === 'favorites' ? (isDark ? 'rgba(255,255,255,0.15)' : '#e5e7eb') : 'transparent',
                  color: isDark ? '#ffffff' : '#111827'
                }}
              >
                <span>⭐</span>
                <span>Favoritas</span>
              </button>

              {/* Pacotes Principais */}
              {Object.entries(STICKER_PACKS).map(([key, pack]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStickerPack(key as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    backgroundColor: stickerPack === key ? (isDark ? 'rgba(255,255,255,0.15)' : '#e5e7eb') : 'transparent',
                    color: isDark ? '#ffffff' : '#111827'
                  }}
                >
                  <span>{pack.icon}</span>
                  <span>{pack.label}</span>
                </button>
              ))}
            </div>

            {/* Campo de Busca Rápida */}
            <div style={{ padding: '6px 10px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}` }}>
              <input
                type="text"
                value={stickerSearch}
                onChange={(e) => setStickerSearch(e.target.value)}
                placeholder="Filtrar figurinhas..."
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#f9fafb',
                  color: isDark ? '#ffffff' : '#111827',
                  fontSize: '0.8rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* Grid de Figurinhas */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                alignContent: 'start'
              }}
            >
              {displayedStickers.map((sticker) => {
                const isFav = favorites.includes(sticker.id);
                return (
                  <div
                    key={sticker.id}
                    onClick={() => handleStickerClick(sticker)}
                    title={`${sticker.name} (Clique para enviar)`}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px 4px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
                      transition: 'transform 0.12s ease, background-color 0.12s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
                    }}
                  >
                    {/* Botão de Favoritar */}
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(e, sticker.id)}
                      title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                      style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        fontSize: '0.8rem',
                        lineHeight: 1,
                        opacity: isFav ? 1 : 0.4,
                        transition: 'opacity 0.15s ease'
                      }}
                    >
                      {isFav ? '⭐' : '☆'}
                    </button>

                    <img
                      src={sticker.url}
                      alt={sticker.name}
                      loading="lazy"
                      style={{ width: '56px', height: '56px', objectFit: 'contain', display: 'block', marginBottom: '4px' }}
                    />
                    <span
                      style={{
                        fontSize: '0.66rem',
                        color: isDark ? '#9ca3af' : '#6b7280',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                        fontWeight: 500
                      }}
                    >
                      {sticker.name}
                    </span>
                  </div>
                );
              })}

              {displayedStickers.length === 0 && (
                <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '30px 8px', color: '#9ca3af', fontSize: '0.82rem' }}>
                  {stickerPack === 'favorites' ? (
                    <div>
                      <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '6px' }}>⭐</span>
                      <span>Nenhuma figurinha favoritada ainda.<br />Clique na estrela para salvar suas preferidas!</span>
                    </div>
                  ) : stickerPack === 'recent' ? (
                    <div>
                      <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '6px' }}>🕒</span>
                      <span>Suas figurinhas enviadas recentemente aparecerão aqui.</span>
                    </div>
                  ) : (
                    <span>Nenhuma figurinha encontrada.</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      <style>{`
        /* Responsividade desktop vs mobile */
        @media (min-width: 769px) {
          .papos-unified-media-picker {
            width: 380px !important;
            height: 440px !important;
            bottom: 68px !important;
            right: 80px !important;
            max-width: 90vw !important;
          }
        }
        @media (max-width: 768px) {
          .papos-unified-media-picker {
            width: 100vw !important;
            height: 420px !important;
            max-height: 75vh !important;
            bottom: 58px !important;
            left: 0 !important;
            right: 0 !important;
            border-radius: 18px 18px 0 0 !important;
            border-left: none !important;
            border-right: none !important;
            border-bottom: none !important;
          }
        }
      `}</style>
    </div>
  );
};
