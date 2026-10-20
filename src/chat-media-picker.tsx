import React from 'react';
import { createRoot } from 'react-dom/client';
import { MediaPicker } from './components/MediaPicker';

function mountMediaPicker() {
  let rootContainer = document.getElementById('papos-media-picker-root');
  if (!rootContainer) {
    rootContainer = document.createElement('div');
    rootContainer.id = 'papos-media-picker-root';
    document.body.appendChild(rootContainer);
  }

  const root = createRoot(rootContainer);
  root.render(<MediaPicker />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountMediaPicker);
} else {
  mountMediaPicker();
}
