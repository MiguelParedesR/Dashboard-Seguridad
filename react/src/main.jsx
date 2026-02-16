import React from 'react';
import { createRoot } from 'react-dom/client';
import './services/config.js';
import './styles/app.css';
import App from './app/App.jsx';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch (err) {
      // Ignore cleanup failures.
    }

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (err) {
      // Ignore cleanup failures.
    }
  });
}
