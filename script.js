// script.js - Lógica del Juego y Login Estático

// === CONSTANTES ===
const KEY_STATE = "telefunkenGameState";
const LOGIN_KEY = "isLoggedIn"; 
const MAX_ITEMS = 7; // Número de elementos de puntaje (TRICA a ESCALERA)

// === PERSISTENCIA Y ESTADO ===

function guardarEstado() {
    const num = parseInt(document.getElementById('numJugadores').value) || 0;
    const jugadores = [];
    
    // Recolectar datos del DOM
    for (let i = 0; i < num; i++) {
        const valores = [];
        for (let j = 0; j < MAX_ITEMS; j++) {
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
        iniciado: (document.getElementById('jugadores')?.innerHTML.trim() !== '')
    };
    
    localStorage.setItem(KEY_STATE, JSON.stringify(estado)); 
}

function aplicarEstado(estado) {
    if (!estado || !estado.jugadores) return;

    const select = document.getElementById('numJugadores');
    select.value = estado.numJugadores;
    
    crearInputsJugadores(estado.jugadores); 

    if (estado.iniciado) {
        setTimeout(() => {
            crearTablasJugadoresConDatos(estado.jugadores);
        }, 100); 
    }
}

function cargarEstado() {
    const estadoGuardado = localStorage.getItem(KEY_STATE);
    if (estadoGuardado) {
        aplicarEstado(JSON.parse(estadoGuardado));
    }
}

function guardarEstadoTemporal() {
    const num = document.getElementById('numJugadores').value;
    if (num) {
        const jugadores = [];
        for (let i = 0; i < num; i++) {
            const input = document.getElementById(`jugador${i}`);
            jugadores.push({ nombre: input ? input.value : '' });
        }
        const tempState = { numJugadores: num, jugadores, iniciado: false };
        localStorage.setItem(KEY_STATE, JSON.stringify(tempState));
    }
}


// === AUTENTICACIÓN Y VISUALIZACIÓN DE USUARIO ===

function mostrarUsuario() {
    const username = localStorage.getItem('currentUser');
    const displayElement = document.getElementById('usuarioDisplay');
    
    if (username && displayElement) {
        displayElement.innerHTML = `Sesión iniciada como: <strong>${username}</strong>`;
    }
}

function checkAuth() {
    const loggedIn = localStorage.getItem(LOGIN_KEY);
    if (loggedIn !== 'true') {
        window.location.href = 'login.html'; 
        return false;
    }
    return true;
}

function logout() {
    if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
        localStorage.removeItem(LOGIN_KEY); 
        localStorage.removeItem('currentUser'); 
        localStorage.removeItem(KEY_STATE); 
        window.location.href = 'login.html';     
    }
}


// === LÓGICA DE INTERFAZ Y JUEGO ===

function crearInputsJugadores(savedPlayers = []) {
    const num = parseInt(document.getElementById('numJugadores').value) || 0;
    const contenedor = document.getElementById('inputJugadores');
    contenedor.innerHTML = '';

    for (let i = 0; i < num; i++) {
        const savedName = savedPlayers[i]?.nombre || '';
        contenedor.innerHTML += `
            <div>
              <label>Jugador ${i + 1}: </label>
              <input type="text" id="jugador${i}" placeholder="Nombre" value="${savedName}"
                     oninput="this.value = this.value.toUpperCase(); guardarEstadoTemporal()" />
            </div>
        `;
    }
}

function generarTablaJugador(nombre, index) {
    const items = ["TRICA", "DOS TRICAS", "TRES TRICAS", "CUARTO", "2 CUARTOS", "QUINA", "ESCALERA"];
    let tabla = `
        <div class="jugador" id="jugadorDiv${index}">
          <h3>${nombre}</h3>
          <table>
            <tr><th>Elemento</th><th>Valor</th></tr>
            <tr>
              <td class="monedas">monedas</td>
              <td id="monedas${index}">7</td>
            </tr>
            <tr>
              <td>Acciones</td>
              <td style="display: flex; justify-content: space-around;">
                <button onclick="comprar(${index})" class="btn-secondary">Comprar</button>
                <button onclick="devolver(${index})" class="btn-secondary">Devolver</button>
              </td>
            </tr>
    `;
    
    items.forEach((item, i) => {
        tabla += `
          <tr>
            <td>${item}</td>
            <td>
              <input type="number" min="0" id="input${index}_${i}" placeholder=" " 
                     oninput="actualizarEstadoCampo(this); calcularTotal(${index})">
            </td>
          </tr>`;
    });

    tabla += `<tr><td class="total">total</td><td id="total${index}" class="total">0</td></tr>`;
    tabla += `</table></div>`;
    
    return tabla;
}

function crearTablasJugadores() {
    const num = parseInt(document.getElementById('numJugadores').value);
    if (!num || num < 1) return alert("Selecciona una cantidad de jugadores.");

    const jugadoresDiv = document.getElementById('jugadores');
    jugadoresDiv.innerHTML = '';

    for (let i = 0; i < num; i++) {
        const nombre = (document.getElementById(`jugador${i}`)?.value || `JUGADOR ${i + 1}`).toUpperCase();
        jugadoresDiv.innerHTML += generarTablaJugador(nombre, i);
    }
    
    guardarEstado(); 
    actualizarRanking();
}

