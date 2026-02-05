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
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).catch(() => undefined);
  });
}
