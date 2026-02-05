import { useEffect, useState } from 'react';
import './noticias.css';

const STORAGE_KEY = 'tpp_news';

function readNews() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

export default function NoticiasView() {
  const [titulo, setTitulo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [news, setNews] = useState(() => readNews());

  useEffect(() => {
    document.title = 'Noticias';
    document.body.dataset.view = 'noticias';
    document.body.classList.remove('view-login');
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(news));
  }, [news]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!titulo.trim()) return;
    const entry = {
      id: Date.now(),
      titulo: titulo.trim(),
      detalle: detalle.trim(),
      fecha: new Date().toLocaleString()
    };
    setNews((prev) => [entry, ...prev]);
    setTitulo('');
    setDetalle('');
  };

  return (
    <section className="noticias">
      <div className="page-header">
        <div>
          <h1 className="page-title">Noticias internas</h1>
          <p className="page-subtitle">Comunica cambios operativos en tiempo real.</p>
        </div>
      </div>

      <div className="grid cols-2">
        <form className="card" onSubmit={handleSubmit}>
          <h3>Nuevo comunicado</h3>
          <label htmlFor="titulo">Titulo</label>
          <input
            id="titulo"
            className="input"
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            placeholder="Ej: Actualizacion de protocolos"
          />
          <label htmlFor="detalle">Detalle</label>
          <textarea
            id="detalle"
            className="input"
            rows="5"
            value={detalle}
            onChange={(event) => setDetalle(event.target.value)}
            placeholder="Resumen para el equipo"
          />
          <button className="btn" type="submit">Publicar</button>
        </form>

        <div className="card soft">
          <h3>Ultimos comunicados</h3>
          <ul className="news-list">
            {news.length === 0 && <li className="muted">Aun no hay comunicados.</li>}
            {news.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.titulo}</strong>
                  <p>{item.detalle || 'Sin detalle.'}</p>
                </div>
                <span className="news-date">{item.fecha}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
