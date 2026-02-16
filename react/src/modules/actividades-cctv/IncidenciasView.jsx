import { useEffect } from 'react';

const INCIDENCIAS_URL = 'https://miguelparedesr.github.io/Formulario-Mamparas/?view=%2Findex.html';

export default function IncidenciasView() {
  useEffect(() => {
    window.location.replace(INCIDENCIAS_URL);
  }, []);

  return null;
}
