// script.js — HOST CONTROLLER
// ⚠️ REEMPLAZÁ con tu URL de Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycbzu6aV1X2_11nPizpTSMmAQn3rnrxQ1zEKlPhPMoghQhXfuXcBKXB4x-JnxQ3IdFnLCZQ/exec';

const KEY_STATE  = "telefunkenGameState";
const LOGIN_KEY  = "isLoggedIn";
const MAX_ITEMS  = 7;
const ITEMS      = ["TRICA","DOS TRICAS","TRES TRICAS","CUARTO","2 CUARTOS","QUINA","ESCALERA"];

let currentGameId = null;
let autoSaveTimer  = null;
let estadoJugadores = [];

// ── AUTH ──────────────────────────────────────────────────────
function checkAuth() {
  if (localStorage.getItem(LOGIN_KEY) !== 'true') {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function logout() {
  if (confirm("¿Cerrar sesión? La partida activa se mantendrá en el servidor.")) {
    localStorage.removeItem(LOGIN_KEY);
    localStorage.removeItem('currentUser');
    localStorage.removeItem(KEY_STATE);
    window.location.href = 'login.html';
  }
}

function mostrarUsuario() {
  const u = localStorage.getItem('currentUser');
  const el = document.getElementById('usuarioDisplay');
  if (u && el) el.innerHTML = `Sesión: <strong>${u}</strong>`;
}

// ── SETUP: inputs de nombres ──────────────────────────────────
function crearInputsJugadores() {
  const num = parseInt(document.getElementById('numJugadores').value) || 0;
  const cont = document.getElementById('inputJugadores');
  cont.innerHTML = '';
  for (let i = 0; i < num; i++) {
    cont.innerHTML += `
      <div class="input-jugador-row">
        <label>Jugador ${i+1}</label>
        <input type="text" id="jugador${i}" placeholder="Nombre"
               oninput="this.value=this.value.toUpperCase()"/>
      </div>`;
  }
}

// ── CREAR PARTIDA ONLINE ─────────────────────────────────────
async function crearPartida() {
  const num = parseInt(document.getElementById('numJugadores').value);
  if (!num || num < 2) { showSetupMsg('Seleccioná al menos 2 jugadores.', 'error'); return; }

  const jugadores = [];
  for (let i = 0; i < num; i++) {
    const val = document.getElementById(`jugador${i}`)?.value.trim();
    if (!val) { showSetupMsg(`Completá el nombre del jugador ${i+1}.`, 'error'); return; }
    jugadores.push(val.toUpperCase());
  }

  const host = localStorage.getItem('currentUser');
  const btn = document.getElementById('btnCrear');
  btn.disabled = true;
  btn.textContent = '⏳ Creando partida...';
  showSetupMsg('Conectando con el servidor...', 'loading');

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'crearPartida', host, jugadores })
    });
    const data = await res.json();

    if (data.success) {
      currentGameId = data.gameId;
      estadoJugadores = data.jugadores;
      localStorage.setItem(KEY_STATE, JSON.stringify({ gameId: currentGameId, host }));
      iniciarPanelJuego();
    } else {
      showSetupMsg('❌ Error: ' + data.message, 'error');
      btn.disabled = false;
      btn.textContent = '🚀 Crear Partida Online';
    }
  } catch(e) {
    showSetupMsg('❌ Error de conexión. Revisá la URL del script.', 'error');
    btn.disabled = false;
    btn.textContent = '🚀 Crear Partida Online';
  }
}

// ── PANEL JUEGO ───────────────────────────────────────────────
function iniciarPanelJuego() {
  document.getElementById('panelSetup').style.display = 'none';
  document.getElementById('panelJuego').style.display = 'block';
  document.getElementById('gameIdDisplay').textContent = `🎮 Partida: ${currentGameId}`;

  renderWhatsappLinks();
  renderTablas();
  actualizarRanking();

  // Auto-save cada 10 segundos
  if (autoSaveTimer) clearInterval(autoSaveTimer);
  autoSaveTimer = setInterval(guardarEnServidor, 10000);
}

function renderWhatsappLinks() {
  const baseUrl = window.location.origin + window.location.pathname.replace('index.html','') + 'game-view.html';
  const cont = document.getElementById('whatsappLinks');
  cont.innerHTML = '<div class="wapp-bar-title">📤 Compartí el link con cada jugador:</div>';
  estadoJugadores.forEach(j => {
    const link = `${baseUrl}?game=${currentGameId}&player=${encodeURIComponent(j.nombre)}`;
    const msg = encodeURIComponent(`¡Hola ${j.nombre}! Te invito a ver tu partida de TELEFUNKEN FAMILIAR 🎲\n${link}`);
    cont.innerHTML += `
      <div class="wapp-player-row">
        <span class="wapp-nombre">${j.nombre}</span>
        <a href="https://wa.me/?text=${msg}" target="_blank" class="whatsapp-btn wapp-small">
          📱 Enviar link
        </a>
        <button onclick="copiarLink('${link}')" class="btn-copy">📋 Copiar</button>
      </div>`;
  });
}

function copiarLink(url) {
  navigator.clipboard.writeText(url).then(() => {
    mostrarIndicador('📋 Link copiado!');
  });
}

// ── TABLAS DE JUGADORES (HOST) ────────────────────────────────
function renderTablas() {
  const cont = document.getElementById('jugadores');
  cont.innerHTML = '';
  estadoJugadores.forEach((j, i) => {
    cont.innerHTML += generarTablaJugador(j, i);
  });
}