function crearTablasJugadoresConDatos(jugadoresData) {
    const num = jugadoresData.length;
    const jugadoresDiv = document.getElementById('jugadores');
    jugadoresDiv.innerHTML = '';

    for (let i = 0; i < num; i++) {
        const nombre = jugadoresData[i]?.nombre || `JUGADOR ${i + 1}`;
        jugadoresDiv.innerHTML += generarTablaJugador(nombre, i);
    }

    setTimeout(() => {
        jugadoresData.forEach((j, i) => {
            if (document.getElementById(`monedas${i}`)) {
                document.getElementById(`monedas${i}`).innerText = j.monedas;
            }
            for (let k = 0; k < MAX_ITEMS; k++) {
                const input = document.getElementById(`input${i}_${k}`);
                if (input && j.valores[k] !== undefined) {
                    input.value = j.valores[k];
                    if (j.valores[k] !== '') input.classList.add('filled');
                }
            }
            if (document.getElementById(`total${i}`)) {
                document.getElementById(`total${i}`).innerText = j.total;
            }
        });
        actualizarRanking();
    }, 100);
}

function actualizarEstadoCampo(input) {
    if (input.value.trim() !== '') {
        input.classList.add('filled');
    } else {
        input.classList.remove('filled');
    }
    // NOTA: Se evita llamar a guardarEstado aquí para prevenir demasiadas escrituras,
    // y se deja que calcularTotal maneje el guardado.
}

function comprar(index) {
    let monedas = parseInt(document.getElementById(`monedas${index}`).innerText);
    if (monedas > 0) {
        monedas--;
        document.getElementById(`monedas${index}`).innerText = monedas;
        guardarEstado();
        actualizarRanking();
    }
}

function devolver(index) {
    let monedas = parseInt(document.getElementById(`monedas${index}`).innerText);
    monedas++;
    document.getElementById(`monedas${index}`).innerText = monedas;
    guardarEstado();
    actualizarRanking();
}

function calcularTotal(index) {
    let total = 0;
    for (let i = 0; i < MAX_ITEMS; i++) {
        const input = document.getElementById(`input${index}_${i}`);
        // 🛑 CRUCIAL: Convierte valores vacíos a 0 para el cálculo
        total += parseInt(input?.value || 0);
    }
    
    // 1. Actualiza el total en la tabla del jugador
    document.getElementById(`total${index}`).innerText = total;
    
    // 2. Guarda el estado (que usa el total actualizado)
    guardarEstado(); 
    
    // 3. LLAMADA FINAL: Asegura la actualización del ranking
    actualizarRanking(); 
}

function actualizarRanking() {
    const numSelect = document.getElementById('numJugadores').value;
    const num = numSelect ? parseInt(numSelect) : 0;
    let puntajes = [];

    for (let i = 0; i < num; i++) {
        const inputNombre = document.getElementById(`jugador${i}`);
        const tituloTabla = document.querySelector(`#jugadorDiv${i} h3`);
        
        let nombre = `JUGADOR ${i + 1}`;
        
        // Obtención robusta del nombre
        if (inputNombre) {
            nombre = inputNombre.value.toUpperCase() || nombre;
        } else if (tituloTabla) {
            nombre = tituloTabla.innerText.toUpperCase();
        }
        
        // Lectura del total actualizado desde el DOM
        const total = parseInt(document.getElementById(`total${i}`)?.innerText) || 0;
        puntajes.push({ nombre, total });
    }

    // Ordenar de menor a mayor (el menor puntaje gana)
    puntajes.sort((a, b) => a.total - b.total); 
    
    let rankingHTML = '<h3>🏆 Puntuaciones Mínimas (Ranking)</h3>';
    if (puntajes[0]) rankingHTML += `<p>🏅 1º lugar: <strong>${puntajes[0].nombre}</strong> (${puntajes[0].total})</p>`;
    if (puntajes[1]) rankingHTML += `<p>🥈 2º lugar: ${puntajes[1].nombre} (${puntajes[1].total})</p>`;
    if (puntajes[2]) rankingHTML += `<p>🥉 3º lugar: ${puntajes[2].nombre} (${puntajes[2].total})</p>`;
    
    document.getElementById('ranking').innerHTML = rankingHTML;
}

function reiniciarJuego() {
    if (confirm("¿Estás seguro de que deseas comenzar de nuevo? Todos los datos de la partida se perderán.")) {
        localStorage.removeItem(KEY_STATE);
        location.reload();
    }
}


// === INICIALIZACIÓN PRINCIPAL (FLUJO DE CARGA) ===
window.onload = function() {
    // 1. Verificar sesión.
    if (!checkAuth()) return; 

    // 2. MOSTRAR EL NOMBRE DE USUARIO
    mostrarUsuario();

    // 3. Cargar estado guardado
    cargarEstado();

    // 4. Ocultar el Splash Screen
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