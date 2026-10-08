/**
 * Zenithe Promo Card Controller
 * Apresenta o card promocional do Zenithe (https://zenithe.net.br) ao entrar no chat
 */

(function () {
  'use strict';

  function getOverlay() {
    return document.getElementById('zenitheModalOverlay');
  }

  function showZenitheCard() {
    // Se estiver em chamada em tela cheia, não exibir sobrepondo a chamada
    if (document.body.classList.contains('in-call-fullscreen')) {
      return;
    }

    const overlay = getOverlay();
    if (!overlay) return;

    overlay.classList.remove('d-none');
    // Forçar reflow para acionar transição CSS suave
    void overlay.offsetWidth;
    overlay.classList.add('zenithe-visible');
    overlay.setAttribute('aria-hidden', 'false');

    // Focar no botão CTA principal para acessibilidade
    const ctaBtn = overlay.querySelector('#btnZenitheCta');
    if (ctaBtn) {
      setTimeout(() => {
        try { ctaBtn.focus(); } catch (e) {}
      }, 100);
    }
  }

  function closeZenitheCard() {
    const overlay = getOverlay();
    if (!overlay) return;

    overlay.classList.remove('zenithe-visible');
    overlay.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      if (!overlay.classList.contains('zenithe-visible')) {
        overlay.classList.add('d-none');
      }
    }, 280);
  }

  function setupZenitheEvents() {
    const overlay = getOverlay();
    if (!overlay) return;

    // Fechar ao clicar no backdrop (fora do card)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeZenitheCard();
      }
    });

    // Botão Fechar (X)
    const closeBtn = document.getElementById('btnZenitheClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closeZenitheCard();
      });
    }

    // Botão Secundário ("Continuar no Papo.net")
    const dismissBtn = document.getElementById('btnZenitheDismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closeZenitheCard();
      });
    }

    // Botão CTA ("Acessar o Zenithe Agora")
    const ctaBtn = document.getElementById('btnZenitheCta');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', () => {
        // Permitir navegação natural para https://zenithe.net.br em nova aba
        setTimeout(() => {
          closeZenitheCard();
        }, 150);
      });
    }

    // Tecla ESC para fechar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('zenithe-visible')) {
        closeZenitheCard();
      }
    });

    // Gatilhos adicionais na interface (Desktop e Mobile)
    const btnDesktop = document.getElementById('btn-desktop-zenithe');
    if (btnDesktop) {
      btnDesktop.addEventListener('click', (e) => {
        e.preventDefault();
        showZenitheCard();
      });
    }

    const btnMobile = document.getElementById('btn-mobile-zenithe');
    if (btnMobile) {
      btnMobile.addEventListener('click', (e) => {
        e.preventDefault();
        showZenitheCard();
      });
    }

    const btnMobileMenu = document.getElementById('mobile-menu-zenithe');
    if (btnMobileMenu) {
      btnMobileMenu.addEventListener('click', (e) => {
        e.preventDefault();
        // Fechar offcanvas se o bootstrap estiver presente
        const offcanvasEl = document.getElementById('offcanvasMobileMenu');
        if (offcanvasEl && window.bootstrap && window.bootstrap.Offcanvas) {
          const bsOffcanvas = window.bootstrap.Offcanvas.getInstance(offcanvasEl);
          if (bsOffcanvas) bsOffcanvas.hide();
        }
        showZenitheCard();
      });
    }

    // Observador para fechar automaticamente se uma chamada entrar em modo tela cheia
    const bodyObserver = new MutationObserver(() => {
      if (document.body.classList.contains('in-call-fullscreen')) {
        closeZenitheCard();
      }
    });
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  // Inicializar quando o documento carregar
  function init() {
    setupZenitheEvents();

    // Requisito: ao entrar no chat, o card deve aparecer toda vez que entrar
    // Aguardamos 650ms para garantir que os elementos do chat e nickname foram verificados
    setTimeout(() => {
      // Verificar se o usuário está logado no chat antes de exibir o card
      const currentUser = localStorage.getItem('papos_nickname');
      if (currentUser && currentUser.trim() !== '') {
        showZenitheCard();
      } else {
        // Se a página não redirecionou, exibe mesmo assim após conferência
        showZenitheCard();
      }
    }, 650);
  }

  // Exportar funções globais
  window.showZenitheCard = showZenitheCard;
  window.closeZenitheCard = closeZenitheCard;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
