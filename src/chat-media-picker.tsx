import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MediaPicker } from './components/MediaPicker';

declare global {
  interface Window {
    mountMediaPicker?: () => void;
  }
}

let mediaPickerRoot: Root | null = null;

export function mountMediaPicker() {
  const container = document.getElementById('papos-media-picker-root');
  if (!container) {
    console.error('Media picker root element was not found.');
    return;
  }

  if (mediaPickerRoot) return;

  mediaPickerRoot = createRoot(container);
  mediaPickerRoot.render(<MediaPicker />);
}

window.mountMediaPicker = mountMediaPicker;
mountMediaPicker();
