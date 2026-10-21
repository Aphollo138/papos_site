/// <reference types="vite/client" />
import React, { useState, useEffect, useRef, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import EmojiPicker, { Theme as EmojiTheme, EmojiClickData } from 'emoji-picker-react';
import { GifPicker, Theme as GifTheme } from 'gif-picker-react';
import 'gif-picker-react/style.css';
import { Klipy } from 'gif-picker-react/providers/klipy';
import { Giphy } from 'gif-picker-react/providers/giphy';

// Declaração de tipos globais expostos para integração com o chat Papos
declare global {
  interface Window {
    insertEmojiAtCursor?: (emoji: string) => void;
    sendMediaMessage?: (mediaType: 'gif' | 'sticker', mediaUrl: string, caption?: string) => void;
    updateSendButtonState?: () => void;
    closeMobileDropdown?: () => void;
    __KLIPY_API_KEY__?: string;
    PaposMediaPicker?: {
      open: (tab?: 'emojis' | 'gifs' | 'stickers') => void;
      close: () => void;
      toggle: (tab?: 'emojis' | 'gifs' | 'stickers') => void;
      isOpen: () => boolean;
      getActiveTab: () => 'emojis' | 'gifs' | 'stickers';
    };
  }
}

// Error Boundary isolado por aba para garantir que falhas em uma biblioteca nunca quebrem as outras abas
interface ErrorBoundaryProps {
  tabName: string;
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class TabErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn(`[PaposMediaPicker] Erro capturado na aba ${this.props.tabName}:`, error.message, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Interface de figurinha integrada com a API KLIPY
export interface StickerItem {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
}

// Tags de pesquisa rápida para a API de figurinhas da KLIPY
const KLIPY_STICKER_TAGS = [
  { id: 'trending', label: '🔥 Em Alta', query: '' },
  { id: 'reacoes', label: '👏 Reações', query: 'reactions' },
  { id: 'memes', label: '😂 Memes', query: 'memes' },
  { id: 'amor', label: '❤️ Amor', query: 'love' },
  { id: 'animais', label: '🐱 Animais', query: 'animals' },
  { id: 'festa', label: '🎉 Festa', query: 'party' },
  { id: 'bomdia', label: '☀️ Bom Dia', query: 'good morning' },
  { id: 'engracado', label: '🤣 Engraçado', query: 'funny' }
];

// GIFs de reação instantânea para contingência caso a rede/API falhe
const CURATED_REACTION_GIFS = [
  { id: 'g1', title: 'Palmas e Aplausos', tag: 'palmas parabens show aplausos top', url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif' },
  { id: 'g2', title: 'Chorando de Rir', tag: 'rir risada kkk gargalhada engraçado morri', url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif' },
  { id: 'g3', title: 'Dança Comemorando', tag: 'festa dança alegria vitória comemoração', url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif' },
  { id: 'g4', title: 'Gato Digitando', tag: 'gato digitando pc trabalho estudando código', url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif' },
  { id: 'g5', title: 'Coração e Amor', tag: 'amor carinho fofo coracao amei apaixonado', url: 'https://media.giphy.com/media/uw0KqTWZPAhuU/giphy.gif' },
  { id: 'g6', title: 'Eita Chocado', tag: 'eita choque susto o que chocado bicho surpresa', url: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif' },
  { id: 'g7', title: 'Joinha Aprovado', tag: 'joinha sim positivo top aprovado concordo ok', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
  { id: 'g8', title: 'Pipoca Fofoca', tag: 'pipoca vendo treta olhando fofoca cinema espia', url: 'https://media.giphy.com/media/t3cL1iXeWEAgU/giphy.gif' },
  { id: 'g9', title: 'Café da Manhã', tag: 'cafe bom dia cansado sono pausa cafezinho', url: 'https://media.giphy.com/media/oZEBLigo84eCw/giphy.gif' },
  { id: 'g10', title: 'Calma Lá', tag: 'calma espera calma calabreso relaxa tranquilo', url: 'https://media.giphy.com/media/yiADANv89n7UQuS5kJ/giphy.gif' },
  { id: 'g11', title: 'Mente Explodindo', tag: 'uau mente genial incrivel choque explodiu', url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif' },
  { id: 'g12', title: 'Abraço Carinhoso', tag: 'abraco amor amigo fofo carinho saudade', url: 'https://media.giphy.com/media/l8ooT5ImBBZICfZAAO/giphy.gif' }
];

export const MediaPicker: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'emojis' | 'gifs' | 'stickers'>('emojis');
  const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') !== 'light');

  // Keys dinâmicas da KLIPY / GIPHY
  const [klipyApiKey, setKlipyApiKey] = useState<string>(() => {
    return (
      import.meta.env.VITE_KLIPY_API_KEY ||
      (window as any).__KLIPY_API_KEY__ ||
      localStorage.getItem('klipy_api_key') ||
      ''
    );
  });
  const [giphyApiKey, setGiphyApiKey] = useState<string>(() => {
    return import.meta.env.VITE_GIPHY_API_KEY || '';
  });

  // Estado da aba de GIFs KLIPY
  const [klipyStatus, setKlipyStatus] = useState<'idle' | 'testing' | 'ready' | 'error'>('idle');
  const [klipyErrorMessage, setKlipyErrorMessage] = useState<string | null>(null);
  const [retryKeyCount, setRetryKeyCount] = useState(0);
  const [gifSearchTerm, setGifSearchTerm] = useState('');

  // Estado da aba de Figurinhas KLIPY
  const [klipyStickers, setKlipyStickers] = useState<StickerItem[]>([]);
  const [stickersLoading, setStickersLoading] = useState(false);
  const [stickersError, setStickersError] = useState<string | null>(null);
  const [stickerSearchTerm, setStickerSearchTerm] = useState('');
  const [selectedStickerTag, setSelectedStickerTag] = useState<string>('trending');
  const [stickerSubTab, setStickerSubTab] = useState<'catalog' | 'recent' | 'favorites'>('catalog');
  const [retryStickersCount, setRetryStickersCount] = useState(0);

  // Figurinhas favoritas e recentes
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('papos_favorite_stickers') || '[]');
    } catch {
      return [];
    }
  });

  const [recents, setRecents] = useState<StickerItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('papos_recent_klipy_stickers') || '[]');
    } catch {
      return [];
    }
  });

  const panelRef = useRef<HTMLDivElement>(null);

  // Buscar chaves atualizadas do servidor caso ainda não estejam injetadas no cliente
  useEffect(() => {
    if (!klipyApiKey) {
      fetch('/api/media-config')
        .then(res => res.json())
        .then(data => {
          if (data && data.klipyKey) {
            setKlipyApiKey(data.klipyKey);
          }
          if (data && data.giphyKey && !giphyApiKey) {
            setGiphyApiKey(data.giphyKey);
          }
        })
        .catch(() => {
          // Servidor offline ou rota indisponível
        });
    }
  }, [klipyApiKey, giphyApiKey]);

  // Observador de mudança de tema
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Expor controles na window para integração direta com botões desktop e mobile
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
      isOpen: () => isOpen,
      getActiveTab: () => activeTab
    };

    window.insertEmojiAtCursor = (emoji: string) => {
      handleEmojiClick({ emoji } as any);
    };

    return () => {
      delete window.PaposMediaPicker;
      delete window.insertEmojiAtCursor;
    };
  }, [isOpen, activeTab]);

  // Click outside e tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (panelRef.current && panelRef.current.contains(target)) {
        return;
      }

      if (target.closest('#btn-emoji-picker') || target.closest('#btn-mobile-open-emojis')) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Inserção de Emoji respeitando cursor, preservando texto digitado e alternando botão mic/enviar
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

      // Disparar eventos de entrada e acionar alternância imediata do botão direito
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof window.updateSendButtonState === 'function') {
        window.updateSendButtonState();
      }
    }
  };

  // Envio de GIF
  const handleGifSelect = (gifUrl: string, title?: string) => {
    if (!gifUrl) return;
    if (window.sendMediaMessage) {
      window.sendMediaMessage('gif', gifUrl, title || 'GIF');
    }
    setIsOpen(false);
  };

  // Envio de Figurinha KLIPY
  const handleStickerSelect = (sticker: StickerItem) => {
    if (!sticker.url) return;

    // Salvar nos recentes locais
    setRecents(prev => {
      const next = [sticker, ...prev.filter(s => s.id !== sticker.id)].slice(0, 30);
      try {
        localStorage.setItem('papos_recent_klipy_stickers', JSON.stringify(next));
      } catch {}
      return next;
    });

    if (window.sendMediaMessage) {
      window.sendMediaMessage('sticker', sticker.url, sticker.title || 'Figurinha KLIPY');
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

  // Instanciar provedor de GIFs (Prioridade 1: KLIPY; Prioridade 2: GIPHY)
  const gifProvider = useMemo(() => {
    if (klipyApiKey && typeof Klipy === 'function') {
      try {
        return Klipy(klipyApiKey, { showBranding: true });
      } catch (err: any) {
        console.warn('[PaposMediaPicker] Erro ao instanciar Klipy provider:', err?.message || err);
      }
    }
    if (giphyApiKey && typeof Giphy === 'function') {
      try {
        return Giphy(giphyApiKey);
      } catch (err: any) {
        console.warn('[PaposMediaPicker] Erro ao instanciar Giphy provider:', err?.message || err);
      }
    }
    return null;
  }, [klipyApiKey, giphyApiKey, retryKeyCount]);

  // Testar conexão com KLIPY ao abrir a aba de GIFs
  useEffect(() => {
    if (activeTab !== 'gifs' || !klipyApiKey || !gifProvider) return;

    let isMounted = true;
    setKlipyStatus('testing');
    setKlipyErrorMessage(null);

    Promise.resolve(gifProvider.getTrending())
      .then(() => {
        if (!isMounted) return;
        setKlipyStatus('ready');
        setKlipyErrorMessage(null);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        const msg = String(err?.message || err || 'Falha na requisição');
        console.warn('[PaposMediaPicker] Erro na API KLIPY (GIFs):', msg);
        setKlipyStatus('error');
        if (msg.includes('401')) {
          setKlipyErrorMessage('Chave KLIPY não autorizada (401 Unauthorized). Verifique sua credencial.');
        } else if (msg.includes('403')) {
          setKlipyErrorMessage('Acesso restrito pelo KLIPY (403 Forbidden).');
        } else if (msg.includes('404')) {
          setKlipyErrorMessage('Chave KLIPY não encontrada ou endpoint inválido (404 Not Found).');
        } else if (msg.includes('429')) {
          setKlipyErrorMessage('Limite de requisições excedido no KLIPY (429 Rate Limit).');
        } else {
          setKlipyErrorMessage(`Falha na API KLIPY: ${msg}`);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, klipyApiKey, gifProvider, retryKeyCount]);

  // Carregamento de figurinhas DIRETAMENTE DA API KLIPY
  useEffect(() => {
    if (activeTab !== 'stickers' || stickerSubTab !== 'catalog') return;

    let isCancelled = false;

    if (!klipyApiKey) {
      setStickersError('Chave da KLIPY não configurada no projeto.');
      setStickersLoading(false);
      return;
    }

    setStickersLoading(true);
    setStickersError(null);

    const queryToSearch = stickerSearchTerm.trim() || (KLIPY_STICKER_TAGS.find(t => t.id === selectedStickerTag)?.query || '');

    const timer = setTimeout(() => {
      const endpoint = queryToSearch
        ? `https://api.klipy.com/api/v1/${klipyApiKey}/stickers/search?q=${encodeURIComponent(queryToSearch)}&page=1&per_page=40`
        : `https://api.klipy.com/api/v1/${klipyApiKey}/stickers/trending?page=1&per_page=40`;

      fetch(endpoint)
        .then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => null);
            const msg = errData?.errors?.message?.[0] || errData?.message || `Erro da KLIPY (${res.status} ${res.statusText})`;
            throw new Error(msg);
          }
          return res.json();
        })
        .then((json) => {
          if (isCancelled) return;
          const rawItems = Array.isArray(json?.data) ? json.data : (Array.isArray(json?.data?.data) ? json.data.data : []);

          const parsed: StickerItem[] = rawItems
            .map((item: any) => {
              const file = item.file || {};
              const md = file.md || file.sm || file.hd || {};
              const sm = file.sm || file.md || file.xs || {};

              // Suporte a formatos webp, gif e png de figurinhas
              const mdUrl = md.webp?.url || md.gif?.url || md.png?.url || md.url;
              const smUrl = sm.webp?.url || sm.gif?.url || sm.png?.url || sm.url;
              const finalUrl = mdUrl || smUrl || item.url || item.image_url;
              const previewUrl = smUrl || mdUrl || finalUrl;

              if (!finalUrl) return null;
              return {
                id: String(item.slug || item.id || Math.random().toString(36).substring(2, 9)),
                title: item.title || 'Figurinha KLIPY',
                url: finalUrl,
                previewUrl: previewUrl || finalUrl
              };
            })
            .filter(Boolean) as StickerItem[];

          setKlipyStickers(parsed);
          setStickersLoading(false);
          setStickersError(null);
        })
        .catch((err: any) => {
          if (isCancelled) return;
          console.warn('[PaposMediaPicker] Erro ao carregar figurinhas da KLIPY:', err);
          const rawMsg = err?.message || 'Falha ao conectar com o catálogo de figurinhas da KLIPY.';
          setStickersError(rawMsg);
          setStickersLoading(false);
        });
    }, stickerSearchTerm.trim() ? 350 : 0);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [activeTab, stickerSubTab, klipyApiKey, stickerSearchTerm, selectedStickerTag, retryStickersCount]);

  // Lista de figurinhas a exibir conforme a sub-aba
  const displayedStickers = useMemo(() => {
    if (stickerSubTab === 'recent') {
      return recents;
    }
    if (stickerSubTab === 'favorites') {
      return klipyStickers.filter(s => favorites.includes(s.id));
    }
    return klipyStickers;
  }, [stickerSubTab, klipyStickers, recents, favorites]);

  // GIFs curados filtrados para contingência
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
        zIndex: 1065,
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
      {/* CABEÇALHO DO PAINEL COM 3 ABAS INDEPENDENTES */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.02)'
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          {/* Aba Emojis */}
          <button
            type="button"
            onClick={() => setActiveTab('emojis')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'emojis' ? '#22c55e' : 'transparent',
              color: activeTab === 'emojis' ? '#ffffff' : (isDark ? '#9ca3af' : '#4b5563'),
              transition: 'all 0.15s ease'
            }}
          >
            <span>😀</span>
            <span>Emojis</span>
          </button>

          {/* Aba GIFs */}
          <button
            type="button"
            onClick={() => setActiveTab('gifs')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'gifs' ? '#22c55e' : 'transparent',
              color: activeTab === 'gifs' ? '#ffffff' : (isDark ? '#9ca3af' : '#4b5563'),
              transition: 'all 0.15s ease'
            }}
          >
            <span>🎞️</span>
            <span>GIFs</span>
          </button>

          {/* Aba Figurinhas */}
          <button
            type="button"
            onClick={() => setActiveTab('stickers')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'stickers' ? '#22c55e' : 'transparent',
              color: activeTab === 'stickers' ? '#ffffff' : (isDark ? '#9ca3af' : '#4b5563'),
              transition: 'all 0.15s ease'
            }}
          >
            <span>🧸</span>
            <span>Figurinhas</span>
          </button>
        </div>

        {/* Botão de Fechar */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          title="Fechar"
          aria-label="Fechar"
          style={{
            background: 'none',
            border: 'none',
            color: isDark ? '#9ca3af' : '#6b7280',
            fontSize: '1.2rem',
            lineHeight: 1,
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '6px'
          }}
        >
          ✕
        </button>
      </div>

      {/* ÁREA DE CONTEÚDO DAS ABAS */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        
        {/* ABA 1: EMOJIS */}
        {activeTab === 'emojis' && (
          <TabErrorBoundary
            tabName="Emojis"
            fallback={
              <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
                <p>Falha ao carregar emojis.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('emojis')}
                  style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  Tentar recarregar
                </button>
              </div>
            }
          >
            <div style={{ flex: 1, width: '100%', height: '100%', minHeight: '360px' }}>
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
          </TabErrorBoundary>
        )}

        {/* ABA 2: GIFS (KLIPY Oficial + Contingência Curada) */}
        {activeTab === 'gifs' && (
          <TabErrorBoundary
            tabName="GIFs"
            fallback={
              <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
                <p>Falha ao renderizar GIFs.</p>
                <button
                  type="button"
                  onClick={() => setRetryKeyCount(c => c + 1)}
                  style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  Tentar novamente
                </button>
              </div>
            }
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {gifProvider && klipyStatus !== 'error' ? (
                <div style={{ flex: 1, height: '100%', width: '100%', position: 'relative' }}>
                  {klipyStatus === 'testing' && (
                    <div style={{ padding: '6px 12px', fontSize: '0.72rem', backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: isDark ? '#93c5fd' : '#1d4ed8' }}>
                      Conectando à API KLIPY...
                    </div>
                  )}
                  <GifPicker
                    provider={gifProvider}
                    onGifClick={(gif) => {
                      const url =
                        (gif as any)?.imageUrl ||
                        (gif as any)?.images?.fixed_width?.url ||
                        (gif as any)?.images?.original?.url ||
                        (gif as any)?.url ||
                        '';
                      handleGifSelect(url, (gif as any)?.description || (gif as any)?.title || 'GIF');
                    }}
                    theme={isDark ? GifTheme.DARK : GifTheme.LIGHT}
                    width="100%"
                    height="100%"
                    autoFocusSearch={false}
                  />
                </div>
              ) : (
                /* Contingência caso KLIPY falhe ou não tenha chave */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                  <div
                    style={{
                      padding: '8px 12px',
                      fontSize: '0.74rem',
                      backgroundColor: klipyStatus === 'error' ? (isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)') : (isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)'),
                      color: klipyStatus === 'error' ? (isDark ? '#fca5a5' : '#b91c1c') : (isDark ? '#93c5fd' : '#1d4ed8'),
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span>
                        {klipyStatus === 'error'
                          ? `⚠️ ${klipyErrorMessage || 'Não foi possível carregar os GIFs da KLIPY.'}`
                          : '💡 Para busca ilimitada online da KLIPY, certifique-se de configurar VITE_KLIPY_API_KEY.'}
                      </span>
                      {klipyStatus === 'error' && (
                        <button
                          type="button"
                          onClick={() => setRetryKeyCount(c => c + 1)}
                          style={{
                            backgroundColor: 'transparent',
                            border: `1px solid currentColor`,
                            color: 'inherit',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Tentar novamente
                        </button>
                      )}
                    </div>
                    <span style={{ opacity: 0.85 }}>
                      Exibindo GIFs curados para envio instantâneo:
                    </span>
                  </div>

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
                  </div>
                </div>
              )}
            </div>
          </TabErrorBoundary>
        )}

        {/* ABA 3: FIGURINHAS (DIRETAMENTE DA KLIPY) */}
        {activeTab === 'stickers' && (
          <TabErrorBoundary
            tabName="Figurinhas"
            fallback={
              <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
                <p>Falha ao renderizar figurinhas.</p>
                <button
                  type="button"
                  onClick={() => setRetryStickersCount(c => c + 1)}
                  style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  Tentar recarregar
                </button>
              </div>
            }
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              
              {/* Barra superior de navegação da aba Figurinhas */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 8px',
                  overflowX: 'auto',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                  backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
                  scrollbarWidth: 'none'
                }}
              >
                {/* Catálogo Oficial KLIPY */}
                <button
                  type="button"
                  onClick={() => setStickerSubTab('catalog')}
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
                    backgroundColor: stickerSubTab === 'catalog' ? (isDark ? 'rgba(255,255,255,0.15)' : '#e5e7eb') : 'transparent',
                    color: isDark ? '#ffffff' : '#111827'
                  }}
                >
                  <span>✨</span>
                  <span>Catálogo KLIPY</span>
                </button>

                {/* Recentes */}
                {recents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStickerSubTab('recent')}
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
                      backgroundColor: stickerSubTab === 'recent' ? (isDark ? 'rgba(255,255,255,0.15)' : '#e5e7eb') : 'transparent',
                      color: isDark ? '#ffffff' : '#111827'
                    }}
                  >
                    <span>🕒</span>
                    <span>Recentes ({recents.length})</span>
                  </button>
                )}

                {/* Favoritas */}
                {favorites.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStickerSubTab('favorites')}
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
                      backgroundColor: stickerSubTab === 'favorites' ? (isDark ? 'rgba(255,255,255,0.15)' : '#e5e7eb') : 'transparent',
                      color: isDark ? '#ffffff' : '#111827'
                    }}
                  >
                    <span>⭐</span>
                    <span>Favoritas</span>
                  </button>
                )}
              </div>

              {/* Tags de categorias rápidas da KLIPY */}
              {stickerSubTab === 'catalog' && (
                <div
                  style={{
                    display: 'flex',
                    gap: '4px',
                    padding: '5px 8px',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`
                  }}
                >
                  {KLIPY_STICKER_TAGS.map((tag) => {
                    const isSelected = selectedStickerTag === tag.id && !stickerSearchTerm;
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setSelectedStickerTag(tag.id);
                          setStickerSearchTerm('');
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          border: 'none',
                          fontSize: '0.72rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          backgroundColor: isSelected ? '#22c55e' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                          color: isSelected ? '#ffffff' : (isDark ? '#d1d5db' : '#4b5563'),
                          transition: 'all 0.12s ease'
                        }}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Campo de Pesquisa de Figurinhas KLIPY */}
              {stickerSubTab === 'catalog' && (
                <div style={{ padding: '6px 10px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}` }}>
                  <input
                    type="text"
                    value={stickerSearchTerm}
                    onChange={(e) => setStickerSearchTerm(e.target.value)}
                    placeholder="Pesquisar figurinhas na KLIPY..."
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
              )}

              {/* Informação sobre status de erro ou chave KLIPY ausente */}
              {stickersError && (
                <div
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.74rem',
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                    color: isDark ? '#fca5a5' : '#b91c1c',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  <span>⚠️ {stickersError}</span>
                  <button
                    type="button"
                    onClick={() => setRetryStickersCount(c => c + 1)}
                    style={{
                      backgroundColor: 'transparent',
                      border: `1px solid currentColor`,
                      color: 'inherit',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {/* Indicador de carregamento */}
              {stickersLoading && (
                <div style={{ padding: '16px', textAlign: 'center', color: isDark ? '#9ca3af' : '#6b7280', fontSize: '0.82rem' }}>
                  <span>Carregando figurinhas da KLIPY...</span>
                </div>
              )}

              {/* Grid de Figurinhas KLIPY */}
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
                      onClick={() => handleStickerSelect(sticker)}
                      title={`${sticker.title} (Clique para enviar)`}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 4px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
                        transition: 'transform 0.12s ease, background-color 0.12s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.06)';
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
                          fontSize: '0.75rem',
                          lineHeight: 1,
                          opacity: isFav ? 1 : 0.35,
                          transition: 'opacity 0.15s ease'
                        }}
                      >
                        {isFav ? '⭐' : '☆'}
                      </button>

                      <img
                        src={sticker.previewUrl || sticker.url}
                        alt={sticker.title}
                        loading="lazy"
                        style={{
                          width: '56px',
                          height: '56px',
                          objectFit: 'contain',
                          display: 'block',
                          marginBottom: '4px',
                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))'
                        }}
                      />
                      <span
                        style={{
                          fontSize: '0.64rem',
                          color: isDark ? '#9ca3af' : '#6b7280',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%',
                          fontWeight: 500
                        }}
                      >
                        {sticker.title}
                      </span>
                    </div>
                  );
                })}

                {!stickersLoading && displayedStickers.length === 0 && (
                  <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '30px 8px', color: '#9ca3af', fontSize: '0.82rem' }}>
                    {stickerSubTab === 'favorites' ? (
                      <div>
                        <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '6px' }}>⭐</span>
                        <span>Nenhuma figurinha favoritada ainda.<br />Clique na estrela para salvar suas preferidas!</span>
                      </div>
                    ) : stickerSubTab === 'recent' ? (
                      <div>
                        <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '6px' }}>🕒</span>
                        <span>Suas figurinhas enviadas recentemente aparecerão aqui.</span>
                      </div>
                    ) : (
                      <div>
                        <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '6px' }}>🧸</span>
                        <span>
                          {stickersError
                            ? 'Catálogo online indisponível no momento.'
                            : 'Nenhuma figurinha encontrada para esta pesquisa.'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Atribuição obrigatória da KLIPY */}
              <div
                style={{
                  padding: '6px 12px',
                  borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '0.68rem',
                  color: isDark ? '#6b7280' : '#9ca3af'
                }}
              >
                <span>Powered by</span>
                <a
                  href="https://klipy.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#22c55e', textDecoration: 'none', fontWeight: 600 }}
                >
                  KLIPY
                </a>
                <span>• Figurinhas Oficiais</span>
              </div>

            </div>
          </TabErrorBoundary>
        )}

      </div>

      <style>{`
        /* Responsividade desktop vs mobile */
        @media (min-width: 769px) {
          .papos-unified-media-picker {
            width: 380px !important;
            height: 460px !important;
            bottom: 72px !important;
            right: 24px !important;
            max-width: 90vw !important;
            max-height: 80vh !important;
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
            padding-bottom: env(safe-area-inset-bottom, 0) !important;
          }
        }
      `}</style>
    </div>
  );
};
