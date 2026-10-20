import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MediaPicker } from './components/MediaPicker';

declare global {
  interface Window {
    __paposMediaPickerReactRoot?: Root;
  }
}

export function mountMediaPicker() {
  let rootContainer = document.getElementById('papos-media-picker-root');
  if (!rootContainer) {
    rootContainer = document.createElement('div');
    rootContainer.id = 'papos-media-picker-root';
    document.body.appendChild(rootContainer);
  }

  // Garantir montagem única (React 19 createRoot singleton)
  if (!window.__paposMediaPickerReactRoot) {
    window.__paposMediaPickerReactRoot = createRoot(rootContainer);
  }

  window.__paposMediaPickerReactRoot.render(<MediaPicker />);
}

(window as any).mountMediaPicker = mountMediaPicker;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountMediaPicker);
} else {
  mountMediaPicker();
}
