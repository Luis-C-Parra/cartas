// ============================================================
// TELEFUNKEN FAMILIAR - Apps Script Backend
// Hoja 1 = USUARIOS (Username | Password | Last_Login)
// Hoja 2 = JUEGO    (GameID | Host | Jugadores JSON | UltimaActualizacion)
// ============================================================

const SS = SpreadsheetApp.getActiveSpreadsheet();
const SHEET_USERS  = SS.getSheetByName("Hoja 1");
const SHEET_JUEGO  = SS.getSheetByName("JUEGO");

// ── Cabeceras iniciales de la hoja JUEGO (correr 1 vez si está vacía) ──
function initJuegoSheet() {
  if (SHEET_JUEGO.getLastRow() === 0) {
    SHEET_JUEGO.appendRow(["GameID", "Host", "Jugadores", "UltimaActualizacion"]);
  }
}

// ── Router principal ──────────────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === "login")       return respond(handleLogin(body));
    if (action === "crearPartida") return respond(handleCrearPartida(body));
    if (action === "guardarPuntajes") return respond(handleGuardarPuntajes(body));
    if (action === "getPartida")  return respond(handleGetPartida(body));

    return respond({ success: false, message: "Acción desconocida" });
  } catch (err) {
    return respond({ success: false, message: err.toString() });
  }
}

function doGet(e) {
  const gameId = e.parameter.gameId;
  if (gameId) return respond(handleGetPartida({ gameId }));
  return respond({ success: false, message: "Parámetro requerido: gameId" });
}

// ── LOGIN ─────────────────────────────────────────────────────
function handleLogin(body) {
  const { username, password } = body;
  const data = SHEET_USERS.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const u = String(data[i][0]).trim().toUpperCase();
    const p = String(data[i][1]).trim();
    if (u === username.trim().toUpperCase() && p === password.trim()) {
      // Actualizar Last_Login
      SHEET_USERS.getRange(i + 1, 3).setValue(new Date().toLocaleDateString("es-AR"));
      return { success: true, username: u };
    }
  }
  return { success: false, message: "Usuario o contraseña incorrectos" };
}

// ── CREAR PARTIDA ─────────────────────────────────────────────
function handleCrearPartida(body) {
  const { host, jugadores } = body;
  // jugadores = ["LUIS","EDDY","ALE"...]

  // Generar ID único de 6 chars
  const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();

  const ITEMS = ["TRICA","DOS TRICAS","TRES TRICAS","CUARTO","2 CUARTOS","QUINA","ESCALERA"];

  const estadoJugadores = jugadores.map(nombre => ({
    nombre: nombre.toUpperCase(),
    monedas: 7,
    valores: Array(ITEMS.length).fill(""),
    total: 0
  }));

  initJuegoSheet();

  // Buscar si ya existe una partida activa de este host y sobreescribir
  const data = SHEET_JUEGO.getDataRange().getValues();
  let filaExistente = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).toUpperCase() === host.toUpperCase()) {
      filaExistente = i + 1;
      break;
    }
  }

  const row = [gameId, host.toUpperCase(), JSON.stringify(estadoJugadores), new Date().toISOString()];

  if (filaExistente > 0) {
    SHEET_JUEGO.getRange(filaExistente, 1, 1, 4).setValues([row]);
  } else {
    SHEET_JUEGO.appendRow(row);
  }

  return { success: true, gameId, jugadores: estadoJugadores };
}

// ── GUARDAR PUNTAJES (solo host) ──────────────────────────────
function handleGuardarPuntajes(body) {
  const { gameId, host, jugadores } = body;

  const data = SHEET_JUEGO.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === gameId && String(data[i][1]).toUpperCase() === host.toUpperCase()) {
      SHEET_JUEGO.getRange(i + 1, 3).setValue(JSON.stringify(jugadores));
      SHEET_JUEGO.getRange(i + 1, 4).setValue(new Date().toISOString());
      return { success: true };
    }
  }
  return { success: false, message: "Partida no encontrada o no autorizado" };
}

// ── LEER ESTADO DE PARTIDA ─────────────────────────────────────
function handleGetPartida(body) {
  const { gameId } = body;
  const data = SHEET_JUEGO.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === gameId) {
      return {
        success: true,
        gameId: data[i][0],
        host: data[i][1],
        jugadores: JSON.parse(data[i][2]),
        updated: data[i][3]
      };
    }
  }
  return { success: false, message: "Partida no encontrada" };
}

// ── Helper ────────────────────────────────────────────────────
function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
