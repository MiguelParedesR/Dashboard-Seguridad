// Funciones de autenticación
async function loginOperador(clave) {
    // Aquí validaremos clave fija con Supabase
    console.log("Login operador:", clave);
  }
  
  async function loginAgente(dni) {
    // Aquí se conecta con FaceIO y Supabase
    console.log("Login agente:", dni);
  }
  