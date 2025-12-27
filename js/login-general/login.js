// LOGIN.JS
function getAppRootPath() {
  const path = window.location.pathname;
  const htmlIndex = path.indexOf('/html/');
  if (htmlIndex !== -1) return path.slice(0, htmlIndex + 1);
  if (path.endsWith('/')) return path;
  return path.slice(0, path.lastIndexOf('/') + 1);
}

function resolveAppUrl(relativePath) {
  const base = new URL(getAppRootPath(), window.location.href);
  return new URL(relativePath.replace(/^\//, ''), base).href;
}

function navigateTo(relativePath) {
  const url = resolveAppUrl(relativePath);
  if (window.__sidebar?.loadPartial) {
    window.__sidebar.loadPartial(url, true);
    return;
  }
  window.location.href = url;
}
document.addEventListener('DOMContentLoaded', function () {
  // Cached DOM elements (use optional chaining and guards to avoid null errors)
  const adminBtn = document.getElementById('adminBtn');
  const operadorBtn = document.getElementById('operadorBtn');
  const agenteBtn = document.getElementById('agenteBtn');

  const adminForm = document.getElementById('adminForm');
  const operadorForm = document.getElementById('operadorForm');
  const agenteForm = document.getElementById('agenteForm');

  const adminPasswordInput = document.getElementById('adminPassword');
  const operadorDropdownBtn = document.getElementById('operadorDropdownBtn');
  const operadorDropdown = document.getElementById('operadorDropdown');
  const operadorClaveInput = document.getElementById('operadorClave');
  const errorMessage = document.getElementById('errorMessage');

  // Load operadores from Supabase (if available). Defensive: skip if supabase not present.
  async function loadOperadores() {
    if (typeof supabase === 'undefined') {
      console.warn('login.js: supabase SDK is not available; skipping loadOperadores');
      return;
    }
    if (!operadorDropdown || !operadorDropdownBtn) {
      console.warn('login.js: operador dropdown elements missing in DOM, skipping');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('operadores')
        .select('id, nombre')
        .order('nombre', { ascending: true });

      if (error) {
        console.error('Error cargando operadores:', error);
        return;
      }

      operadorDropdown.innerHTML = '';
      (data || []).forEach(operador => {
        const option = document.createElement('div');
        option.classList.add('dropdown-item');
        option.textContent = operador.nombre;
        option.addEventListener('click', () => {
          operadorDropdownBtn.textContent = operador.nombre;
          operadorDropdown.classList.add('hidden');
        });
        operadorDropdown.appendChild(option);
      });

      operadorDropdownBtn.addEventListener('click', () => {
        operadorDropdown.classList.toggle('hidden');
      });
    } catch (err) {
      console.error('login.js: loadOperadores failed', err);
    }
  }

  // Role selection buttons: show the correct form and hide others
  adminBtn?.addEventListener('click', () => {
    adminForm?.classList.remove('hidden');
    operadorForm?.classList.add('hidden');
    agenteForm?.classList.add('hidden');
  });

  operadorBtn?.addEventListener('click', () => {
    operadorForm?.classList.remove('hidden');
    adminForm?.classList.add('hidden');
    agenteForm?.classList.add('hidden');
    // Load operadores when the operador form is displayed
    loadOperadores();
  });

  agenteBtn?.addEventListener('click', () => {
    agenteForm?.classList.remove('hidden');
    adminForm?.classList.add('hidden');
    operadorForm?.classList.add('hidden');
  });

  // Admin login handler (simple local check)
  adminForm?.addEventListener('submit', function (e) {
    e.preventDefault();
    if (adminPasswordInput && adminPasswordInput.value === 'admin123') {
      navigateTo('html/base/dashboard.html');
    } else {
      alert('Contraseña incorrecta');
    }
  });

  // Operador login handler (simple local check for now)
  operadorForm?.addEventListener('submit', function (e) {
    e.preventDefault();
    if (operadorClaveInput && operadorClaveInput.value === 'claveCorrecta') {
      navigateTo('html/actividades-cctv/incidencias.html');
    } else {
      alert('Clave incorrecta');
    }
  });
});