function generarTablaJugador(jugador, index) {
  return `
    <div class="jugador" id="jugadorDiv${index}">
      <h3>${jugador.nombre}</h3>
      <table>
        <tr><th>Elemento</th><th>Valor</th></tr>
        <tr>
          <td class="monedas">🪙 Monedas</td>
          <td id="monedas${index}">${jugador.monedas}</td>
        </tr>
        <tr>
          <td>Acciones</td>
          <td style="display:flex; gap:6px; justify-content:center; padding:6px;">
            <button onclick="comprar(${index})" class="btn-secondary">Comprar</button>
            <button onclick="devolver(${index})" class="btn-secondary">Devolver</button>
          </td>
        </tr>
        ${ITEMS.map((item, i) => `
        <tr>
          <td>${item}</td>
          <td>
            <input type="number" min="0" id="input${index}_${i}"
                   value="${jugador.valores[i] || ''}"
                   placeholder=" "
                   oninput="actualizarValor(${index}, ${i}, this.value)"
                   class="${jugador.valores[i] ? 'filled' : ''}"/>
          </td>
        </tr>`).join('')}
        <tr>
          <td class="total">TOTAL</td>
          <td id="total${index}" class="total">${jugador.total}</td>
        </tr>
      </table>
    </div>`;
}

// ── LÓGICA DE JUEGO ───────────────────────────────────────────
function actualizarValor(playerIdx, itemIdx, valor) {
  estadoJugadores[playerIdx].valores[itemIdx] = valor ? parseInt(valor) : '';
  calcularTotal(playerIdx);
  marcarPendiente();
}

function comprar(index) {
  if (estadoJugadores[index].monedas > 0) {
    estadoJugadores[index].monedas--;
    document.getElementById(`monedas${index}`).textContent = estadoJugadores[index].monedas;
    marcarPendiente();
    actualizarRanking();
  }
}

function devolver(index) {
  estadoJugadores[index].monedas++;
  document.getElementById(`monedas${index}`).textContent = estadoJugadores[index].monedas;
  marcarPendiente();
  actualizarRanking();
}

function calcularTotal(index) {
  let total = 0;
  estadoJugadores[index].valores.forEach(v => { total += parseInt(v) || 0; });
  estadoJugadores[index].total = total;
  const el = document.getElementById(`total${index}`);
  if (el) el.textContent = total;
  actualizarRanking();
}

function actualizarRanking() {
  const sorted = [...estadoJugadores].sort((a, b) => a.total - b.total);
  const medallas = ['🥇','🥈','🥉'];
  let html = '<h3>🏆 Ranking actual</h3>';
  sorted.forEach((j, i) => {
    html += `<p>${medallas[i] || (i+1)+'°'} <strong>${j.nombre}</strong> — ${j.total} pts (🪙${j.monedas})</p>`;
  });
  document.getElementById('ranking').innerHTML = html;
}

// ── SINCRONIZACIÓN CON SHEETS ─────────────────────────────────
function marcarPendiente() {
  const ind = document.getElementById('autoSaveIndicator');
  if (ind) { ind.textContent = '⏳ Guardando...'; ind.className = 'save-indicator pending'; }
  guardarEnServidor();
}

async function guardarEnServidor() {
  if (!currentGameId) return;
  const host = localStorage.getItem('currentUser');
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'guardarPuntajes', gameId: currentGameId, host, jugadores: estadoJugadores })
    });
    mostrarIndicador('✓ Sincronizado');
  } catch(e) {
    mostrarIndicador('⚠️ Sin conexión', true);
  }
}

function mostrarIndicador(texto, error = false) {
  const ind = document.getElementById('autoSaveIndicator');
  if (!ind) return;
  ind.textContent = texto;
  ind.className = 'save-indicator ' + (error ? 'error' : 'ok');
}

// ── REINICIAR ─────────────────────────────────────────────────
function reiniciarJuego() {
  if (confirm("¿Nueva partida? Esto borrará el estado actual.")) {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    currentGameId = null;
    estadoJugadores = [];
    localStorage.removeItem(KEY_STATE);
    document.getElementById('panelJuego').style.display = 'none';
    document.getElementById('panelSetup').style.display = 'block';
    document.getElementById('numJugadores').value = '';
    document.getElementById('inputJugadores').innerHTML = '';
    document.getElementById('jugadores').innerHTML = '';
    document.getElementById('ranking').innerHTML = '';
    document.getElementById('btnCrear').disabled = false;
    document.getElementById('btnCrear').textContent = '🚀 Crear Partida Online';
  }
}

// ── HELPERS ───────────────────────────────────────────────────
function showSetupMsg(text, type) {
  const el = document.getElementById('setupMsg');
  el.textContent = text;
  el.className = 'message-box ' + type;
  el.style.display = 'block';
}

// ── INIT ──────────────────────────────────────────────────────
window.onload = function() {
  if (!checkAuth()) return;
  mostrarUsuario();

  // Splash
  setTimeout(() => {
    const splash = document.getElementById("splash");
    if (splash) {
      splash.style.animation = "fadeOut 0.8s forwards";
      setTimeout(() => {
        splash.style.display = "none";
        document.getElementById("mainContent").style.display = "block";
      }, 800);
    }
  }, 2000);
};
