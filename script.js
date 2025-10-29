// script.js - Lógica Principal del Juego

// === CONSTANTES Y CONFIGURACIÓN ===
const KEY_STATE = "telefunkenGameState";
const API_URL = '/api'; // Apunta a las Netlify Functions

// === AUTENTICACIÓN Y HEADERS ===

/**
 * Obtiene los headers de autorización, incluyendo el token JWT si está presente.
 */
function getAuthHeaders() {
    const token = localStorage.getItem('userToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        // Usa el token JWT para la autorización
        headers['Authorization'] = `Bearer ${token}`; 
    }
    return headers;
}

/**
 * Verifica la sesión de usuario a través del token JWT.
 * Redirige a login.html si el token no existe.
 */
function checkAuth() {
    // 🚩 IMPORTANTE: Ahora verificamos si existe el 'userToken'
    const token = localStorage.getItem('userToken'); 
    if (!token) {
        window.location.href = 'login.html'; 
        return false;
    }
    return true;
}

function logout() {
    if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
        // Elimina el token (sesión real) y el estado del juego
        localStorage.removeItem('userToken');
        localStorage.removeItem(KEY_STATE); 
        // También puedes eliminar KEY_AUTH si lo usas, aunque ya no es necesario
        localStorage.removeItem('telefunkenAuth'); 
        window.location.href = 'login.html';     
    }
}

// === PERSISTENCIA Y SINCRONIZACIÓN ===

/**
 * Guarda el estado del juego, primero localmente y luego en el servidor (si hay token).
 */
function guardarEstado() {
    const num = parseInt(document.getElementById('numJugadores').value);
    const jugadores = [];

    // --- Lógica para recolectar datos del DOM ---
    for (let i = 0; i < num; i++) {
        const valores = [];
        for (let j = 0; j < 7; j++) {
            const input = document.getElementById(`input${i}_${j}`);
            valores.push(input ? input.value : ''); 
        }
        jugadores.push({
            nombre: (document.getElementById(`jugador${i}`)?.value || `JUGADOR ${i + 1}`).toUpperCase(),
            monedas: parseInt(document.getElementById(`monedas${i}`)?.innerText) || 7,
            valores,
            total: parseInt(document.getElementById(`total${i}`)?.innerText) || 0
        });
    }

    const estado = {
        numJugadores: num,
        jugadores: jugadores,
        iniciado: (document.getElementById('jugadores')?.innerHTML !== '') // Asume que el juego ha comenzado si hay tablas
    };

    // 1. Guardado Local (Backup)
    localStorage.setItem(KEY_STATE, JSON.stringify(estado)); 
    
    // 2. Guardado en Servidor (Netlify Function: saveGame.js)
    const token = localStorage.getItem('userToken');
    if (token && estado.iniciado) {
        fetch(`${API_URL}/saveGame`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(estado)
        })
        .then(response => {
            if (!response.ok) {
                console.warn(`Error ${response.status} al guardar en el servidor. (Token expirado o error interno)`);
            }
        })
        .catch(err => console.error("Error de red al intentar guardar:", err));
    }
}


/**
 * Aplica el objeto de estado cargado (local o remoto) al DOM.
 * @param {object} estado - El objeto con el estado del juego.
 */
function aplicarEstado(estado) {
    if (!estado || !estado.jugadores) return;

    // 1. Aplicar número de jugadores y nombres
    const select = document.getElementById('numJugadores');
    select.value = estado.numJugadores;
    
    // NOTA: Debes tener la función crearInputsJugadores(jugadoresData) definida aquí o importada.
    // Asumo que está definida más abajo.
    crearInputsJugadores(estado.jugadores); 

    // 2. Si el juego estaba iniciado, crear tablas y cargar datos
    if (estado.iniciado) {
        setTimeout(() => {
            // NOTA: Debes tener la función crearTablasJugadoresConDatos(jugadoresData) definida aquí.
            crearTablasJugadoresConDatos(estado.jugadores);
        }, 100); 
    }
}


/**
 * Lógica auxiliar para la carga local.
 */
function cargarEstadoLocal() {
    const estadoGuardado = localStorage.getItem(KEY_STATE);
    if (estadoGuardado) {
        aplicarEstado(JSON.parse(estadoGuardado));
        console.log("Partida cargada desde almacenamiento local.");
        return true;
    } else {
        console.log("No se encontró partida guardada localmente.");
        return false;
    }
}


/**
 * Función principal para cargar el estado de juego (prioriza el servidor).
 * Este es el fragmento de código CORRECTO que reemplaza a la función duplicada.
 */
function cargarEstado() {
    const token = localStorage.getItem('userToken');
    
    if (token) {
        // 1. Intentar cargar desde el servidor (Netlify Function: loadGame.js)
        fetch(`${API_URL}/loadGame`, {
            method: 'GET',
            headers: getAuthHeaders()
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else if (response.status === 404) {
                // No hay partida guardada en el servidor, intenta local
                console.log("No hay partida guardada en el servidor. Intentando local...");
                return cargarEstadoLocal();
            }
            throw new Error(`Error ${response.status} al cargar la partida del servidor.`);
        })
        .then(data => {
            // Si data existe y tiene gameState, usa el estado remoto.
            if (data && data.gameState) {
                aplicarEstado(data.gameState);
                console.log("Partida cargada desde el servidor.");
            }
            // Si no tiene gameState, o si el fetch anterior llamó a cargarEstadoLocal, no hace nada.
        })
        .catch(err => {
            console.error("Fallo general en la carga remota. Intentando cargar localmente...", err);
            cargarEstadoLocal(); 
        });

    } else {
        // 2. Si no hay token de usuario (modo invitado), cargar solo localmente
        cargarEstadoLocal();
    }
}


// === INICIALIZACIÓN ===
window.onload = function() {
    // 1. Verificar sesión ANTES de cargar el juego
    if (!checkAuth()) return; 

    // 2. Cargar estado guardado (local o remoto)
    cargarEstado();

    // 3. Ocultar el Splash Screen (Requiere las keyframes fadeOut definidas en CSS)
    setTimeout(() => {
        const splash = document.getElementById("splash");
        if (splash) {
            splash.style.animation = "fadeOut 0.8s forwards";
            setTimeout(() => {
                splash.style.display = "none";
                const mainContent = document.getElementById("mainContent");
                if (mainContent) {
                    mainContent.style.display = "block";
                }
            }, 800);
        }
    }, 2000); 
};


// === NOTA FINAL: El resto de funciones (crearInputsJugadores, generarTablaJugador, etc.)
// === DEBEN colocarse aquí, justo después de window.onload.