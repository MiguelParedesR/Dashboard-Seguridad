// login.js

// === LOGIN OPERADORES (CCTV) ===
async function loginOperador(email, password) {
    try {
        // buscamos al operador por correo
        const { data, error } = await supabase
            .from('operadores')
            .select('*')
            .eq('correo', email)
            .single();

        if (error || !data) {
            alert("Operador no encontrado");
            return false;
        }

        // ⚠️ Aquí debería usarse bcrypt para comparar hashes
        if (data.clave_encriptada !== password) {
            alert("Clave incorrecta");
            return false;
        }

        alert(`Bienvenido, ${data.nombre}`);
        // Redirigir al panel CCTV
        window.location.href = "calendario.html";
        return true;

    } catch (err) {
        console.error(err);
        alert("Error en login operador");
    }
}



// === LOGIN AGENTES (SEGURIDAD) ===
// Aquí asumimos que ya usas FaceIO en tu HTML para validar rostro
async function loginAgente(dni, local, puesto, horas = 12) {
    try {
        // verificamos que el agente exista
        const { data: agente, error } = await supabase
            .from('agentes')
            .select('*')
            .eq('dni', dni)
            .single();

        if (error || !agente) {
            alert("Agente no encontrado");
            return false;
        }

        // Aquí iría la validación facial con FaceIO:
        // faceio.authenticate({ locale: "auto" }).then(...)
        // De momento simulamos OK.

        // Insertamos en asignaciones
        const { error: insertError } = await supabase
            .from('asignaciones')
            .insert([
                {
                    agente_id: agente.id,
                    local: local,
                    puesto: puesto,
                    horas: horas,
                    tipo: "normal"
                }
            ]);

        if (insertError) {
            console.error(insertError);
            alert("Error registrando asignación");
            return false;
        }

        alert(`Bienvenido ${agente.nombre}, asignado a ${puesto} en ${local}`);
        // Redirigir al dashboard de agente
        window.location.href = "dashboard.html";
        return true;

    } catch (err) {
        console.error(err);
        alert("Error en login agente");
    }
}



// === Ejemplo de uso desde tu formulario HTML ===
document.getElementById("formOperador")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("opCorreo").value;
    const pass = document.getElementById("opClave").value;
    await loginOperador(email, pass);
});

document.getElementById("formAgente")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dni = document.getElementById("agDni").value;
    const local = document.getElementById("agLocal").value;
    const puesto = document.getElementById("agPuesto").value;
    const horas = parseInt(document.getElementById("agHoras").value) || 12;
    await loginAgente(dni, local, puesto, horas);
});
