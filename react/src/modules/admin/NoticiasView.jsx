import { useEffect, useState } from 'react';
import './noticias.css';

const STORAGE_KEY = 'tpp_news';

function readNews() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function NoticiasView() {
  const [titulo, setTitulo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [news, setNews] = useState(() => readNews());
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    document.title = 'Notas operativas';
    document.body.dataset.view = 'noticias';
    document.body.classList.remove('view-login');
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(news));
  }, [news]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const cleanTitle = titulo.trim();
    if (!cleanTitle) {
      setFeedback('Escribe un título antes de guardar la nota.');
      return;
    }

    const entry = {
      id: Date.now(),
      titulo: cleanTitle,
      detalle: detalle.trim(),
      fecha: new Date().toLocaleString('es-PE')
    };

    setNews((prev) => [entry, ...prev]);
    setTitulo('');
    setDetalle('');
    setFeedback('Nota guardada en este navegador.');
  };

  return (
    <section className="noticias">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notas operativas</h1>
          <p className="page-subtitle">
            Bloc local para preparar comunicados. Estas notas se guardan solo en este navegador hasta conectar la fuente corporativa.
          </p>
        </div>
        <span className="status pendiente">Local</span>
      </div>

      {feedback && <p className="usuario-warning" role="status">{feedback}</p>}

      <div className="grid cols-2">
        <form className="card" onSubmit={handleSubmit}>
          <h3>Nueva nota</h3>
          <label htmlFor="titulo">Título</label>
          <input
            id="titulo"
            className="input"
            value={titulo}
            onChange={(event) => {
              setTitulo(event.target.value);
              setFeedback('');
            }}
            placeholder="Ej. Actualización de protocolos"
            maxLength={120}
          />

          <label htmlFor="detalle">Detalle</label>
          <textarea
            id="detalle"
            className="input"
            rows="7"
            value={detalle}
            onChange={(event) => setDetalle(event.target.value)}
            placeholder="Resumen para el equipo"
            maxLength={1200}
          />

          <button className="btn" type="submit">Guardar nota</button>
        </form>

        <div className="card soft">
          <h3>Notas guardadas</h3>
          <ul className="news-list">
            {news.length === 0 && <li className="muted">Aún no hay notas locales.</li>}
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
