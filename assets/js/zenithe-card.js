/**
 * Zenithe Promo Card Controller
 * Apresenta o card promocional do Zenithe (https://zenithe.net.br) ao entrar no chat
 */

(function () {
  'use strict';

  let lastFocusedElement = null;

  function getOverlay() {
    return document.getElementById('zenitheModalOverlay');
  }

  function showZenitheCard() {
    
    if (document.body.classList.contains('in-call-fullscreen')) {
      return;
    }

    const overlay = getOverlay();
    if (!overlay) return;

    
    if (document.activeElement && typeof document.activeElement.focus === 'function') {
      lastFocusedElement = document.activeElement;
    }

    overlay.removeAttribute('aria-hidden');
    overlay.classList.remove('d-none');
    
    void overlay.offsetWidth;
    overlay.classList.add('zenithe-visible');

    
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

    
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      try { lastFocusedElement.focus(); } catch (e) {}
    } else {
      const msgInput = document.getElementById('message-input');
      if (msgInput && typeof msgInput.focus === 'function') {
        try { msgInput.focus(); } catch (e) {}
      }
    }

    overlay.classList.remove('zenithe-visible');
    setTimeout(() => {
      if (!overlay.classList.contains('zenithe-visible')) {
        overlay.classList.add('d-none');
        overlay.setAttribute('aria-hidden', 'true');
      }
    }, 280);
  }

  function setupZenitheEvents() {
    const overlay = getOverlay();
    if (!overlay) return;

    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeZenitheCard();
      }
    });

    
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const focusableElements = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusableElements.length === 0) return;
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    });

    
    const closeBtn = document.getElementById('btnZenitheClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closeZenitheCard();
      });
    }

    
    const dismissBtn = document.getElementById('btnZenitheDismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closeZenitheCard();
      });
    }

    
    const ctaBtn = document.getElementById('btnZenitheCta');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', () => {
        
        setTimeout(() => {
          closeZenitheCard();
        }, 150);
      });
    }

    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('zenithe-visible')) {
        closeZenitheCard();
      }
    });

    
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
        
        const offcanvasEl = document.getElementById('offcanvasMobileMenu');
        if (offcanvasEl && window.bootstrap && window.bootstrap.Offcanvas) {
          const bsOffcanvas = window.bootstrap.Offcanvas.getInstance(offcanvasEl);
          if (bsOffcanvas) bsOffcanvas.hide();
        }
        showZenitheCard();
      });
    }

    
    const bodyObserver = new MutationObserver(() => {
      if (document.body.classList.contains('in-call-fullscreen')) {
        closeZenitheCard();
      }
    });
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  
  function init() {
    setupZenitheEvents();

    
    setTimeout(() => {
      
      const currentUser = localStorage.getItem('papos_nickname');
      if (currentUser && currentUser.trim() !== '') {
        showZenitheCard();
      } else {
      
        showZenitheCard();
      }
    }, 650);
  }

  
  window.showZenitheCard = showZenitheCard;
  window.closeZenitheCard = closeZenitheCard;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
