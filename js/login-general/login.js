LOGIN.JS



document.addEventListener("DOMContentLoaded", function () {

  const adminBtn = document.getElementById('adminBtn');
  const operadorBtn = document.getElementById('operadorBtn');
  const agenteBtn = document.getElementById('agenteBtn');
  
  const adminForm = document.getElementById('adminForm');
  const operadorForm = document.getElementById('operadorForm');
  const agenteForm = document.getElementById('agenteForm');
  
  const operadorDropdownBtn = document.getElementById('operadorDropdownBtn');
  const operadorDropdown = document.getElementById('operadorDropdown');
  
  const adminPasswordInput = document.getElementById('adminPassword');
  const operadorClaveInput = document.getElementById('operadorClave');
  
  // Función para alternar la visibilidad de los formularios
  function toggleForm(form) {
    const forms = [adminForm, operadorForm, agenteForm];
    
    // Ocultar todos los formularios primero
    forms.forEach(f => {
      if (f !== form) f.classList.add('hidden');
    });

    // Alternar la visibilidad del formulario actual
    form.classList.toggle('hidden');
  }

  // Agregar event listeners a los botones para mostrar/ocultar los formularios
  adminBtn.addEventListener('click', () => toggleForm(adminForm));
  operadorBtn.addEventListener('click', () => toggleForm(operadorForm));
  agenteBtn.addEventListener('click', () => toggleForm(agenteForm));

  async function loadOperadores() {
    const { data, error } = await supabase
      .from('operadores')
      .select('id, nombre')
      .order('nombre', { ascending: true });

    if (error) {
      console.error("Error cargando operadores:", error);
      return;
    }

    operadorDropdown.innerHTML = '';
    data.forEach(operador => {
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
  }

  // Ingreso ADMINISTRADOR
  adminForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (adminPasswordInput.value === 'admin123') {
      alert('Bienvenido Administrador');
      window.location.href = 'dashboardAdmin.html';
    } else {
      alert('Contraseña incorrecta');
    }
  });

  // Ingreso OPERADOR CCTV
  operadorForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const operadorClave = operadorClaveInput.value;
    // Validación con Supabase aquí
    if (operadorClave === 'claveCorrecta') {
      alert('Operador logueado');
      window.location.href = 'panelCCTV.html';
    } else {
      alert('Clave incorrecta');
    }
  });

  // Cargar los operadores cuando se abra el formulario
  operadorBtn.addEventListener('click', loadOperadores);

});
