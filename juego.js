/* ═══════════════════════════════════════════════════════
   juego.js — Lógica ÚNICA de TELEFUNKEN FAMILIAR
   Sirve para mesa.html (host) y mesa-jugador.html (jugador)
   ═══════════════════════════════════════════════════════ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update, runTransaction, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const app = initializeApp({
  apiKey: "AIzaSyBB1aFN9BKd57g7zho-NGXzGGzAw7uSY4k",
  authDomain: "cartas-ef38a.firebaseapp.com", projectId: "cartas-ef38a",
  databaseURL: "https://cartas-ef38a-default-rtdb.firebaseio.com",
  storageBucket: "cartas-ef38a.firebasestorage.app", messagingSenderId: "836490610717",
  appId: "1:836490610717:web:35f4bdb473c7cfaeb25ef4"
});
const db = getDatabase(app);

/* ── CONSTANTES ── */
const PALOS = ['♠','♥','♦','♣'];
const VALORES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const ORDEN = {'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13};
const ORDEN_PALO = {'♠':0,'♥':1,'♦':2,'♣':3};
const RONDAS = [
  {nombre:'Ronda 1 · 1 Trica',tipo:'trica',cant:1,tam:3},
  {nombre:'Ronda 2 · 2 Tricas',tipo:'trica',cant:2,tam:3},
  {nombre:'Ronda 3 · 3 Tricas',tipo:'trica',cant:3,tam:3},
  {nombre:'Ronda 4 · 1 Cuarta',tipo:'cuarta',cant:1,tam:4},
  {nombre:'Ronda 5 · 2 Cuartas',tipo:'cuarta',cant:2,tam:4},
  {nombre:'Ronda 6 · Quina',tipo:'quina',cant:1,tam:5},
  {nombre:'Ronda 7 · Escalera',tipo:'escalera',cant:1,tam:7}];

/* ── MODO: ¿host o jugador? (según la URL) ── */
const params = new URLSearchParams(location.search);
const ES_JUGADOR = !!(params.get('game') && params.get('player'));
let gameId = ES_JUGADOR ? params.get('game') : null;
let miNombre = ES_JUGADOR ? (params.get('player')||'').trim().toUpperCase() : null;
let estadoLocal = null, selSet = new Set(), drag = null;

/* ── Utilidades DOM (si el elemento no existe, no hace nada) ── */
const $ = id => document.getElementById(id);
const txt = (id,v) => { const el=$(id); if(el) el.textContent=v; };
const htm = (id,v) => { const el=$(id); if(el) el.innerHTML=v; };

function nombreJugada(tipo,n){const base={trica:'trica',cuarta:'cuarta',quina:'quina',escalera:'escalera'}[tipo]||tipo;
 return `${n} ${base}${n===1?'':'s'}`;}

/* Nombre según tamaño de grupo (3=trica,4=cuarta,5=quina...) para bajadas libres post-apertura */
function nombreGrupoPorTam(tam){const map={3:'trica',4:'cuarta',5:'quina'};return map[tam]||`grupo de ${tam}`;}

/* Partición LIBRE por valor (para cuando ya se cumplió la apertura): agrupa las cartas
   seleccionadas por número, cada grupo debe tener 3+ cartas (usando jokers para completar
   si hace falta). No exige que coincida con el tamaño de la ronda actual: podés bajar una
   trica, una cuarta, una quina, o varias juntas, mientras cada grupo tenga 3+ cartas del
   mismo número (jokers valen por cualquiera). */
function particionarLibreValor(cartas){
 const jk=cartas.filter(c=>c.joker),re=cartas.filter(c=>!c.joker);
 if(!re.length)return null;
 const por={};re.forEach(c=>{(por[c.v]=por[c.v]||[]).push(c);});
 const grupos=Object.values(por).map(g=>[...g]);
 let jokersLeft=[...jk];
 for(const g of grupos){while(g.length<3&&jokersLeft.length)g.push(jokersLeft.pop());}
 if(grupos.some(g=>g.length<3))return null;
 if(jokersLeft.length){if(!grupos.length)return null;grupos[0].push(...jokersLeft);}
 return grupos;
}

function describirGruposLibres(grupos){
 const counts={};grupos.forEach(g=>{counts[g.length]=(counts[g.length]||0)+1;});
 return Object.entries(counts).map(([tam,n])=>`${n} ${nombreGrupoPorTam(+tam)}${n>1?'s':''}`).join(' + ');
}

/* Analiza lo que el jugador tiene marcado y devuelve un texto para el botón BAJAR */
function describirSeleccion(cartas,ronda,yaAbrio){
 if(!cartas.length)return '📥 BAJAR';
 if(!yaAbrio){
  /* Todavía debe la jugada de apertura completa */
  const req=ronda.cant * ronda.tam;
  if(cartas.length!==req)return `📥 BAJAR ${cartas.length}/${req} cartas (apertura: ${nombreJugada(ronda.tipo,ronda.cant)})`;
  let ok=false;
  if(ronda.tipo==='escalera')ok=grupoValido(cartas,ronda);
  else ok=!!particionarGrupos(cartas,ronda);
  return ok?`📥 BAJAR ${nombreJugada(ronda.tipo,ronda.cant)} (apertura)`:`📥 BAJAR ${cartas.length}/${req} (jugada inválida)`;
 }
 /* Ya abrió: puede bajar CUALQUIER combinación válida (trica, cuarta, quina... o una escalera de 3+),
    sin depender del tipo/tamaño de esta ronda */
 if(cartas.length>=3&&grupoValido(cartas,{tipo:'escalera',tam:cartas.length}))return `📥 BAJAR 1 escalera de ${cartas.length}`;
 const grupos=particionarLibreValor(cartas);
 return grupos?`📥 BAJAR ${describirGruposLibres(grupos)}`:`📥 BAJAR ${cartas.length} cartas (jugada inválida)`;
}

/* ═══════════ VALIDADORES ═══════════ */
function crearMazo(){let m=[];for(let b=0;b<2;b++){PALOS.forEach(p=>VALORES.forEach(v=>m.push({v,p,id:`${v}${p}${b}`})));
 m.push({v:'🃏',p:'',id:`JK${b}`,joker:true});m.push({v:'🃏',p:'',id:`JK${b}x`,joker:true});}
 for(let i=m.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[m[i],m[j]]=[m[j],m[i]];}return m;}

function barajar(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* Si el mazo se quedó sin cartas, rebaraja el pozo de cartas ya descartadas (NUNCA toca
   la carta visible de la mesa, que ahora vive en su propio campo `mesa`) y lo convierte
   en el nuevo mazo, para que robar/comprar pueda seguir funcionando. Se usa dentro de transacciones. */
function asegurarMazo(s){
 if((s.mazo?.length||0)>0)return;
 const pozo=[...(s.pozo||[])];
 if(!pozo.length)return; /* no hay nada para rebarajar */
 s.mazo=barajar(pozo);
 s.pozo=[];
}

/* Máximo de jokers permitidos según el largo de la escalera: 3 cartas → 1 joker,
   4 cartas → 2 jokers, 5 cartas en adelante → hasta 3 jokers. */
function maxJokersEscalera(tam){if(tam<=3)return 1;if(tam===4)return 2;return 3;}

/* Para un inicio de rango "s" dado, los jokers ocupan exactamente los valores que
   faltan entre s y s+tam-1 (los que no cubre ninguna carta real). Esta función
   verifica que esa cantidad no supere el máximo permitido y que nunca haya dos
   valores faltantes consecutivos (= dos jokers pegados uno al lado del otro). */
function jokersOkEnRango(s,tam,valoresReales,numJokers){
 if(numJokers>maxJokersEscalera(tam))return false;
 const faltan=[];for(let x=s;x<s+tam;x++)if(!valoresReales.includes(x))faltan.push(x);
 if(faltan.length!==numJokers)return false;
 for(let i=1;i<faltan.length;i++)if(faltan[i]===faltan[i-1]+1)return false;
 return true;}

// En juego.js, reemplazar la validación de escalera en grupoValido:
function grupoValido(cartas, r) {
  if (cartas.length !== r.tam) return false;
  const re = cartas.filter(c => !c.joker);
  if (!re.length) return false;
  
  if (r.tipo === 'escalera') {
    const p = re[0].p;
    if (!re.every(c => c.p === p)) return false;
    
    const v = re.map(c => ORDEN[c.v]).sort((a, b) => a - b);
    if (new Set(v).size !== v.length) return false;
    
    // Validar jokers
    const numJokers = cartas.length - re.length;
    const maxJokers = r.tam <= 3 ? 1 : r.tam <= 4 ? 2 : 3;
    if (numJokers > maxJokers) return false;
    
    // Verificar que no haya jokers consecutivos
    for (let s = Math.max(1, v[v.length - 1] - r.tam + 1); s <= Math.min(13 - r.tam + 1, v[0]); s++) {
      if (v.every(x => x >= s && x <= s + r.tam - 1)) {
        // Verificar adyacencia de jokers
        const posicionesJoker = [];
        for (let i = s; i < s + r.tam; i++) {
          if (!v.includes(i)) posicionesJoker.push(i);
        }
        let consecutivos = false;
        for (let i = 1; i < posicionesJoker.length; i++) {
          if (posicionesJoker[i] === posicionesJoker[i-1] + 1) {
            consecutivos = true;
            break;
          }
        }
        if (!consecutivos) return true;
      }
    }
    return false;
  }
  
  return re.every(c => c.v === re[0].v);
}

function particionarGrupos(cartas,r){
 const jk=cartas.filter(c=>c.joker),re=cartas.filter(c=>!c.joker),por={};
 re.forEach(c=>{(por[c.v]=por[c.v]||[]).push(c);});
 const grupos=[];
 for(const v in por)while(por[v].length>=r.tam)grupos.push(por[v].splice(0,r.tam));
 let j=[...jk];
 for(const v in por){if(!por[v].length)continue;const need=r.tam-por[v].length;
  if(need>j.length)return null;const g=[...por[v]];for(let i=0;i<need;i++)g.push(j.pop());grupos.push(g);}
 if(j.length)return null;
 if(grupos.length!==r.cant)return null;
 return grupos;}

function asignarVals(cartas){const tam=cartas.length,re=cartas.filter(c=>!c.joker);const v=re.map(c=>ORDEN[c.v]).sort((a,b)=>a-b);
 const numJokers=cartas.length-re.length;let s=null;
 for(let st=Math.max(1,v[v.length-1]-tam+1);st<=Math.min(13-tam+1,v[0]);st++)
  if(v.every(x=>x>=st&&x<=st+tam-1)&&jokersOkEnRango(st,tam,v,numJokers)){s=st;break;}
 const falt=[];for(let x=s;x<s+tam;x++)if(!v.includes(x))falt.push(x);let fi=0;
 /* Ordenado por valor ascendente: el array se guarda en el orden en que el jugador
    seleccionó las cartas en su mano, que no tiene por qué coincidir con el orden de la
    escalera. Sin este sort, una carta soplada después (que se inserta al principio o al
    final del array) puede terminar en la posición visual equivocada. */
 return cartas.map(c=>c.joker?{...c,val:falt[fi++]}:{...c,val:ORDEN[c.v]}).sort((a,b)=>a.val-b.val);}

function calcPts(m){const t={'A':15,'J':11,'Q':12,'K':13};
 return m.reduce((s,c)=>{if(c.joker)return s+20;const n=parseInt(c.v);return s+(isNaN(n)?(t[c.v]||0):n);},0);}

function getObjetivo(i){const r=RONDAS[i];
 if(r.tipo==='escalera')return '1 escalera de 7 cartas del mismo palo';
 if(r.tipo==='quina')return '1 quina (5 mismo número)';
 return `${r.cant} ${r.tipo}(s) de ${r.tam} cartas mismo número — ¡todas juntas!`;}

function tieneJugada(e,n){return (e.bajadas?.[n]||[]).length>=RONDAS[e.ronda].cant;}
function puedeCompra(e,n){return !!(e.compraHabilitada?.[n])&&(e.monedas?.[n]??0)>0;}
/* Sopar NUNCA cuesta monedas (sólo comprar de la mesa cuesta 🪙1). La habilitación es la
   misma bandera (ya abrió + le llegó el turno), pero sin exigir saldo de monedas. */
function puedeSopar(e,n){return !!(e.compraHabilitada?.[n]);}

/* Detecta si una jugada YA BAJADA es un grupo de valor (trica/cuarta/quina, mismo número)
   o una escalera (mismo palo, números consecutivos). No hay que asumirlo por el tipo de
   la ronda actual: después de la apertura se pueden bajar jugadas de cualquier tipo. */
function esGrupoValor(g){const re=g.filter(c=>!c.joker);
 if(!re.length)return true;
 return re.every(c=>c.v===re[0].v);}

function htmlCarta(c,g){const k=c.joker?'carta-joker':c.p==='♥'||c.p==='♦'?'carta-roja':'carta-negra';
 return `<div class="carta ${k} ${g?'carta-grande':''}"><div class="cv-top">${c.v}</div><div class="cp">${c.p}</div><div class="cv-bot">${c.v}</div></div>`;}

function opcionesSopar(e){const opts=[],mano=e.manos?.[miNombre]||[];
 e.jugadores.forEach(n=>{
  (e.bajadas?.[n]||[]).forEach((g,gi)=>{
   const jI=g.findIndex(c=>c.joker);
   if(!esGrupoValor(g)){
    const vals=g.map(c=>c.val),s=Math.min(...vals),top=Math.max(...vals);
    const palo=g.find(c=>!c.joker)?.p;
    /* 1) Cambiar/correr CUALQUIERA de los jokers de la escalera (cualquier jugador,
       inclusive vos mismo sobre tu propia jugada bajada — no hay motivo de juego para
       restringirlo a "otros jugadores" nada más, es tu carta y el joker sigue en juego).
       El joker NUNCA se saca del juego: al poner tu carta real en su lugar, el joker se
       desliza a un extremo y la escalera CRECE 1 carta. Se recorren TODOS los jokers del
       grupo (puede haber más de uno, ej. una escalera de 7 con 2 jokers) — antes sólo se
       consideraba el primero y el resto nunca generaba la opción. El cálculo del extremo
       usa el tamaño real del grupo (g.length), no un tamaño fijo de 7, así que funciona
       igual en escaleras de 3, 4, 5, 6 o 7 cartas. */
    {
     g.forEach((card,jIdx)=>{
      if(!card.joker)return;
      const X=card.val;
      const hi=mano.findIndex(c=>!c.joker&&c.p===palo&&ORDEN[c.v]===X);
      if(hi===-1)return;
      if(top+1<=13)opts.push({tipo:'escalera',jugador:n,gi,hi,jIdx,lado:'der',
       desc:`🧹 ${n}: poner tu ${VALORES[X-1]}${palo} y correr el 🃏 al ${VALORES[top]}`});
      if(s-1>=1)opts.push({tipo:'escalera',jugador:n,gi,hi,jIdx,lado:'izq',
       desc:`🧹 ${n}: poner tu ${VALORES[X-1]}${palo} y correr el 🃏 al ${VALORES[s-2]}`});
      /* 1b) PARTIR la escalera en dos grupos independientes, poniendo tu carta real
         en el lugar exacto del joker (no correrlo a una punta). Útil cuando el joker
         está en el MEDIO y no hay punta libre para correrlo (ej. una escalera ya
         completa de A a K), pero también sirve como alternativa aunque sí haya punta
         libre. Sólo se ofrece si el joker no está en un extremo (ahí "partir" no
         tendría sentido, sería un grupo vacío) y ambos pedazos resultantes quedan
         con 3 cartas o más (jugada mínima válida). */
      if(jIdx>0&&jIdx<g.length-1){
       const largoIzq=jIdx,largoDer=g.length-jIdx;
       if(largoIzq>=3&&largoDer>=3)
        opts.push({tipo:'escaleraPartir',jugador:n,gi,hi,jIdx,
         desc:`🧹 ${n}: poner tu ${VALORES[X-1]}${palo} en el hueco del 🃏 y partir la escalera en 2 (${largoIzq}+${largoDer})`});
      }
     });
    }
    /* 2) Sopar carta que estira la escalera (cualquier jugador, inclusive vos) */
    [s-1,top+1].forEach((v,side)=>{
     if(v<1||v>13)return;
     const lado=side===0?'izq':'der',donde=side===0?'inicio':'final';
     const hi=mano.findIndex(c=>!c.joker&&c.p===palo&&ORDEN[c.v]===v);
     if(hi!==-1)opts.push({tipo:'adjEsc',jugador:n,gi,hi,lado,val:v,
      desc:`🧹 ${n}: sopar tu ${VALORES[v-1]}${palo} al ${donde} de su escalera`});
     const hj=mano.findIndex(c=>c.joker);
     if(hj!==-1){
      /* Estirar con un joker propio: no se ofrece si el extremo de ese lado ya es un
         joker (quedarían dos jokers pegados) ni si se supera el máximo permitido para
         el nuevo largo de la escalera. */
      const bordeEsJoker=side===0?g[0]?.joker:g[g.length-1]?.joker;
      const jokersActuales=g.filter(c=>c.joker).length;
      const okNuevo=!bordeEsJoker&&(jokersActuales+1)<=maxJokersEscalera(g.length+1);
      if(okNuevo)opts.push({tipo:'adjEsc',jugador:n,gi,hi:hj,lado,val:v,
       desc:`🧹 ${n}: sopar tu 🃏 al ${donde} de su escalera (vale ${VALORES[v-1]})`});
     }
    });
   }else{
    const V=g.filter(c=>!c.joker)[0]?.v;
    /* 1) Cambiar el joker por tu carta (solo a otros jugadores) */
    if(n!==miNombre&&jI!==-1){
     const hi=mano.findIndex(c=>!c.joker&&c.v===V);
     if(hi!==-1)opts.push({tipo:'grupo',jugador:n,gi,hi,
      desc:`🧹 ${n}: cambiar su 🃏 por tu ${V} (te llevás el joker)`});
    }
    /* 2) Sopar carta igual a la jugada (cualquier jugador, inclusive vos) */
    const hi=mano.findIndex(c=>!c.joker&&c.v===V);
    if(hi!==-1)opts.push({tipo:'adj',jugador:n,gi,hi,
     desc:`🧹 ${n}: sopar tu ${V} a su jugada (te deshacés del ${V})`});
    /* 3) Sopar un joker a la jugada */
    const hj=mano.findIndex(c=>c.joker);
    if(hj!==-1)opts.push({tipo:'adj',jugador:n,gi,hi:hj,
     desc:`🧹 ${n}: sopar tu 🃏 a su jugada de ${V}`});
   }
  });});
 return opts;}

/* ═══════════ TEMA CLARO / CASINO ═══════════ */
(function(){const t=$('themeToggle');if(!t)return;
 if(localStorage.getItem('theme')==='casino'){document.body.classList.add('casino-mode');t.textContent='☀️';}
 t.addEventListener('click',()=>{document.body.classList.toggle('casino-mode');
  const c=document.body.classList.contains('casino-mode');
  t.textContent=c?'☀️':'🌙';localStorage.setItem('theme',c?'casino':'soft');});})();

/* ═══════════ SPLASH ═══════════ */
setTimeout(()=>{const s=$('splash');
 if(s){s.style.animation='fadeOut 0.8s forwards';setTimeout(()=>{
   s.style.display='none';
   const mc=document.getElementById('mainContent');
   if(mc)mc.style.display='block';
   if(ES_JUGADOR){const lc=document.getElementById('loadingScreen');if(lc&&!estadoLocal)lc.style.display='flex';}
  },800);}},1800);

/* ═══════════ INICIO ═══════════ */
if (ES_JUGADOR) initJugador(); else initHost();

function initJugador(){
  txt('miNombreDisplay','👤 '+miNombre);
  if(!gameId||!miNombre){const lc=$('loadingScreen');if(lc)lc.style.display='none';
   const er=$('errorScreen');if(er)er.style.display='flex';return;}
  escuchar(gameId);
}

function initHost(){
  if(localStorage.getItem('isLoggedIn')!=='true'){location.href='login.html';return;}
  miNombre=(localStorage.getItem('currentUser')||'').toUpperCase();
  txt('usuarioDisplay','👤 '+miNombre);
  const g=localStorage.getItem('gameId');
  if(g){gameId=g;escuchar(g);
   const ps=$('panelSetup');if(ps)ps.style.display='none';
   const pm=$('panelMesa');if(pm)pm.style.display='block';}
  else{
   const ps=$('panelSetup');if(ps)ps.style.display='block';
  }
}

window.logout=()=>{if(confirm('¿Salir?')){localStorage.clear();location.href='login.html';}};

function escuchar(g){
  onValue(ref(db,`partidas/${g}`),snap=>{
    const lc=$('loadingScreen');if(lc)lc.style.display='none';
    if(!snap.exists()){const er=$('errorScreen');if(er)er.style.display='flex';return;}
    estadoLocal=snap.val();
    const mc=$('mainContent');if(mc)mc.style.display='block';
    renderMesa(estadoLocal);
  });
}

/* ═══════════ RENDER ÚNICO ═══════════ */
function renderMesa(e){
  if(!e)return;
  [...selSet].forEach(i=>{if(i>=(e.manos?.[miNombre]||[]).length)selSet.delete(i);});
  const ronda=RONDAS[e.ronda]||RONDAS[0];
  txt('rondaNombre',ronda.nombre);txt('rondaDisplay',ronda.nombre);txt('rondaBadge',ronda.nombre);
  txt('objRonda',getObjetivo(e.ronda));
  txt('mazoCantidad',e.mazo?.length||0);txt('mazoCant',e.mazo?.length||0);
  const jug=e.jugadores[e.turnoIdx],mio=jug===miNombre;
htm('turnoActual',`Turno: <strong>${jug}</strong>${mio?' <span class="mi-turno-tag">← vos</span>':''}`);

// Banner GRANDE de turno (muy visible)
if(mio){
  htm('turnoBar',`
    <div class="mi-turno-banner-grande">
      <div class="turno-icono">🎯</div>
      <div class="turno-texto">¡ES TU TURNO!</div>
      <div class="turno-subtexto">Te toca jugar</div>
    </div>
  `);
} else {
  htm('turnoBar',`<div class="esperando-banner">⏳ Turno de <strong>${jug}</strong></div>`);
}
  const ptsHtml=e.jugadores.map(n=>`<div class="wapp-row">
   <span class="wapp-n ${n===miNombre?'yo':''}">${n===miNombre?'👤 ':''}${n}</span>
   <span class="pts-valor">${e.puntajes?.[n]||0} pts</span></div>`).join('');
  htm('puntajesList',ptsHtml);
   const esHost = (miNombre === e.host);
const estHtml=e.jugadores.map(n=>{
  const hab=e.compraHabilitada?.[n];
  const apressado = e.apressado?.[n];
  const hacePoco = apressado && (Date.now() - apressado < 5000);
  const expulsado = e.expulsados?.[n];
  
  // Botón de apurar: cualquiera puede apurar a cualquier otro
  let botonApurar = '';
  if(n !== miNombre && !expulsado){
    botonApurar = `<button onclick="apressarJugador('${n}')" class="btn-apurar" title="Apurar a ${n}">⏰</button>`;
  }
  
  // Botones de host (solo el host los ve)
  let botonesHost = '';
  if(esHost && n !== miNombre && !expulsado){
    botonesHost = `<button onclick="expulsarJugador('${n}')" class="btn-host-expulsar" title="Expulsar a ${n} de la partida">🚫 Expulsar</button>`;
    if(n === jug){
      botonesHost += `<button onclick="saltearTurno()" class="btn-host-saltear" title="Saltear turno">⏭️</button>`;
    }
  }
  
  return `<div class="jug-estado ${n===jug?'jug-activo':''} ${expulsado?'jug-expulsado':''} ${hacePoco&&n===miNombre?'jug-apressado':''}">
    <span class="jug-n">${n===miNombre?'👤 ':''}${n}${expulsado?' (expulsado)':''}</span>
    <span class="jug-c">🃏${e.manos?.[n]?.length||0}</span>
    <span class="monedas-tag">🪙${e.monedas?.[n]??7}</span>
    ${tieneJugada(e,n)?`<span class="tapó-tag">📥${hab?'✓':'⏳'}</span>`:''}
    ${botonApurar}
    ${botonesHost}
    ${hacePoco && n===miNombre ? '<div class="banner-apuro">⏰ ¡TE ESTÁN APURANDO!</div>' : ''}
  </div>`;
}).join('');
  htm('estadoJugadores', estHtml);
  htm('estadoJugs', estHtml);
  const ds=$('cartaDescarte')||$('cartaMesa');
  if(ds){
    if(e.mesa){ds.innerHTML=htmlCarta(e.mesa,true);
     ds.onclick=comprarMesa;ds.style.cursor='pointer';
     txt('descarteSub','💰 Tocá la carta de la mesa para COMPRAR (🪙1)');
    }else{ds.innerHTML='<span class="descarte-vacio">—</span>';ds.onclick=null;
     txt('descarteSub','Mesa vacía');}
  }
  let hb='';
  e.jugadores.forEach(n=>{const gs=e.bajadas?.[n]||[];if(!gs.length)return;
   hb+=`<div class="bajada-fila"><span class="bajada-nombre">${n===miNombre?'👤 ':''}${n}</span>`;
   gs.forEach(g=>{
    const esEsc=!esGrupoValor(g);
    const paloEsc=esEsc?(g.find(c=>!c.joker)?.p||''):'';
    const valorGrupo=!esEsc?(g.find(c=>!c.joker)?.v||''):'';
    hb+=`<div class="bajada-grupo">`+g.map(c=>{
     /* Indicativo de qué carta representa el joker: en una escalera es su valor+palo
        (ej. 10♠), en una trica/cuarta es el número del grupo. Sin esto no había forma de
        saber, mirando la mesa, qué posición ocupaba cada joker. */
     const repr=c.joker?(esEsc?`${VALORES[c.val-1]}${paloEsc}`:valorGrupo):'';
     return `<div class="carta carta-mini ${c.joker?'carta-joker':c.p==='♥'||c.p==='♦'?'carta-roja':'carta-negra'}">
      <div class="cv-top">${c.v}</div><div class="cp">${c.p}</div>
      ${c.joker?`<div class="cv-bot" style="font-size:.6em;opacity:.85;">${repr}</div>`:''}
     </div>`;
    }).join('')+`</div>`;});
   hb+=`</div>`;});
  htm('jugadasMesa',hb||'<div class="descarte-sub">Nadie bajó jugadas todavía</div>');
  const mano=e.manos?.[miNombre]||[];
  txt('contadorMano',`(${mano.length} cartas)`);txt('cntMano',`(${mano.length})`);
  pintaMano(mano,-1);
  const ok=tieneJugada(e,miNombre);
  const rob=$('btnRobar');if(rob)rob.style.opacity=mio&&e.robos===0?'1':'0.5';
  const bb=$('btnBajar');if(bb){bb.disabled=!mio||selSet.size===0;
   const cartasSel=[...selSet].sort((a,b)=>a-b).map(i=>mano[i]);
   bb.textContent=describirSeleccion(cartasSel,ronda,ok);}
  const bs=$('btnSopar');if(bs)bs.disabled=!mio||!puedeSopar(e,miNombre);
  const bt=$('btnTirar');if(bt)bt.disabled=!mio||selSet.size!==1||e.robos===0||mano.length<=1;
  /* TAPAR sólo cuando: es tu turno, ya abriste, tenés 1 carta seleccionada Y esa es tu
     ÚNICA carta en mano (tapar = quedarte sin cartas). Si tenés más de 1 carta en mano,
     no podés tapar todavía aunque hayas marcado una. */
  /* TAPAR: sólo hace falta que sea tu turno, que ya hayas abierto la ronda y que tengas
     exactamente 1 carta en la mano. NO hace falta que además la hayas "seleccionado" a
     mano — es la única carta posible, obligar a tocarla antes producía un botón que
     parecía no responder (deshabilitado en silencio, sin error). */
  const btp=$('btnTapa');if(btp)btp.disabled=!mio||!ok||mano.length!==1;
  const sp=$('soparPanel');if(sp)sp.style.display='none';
  /* Modal fin de ronda */
  renderModalRonda(e);
}

function renderModalRonda(e){
  let modal=$('modalRonda');
  if(e.fase==='esperando_aceptacion'&&e.resumenRonda){
   const r=e.resumenRonda;
   if(!modal){
    modal=document.createElement('div');
    modal.id='modalRonda';modal.className='modal-ronda';
    document.body.appendChild(modal);}
   modal.style.display='flex';
   const yoAcepte=r.aceptaron?.[miNombre];
   const cuantos=Object.keys(r.aceptaron||{}).length;
   const total=e.jugadores.length;
   let html=`<div class="modal-ronda-card">`;
   if(r.fin){
    const g=r.ganador;
    html+=`<div class="modal-ronda-titulo fin">🏆 FIN DEL JUEGO 🏆</div>
     <div class="modal-ganador">👑 ${g} GANÓ LA PARTIDA</div>`;
   }else{
    html+=`<div class="modal-ronda-titulo">🟢 ${r.tapador} TAPÓ con ${r.cartaTapa}</div>
     <div class="modal-ronda-sub">Siguiente: <strong>${r.siguiente}</strong> · Empieza: <strong>${r.empiezaProx}</strong></div>`;
   }
   html+=`<div class="modal-ronda-tabla">`;
   e.jugadores.sort((a,b)=>(r.puntajesAcum[a]||0)-(r.puntajesAcum[b]||0)).forEach((n,i)=>{
    const medallas=['🥇','🥈','🥉'];
    const cartas=r.cartasRestantes?.[n]||[];
    const cartasHtml=cartas.length
     ?cartas.map(ct=>`<span class="carta-mini-tag ${ct.joker?'joker-tag':ct.p==='♥'||ct.p==='♦'?'roja-tag':'negra-tag'}">${ct.v}${ct.p}</span>`).join('')
     :'<span class="sin-cartas">✓ Sin cartas</span>';
    html+=`<div class="modal-fila ${n===miNombre?'modal-fila-yo':''}">
     <span class="modal-pos">${medallas[i]||i+1+'°'}</span>
     <span class="modal-nombre">${n}</span>
     <div class="modal-cartas">${cartasHtml}</div>
     <div class="modal-pts">
      <span class="pts-ronda">+${r.ptRonda[n]||0}</span>
      <span class="pts-total">${r.puntajesAcum[n]||0} pts</span>
     </div>
    </div>`;
   });
   html+=`</div>`;
   if(!yoAcepte){
    html+=`<button class="btn-aceptar-ronda" onclick="aceptarRonda()">
     ${r.fin?'🏆 Ver resultado final':`▶ Listo para ${r.siguiente}`}</button>`;
   }else{
    html+=`<div class="esperando-txt">✓ Listo · Esperando: ${total-cuantos} jugador(es)...</div>`;
   }
   html+=`</div>`;
   modal.innerHTML=html;
  }else{
   if(modal)modal.style.display='none';
  }
}

/* ═══════════ ARRASTRAR / SELECCIONAR ═══════════ */
function pintaMano(arr,dragIdx){
  const el=$('miMano');if(!el)return;
  el.innerHTML=arr.map((c,i)=>{
   const sel=selSet.has(i)||i===dragIdx;
   const arrastrando=drag&&drag.moved&&i===dragIdx;
   const palo=c.joker?'carta-joker':c.p==='♥'||c.p==='♦'?'carta-roja':'carta-negra';
   return `<div class="carta ${palo} ${sel?'carta-sel':''} ${arrastrando?'carta-arrastrando':''}" onpointerdown="iniciarDrag(event,${i})">
    <div class="cv-top">${c.v}</div><div class="cp">${c.p}</div><div class="cv-bot">${c.v}</div></div>`;
  }).join('');}

window.iniciarDrag=function(ev,i){
  if(ev.button)return;
  drag={start:i,from:i,over:i,sx:ev.clientX,sy:ev.clientY,moved:false,arr:[...(estadoLocal?.manos?.[miNombre]||[])]};};

document.addEventListener('pointermove',ev=>{
  if(!drag)return;
  const dx=ev.clientX-drag.sx,dy=ev.clientY-drag.sy;
  if(!drag.moved&&(Math.abs(dx)>8||Math.abs(dy)>8))drag.moved=true;
  if(!drag.moved)return;
  ev.preventDefault();
  const els=[...document.querySelectorAll('#miMano .carta')];
  let over=drag.over;
  if(els.length){
   /* Antes: se quedaba con el ÚLTIMO elemento cuyo rectángulo (con margen extra)
      contuviera el puntero. Como las cartas de la mano se solapan visualmente para
      entrar todas en pantalla, varios rectángulos coinciden ahí al mismo tiempo, y
      siempre terminaba ganando el último recorrido (el de más a la derecha) — por
      eso una carta soltada cerca de su lugar terminaba yéndose al final de la mano.
      Ahora se elige la carta cuyo CENTRO horizontal está más cerca del puntero, que
      es robusto aunque las cartas se solapen entre sí. */
   let mejorIdx=drag.over,mejorDist=Infinity;
   els.forEach((el,idx)=>{
    const r=el.getBoundingClientRect();
    if(ev.clientY<r.top-26||ev.clientY>r.bottom+26)return;
    const cx=r.left+r.width/2,d=Math.abs(ev.clientX-cx);
    if(d<mejorDist){mejorDist=d;mejorIdx=idx;}
   });
   over=mejorIdx;
  }
  if(over!==drag.over){drag.over=over;
   const it=drag.arr.splice(drag.from,1)[0];drag.arr.splice(over,0,it);drag.from=over;
   pintaMano(drag.arr,over);}
},{passive:false});

document.addEventListener('pointerup',async()=>{
  if(!drag)return;const d=drag;drag=null;
  if(d.moved&&d.from!==d.start){
    const nuevo=d.arr;
    await runTransaction(ref(db,`partidas/${gameId}`),s=>{
     if(!s?.manos?.[miNombre])return;
     if(s.manos[miNombre].length!==nuevo.length)return;
     s.manos[miNombre]=nuevo;return s;});
    selSet.clear();log('✋ Acomodaste tus cartas');
  }else{
    selSet.has(d.start)?selSet.delete(d.start):selSet.add(d.start);
  }
  renderMesa(estadoLocal);});
document.addEventListener('pointercancel',()=>{drag=null;renderMesa(estadoLocal);});

window.ordenarMano=async function(){if(!estadoLocal)return;
 await runTransaction(ref(db,`partidas/${gameId}`),s=>{if(!s?.manos?.[miNombre])return;
  s.manos[miNombre].sort((a,b)=>{
   if(a.joker&&!b.joker)return 1;if(!a.joker&&b.joker)return -1;if(a.joker&&b.joker)return 0;
   if(ORDEN_PALO[a.p]!==ORDEN_PALO[b.p])return ORDEN_PALO[a.p]-ORDEN_PALO[b.p];
   return ORDEN[a.v]-ORDEN[b.v];});return s;});
 selSet.clear();log('🔃 Ordenaste tu mano');};

/* ═══════════ ACCIONES ═══════════ */
window.robarDelMazo=async function(){if(!estadoLocal)return;const e=estadoLocal;
 if(e.jugadores[e.turnoIdx]!==miNombre)return log('No es tu turno');
 if(e.robos>0)return log('Ya robaste. Tirá una carta.');
 const r=await runTransaction(ref(db,`partidas/${gameId}`),s=>{
  if(!s)return;
  // Dentro de runTransaction de robarDelMazo, después de if(!s)return;
if (s.expulsados?.[miNombre]) return; // jugador expulsado no puede jugar
  if(s.jugadores[s.turnoIdx]!==miNombre)return;
  if(s.robos>0)return;
  asegurarMazo(s); /* si no hay cartas, rebaraja el pozo de descarte y sigue */
  if(!s.mazo?.length)return; /* ni mazo ni pozo para rebarajar: no hay más cartas */
  const mazo=[...s.mazo],c=mazo.pop();
  s.mazo=mazo;
  s.manos[miNombre]=[...(s.manos[miNombre]||[]),c];
  s.robos=1;
  return s;});
 if(r.committed)log(`📦 ${miNombre} robó del mazo`);
 else log('❌ No quedan cartas para robar');};

window.comprarMesa=async function(){if(!estadoLocal)return;const e=estadoLocal;
 /* La compra está habilitada desde el primer momento (apenas se destapa la carta inicial),
    sin importar si ya bajaste tu jugada o no. Solo hace falta tener monedas y que haya
    una carta visible en la mesa. Además, solo se puede comprar LA carta recién tirada:
    una vez comprada, la mesa queda vacía hasta que alguien vuelva a tirar (no se "destapan"
    cartas viejas de más abajo). */
 if((e.monedas?.[miNombre]??0)<=0)return alert('❌ No te quedan monedas.');
 if(!e.mesa)return;
 const tirada=e.mesa;
 const r=await runTransaction(ref(db,`partidas/${gameId}`),s=>{
  if(!s||!s.mesa)return;
  if((s.monedas?.[miNombre]??0)<=0)return;
  asegurarMazo(s); /* si el mazo está vacío, rebaraja el pozo de descartes viejos y sigue */
  if(!s.mazo?.length)return; /* no hay carta de acompañamiento para completar la compra */
  const c=s.mesa,x=s.mazo[s.mazo.length-1];
  s.mazo=s.mazo.slice(0,-1);
  s.mesa=null; /* la mesa queda vacía: nadie más puede comprar hasta la próxima tirada */
  s.manos[miNombre]=[...(s.manos[miNombre]||[]),c,x];
  s.monedas[miNombre]=(s.monedas[miNombre]??7)-1;
  /* La compra NO reemplaza el robo del turno: la carta extra es por la compra, no por
     el turno. Si te toca jugar, igual tenés que robar (o comprar de nuevo) antes de tirar. */
  return s;});
 if(r.committed)log(`💰 ${miNombre} compró ${tirada?.v||''}${tirada?.p||''} de la mesa + 1 del mazo (🪙-1)`);
 else log('❌ No se pudo completar la compra en este momento.');};

window.tirarCarta=async function(){if(!estadoLocal||selSet.size!==1)return;const e=estadoLocal;
 if(e.jugadores[e.turnoIdx]!==miNombre)return log('No es tu turno');
 
 // Al inicio de tirarCarta, después de verificar turno
if (e.expulsados?.[miNombre]) return log('Estás expulsado, no podés jugar.');

 if(e.robos===0)return log('Primero robá del mazo o comprá');
 const manoActual=e.manos?.[miNombre]||[];
 if(manoActual.length<=1){
  alert('❌ No podés tirar tu última carta a la mesa.\n\nSi es tu única carta, usá el botón 🟢 TAPA para cerrar la ronda con ella.');
  return;}
 const idx=[...selSet][0],manos=JSON.parse(JSON.stringify(e.manos)),mm=[...(manos[miNombre]||[])];
 const [c]=mm.splice(idx,1);manos[miNombre]=mm;
 /* Si había una carta en la mesa que nadie compró, se entierra en el pozo (para rebarajar
    más adelante); la carta que se tira ahora pasa a ser la ÚNICA comprable. */
 const pozo=[...(e.pozo||[])];
 if(e.mesa)pozo.push(e.mesa);
 const mesa=c,next=(e.turnoIdx+1)%e.jugadores.length;
 const compraH={...(e.compraHabilitada||{})},nxt=e.jugadores[next];
 compraH[nxt]=(e.bajadas?.[nxt]||[]).length>=RONDAS[e.ronda].cant;
 selSet.clear();
 await update(ref(db,`partidas/${gameId}`),{manos,mesa,pozo,turnoIdx:next,robos:0,compraHabilitada:compraH});
 log(`↩ ${miNombre} tiró ${c.v}${c.p}`);};

window.bajarJugada=async function(){if(!estadoLocal||selSet.size===0)return;const e=estadoLocal;
 if(e.jugadores[e.turnoIdx]!==miNombre)return log('No es tu turno');
 const ronda=RONDAS[e.ronda],mano=e.manos?.[miNombre]||[];
 const cartas=[...selSet].sort((a,b)=>a-b).map(i=>mano[i]);
  if(mano.length-cartas.length<1){
  alert('❌ Siempre te tenés que quedar con al menos 1 carta en la mano.\n\nEsa carta final es la que usás para TAPAR la mesa al cerrar la ronda.');
  return;}
 const yaAbrio=tieneJugada(e,miNombre); /* ¿ya bajó la jugada obligatoria de apertura de la ronda? */
 let grupos=null;
 if(!yaAbrio){
  /* Jugada de apertura: HAY que bajar exactamente lo que pide la ronda, todo junto */
  if(ronda.tipo==='escalera'){if(cartas.length===ronda.tam&&grupoValido(cartas,ronda))grupos=[asignarVals(cartas)];}
  else grupos=particionarGrupos(cartas,ronda);
  if(!grupos){
   alert(`❌ Todavía no bajaste la jugada obligatoria de apertura de esta ronda.\n\n📌 Ronda actual: ${ronda.nombre}\nTenés que bajar EXACTAMENTE ${ronda.cant} jugada(s) de ${ronda.tam} cartas = ${ronda.cant*ronda.tam} cartas, TODAS JUNTAS de una vez.\n\n🃏 El joker vale por cualquier carta.\n✋ Cartas que marcaste: ${cartas.length}\n\nRecién después de bajar esta jugada obligatoria vas a poder bajar jugadas sueltas, comprar y sopar.`);
   return;}
 }else{
  /* Ya cumplió la apertura: puede bajar CUALQUIER combinación válida (trica, cuarta, quina...,
     o una escalera de 3 o más del mismo palo), sin depender del tipo/tamaño de esta ronda */
  if(cartas.length>=3&&grupoValido(cartas,{tipo:'escalera',tam:cartas.length})){
   grupos=[asignarVals(cartas)];
  }else{
   grupos=particionarLibreValor(cartas);
  }
  if(!grupos){
   alert(`❌ La selección no forma jugada(s) válida(s).\n\n📌 Ya cumpliste la apertura de esta ronda, así que ahora podés bajar cualquier combinación válida: grupos de 3 o más cartas del mismo número (trica, cuarta, quina...) o una escalera de 3 o más del mismo palo. El joker completa cualquier grupo.\n\n✋ Cartas que marcaste: ${cartas.length}`);
   return;}
 }
 grupos=grupos.map(g=>g.map(c=>({...c,dueno:miNombre})));
 const ids=new Set(cartas.map(c=>c.id)),manos=JSON.parse(JSON.stringify(e.manos));
 manos[miNombre]=mano.filter(c=>!ids.has(c.id));
 const bajadas=JSON.parse(JSON.stringify(e.bajadas||{}));
 bajadas[miNombre]=[...(bajadas[miNombre]||[]),...grupos];
 const compraH={...(e.compraHabilitada||{}),[miNombre]:false};
 selSet.clear();
 await update(ref(db,`partidas/${gameId}`),{manos,bajadas,compraHabilitada:compraH});
 log(`📥 ${miNombre} bajó la jugada completa`);};

window.abrirSopar=function(){if(!estadoLocal||!estadoLocal.compraHabilitada?.[miNombre])
  return alert('❌ Recién podés sopar desde tu siguiente turno después de bajar la jugada.');
 const opts=opcionesSopar(estadoLocal);
 if(!opts.length)return alert('No hay jokers para sopar con tus cartas.');
 window._soparOpts=opts;
 htm('soparOpts',opts.map((o,i)=>`<button class="sopar-btn" onclick="ejecutarSopar(${i})">${o.desc}</button>`).join(''));
 const sp=$('soparPanel');if(sp)sp.style.display='block';};

window.ejecutarSopar=async function(i){
  const o=window._soparOpts?.[i];
  if(!o)return;
  
  const res = await runTransaction(ref(db,`partidas/${gameId}`),s=>{
    if(!s)return;
    const g=s.bajadas?.[o.jugador]?.[o.gi];
    if(!g)return;
    const mm=s.manos[miNombre],mia=mm?.[o.hi];
    if(!mia)return;
    
    if(o.tipo==='grupo'){
      const jI=g.findIndex(c=>c.joker);
      if(jI===-1)return;
      const jk=g[jI];
      g[jI]={...mia,dueno:miNombre};
      mm.splice(o.hi,1);
      mm.push({...jk});
    }
    else if(o.tipo==='escalera'){
      const jIdx=o.jIdx,jk=g[jIdx];
      if(jk==null||!jk.joker)return;
      const vals=g.map(c=>c.val),s0=Math.min(...vals),top0=Math.max(...vals);
      const nv=o.lado==='der'?top0+1:s0-1;
      if(nv<1||nv>13)return;
      g[jIdx]={...mia,dueno:miNombre,val:jk.val};
      const jokerCorrido={...jk,val:nv};
      if(o.lado==='der')g.push(jokerCorrido);
      else g.unshift(jokerCorrido);
      g.sort((a,b)=>a.val-b.val);
      mm.splice(o.hi,1);
    }
    else if(o.tipo==='adj'){
      g.push({...mia,dueno:miNombre});
      mm.splice(o.hi,1);
    }
    else if(o.tipo==='adjEsc'){
      const nueva={...mia,dueno:miNombre,val:o.val};
      if(o.lado==='izq')g.unshift(nueva);
      else g.push(nueva);
      g.sort((a,b)=>a.val-b.val);
      mm.splice(o.hi,1);
    }
    else if(o.tipo==='escaleraPartir'){
      const jIdx=o.jIdx,jk=g[jIdx];
      if(jk==null||!jk.joker)return;
      const paloEsc=g.find(c=>!c.joker)?.p;
      if(!mia.joker&&(mia.p!==paloEsc||ORDEN[mia.v]!==jk.val))return;
      const grupoIzq=g.slice(0,jIdx);
      const grupoDer=[{...mia,dueno:miNombre,val:jk.val},...g.slice(jIdx+1)];
      if(grupoIzq.length<3||grupoDer.length<3)return;
      s.bajadas[o.jugador].splice(o.gi,1,grupoIzq,grupoDer);
      mm.splice(o.hi,1);
    }
    return s;
  });
  
  if(res.committed){
    log(`🧹 ${miNombre} sopó a ${o.jugador}`);
    
    // ✅ Usar el snapshot FRESCO del servidor (no el estadoLocal cacheado)
    const estadoFresco = res.snapshot.val();
    const nuevasOpts = opcionesSopar(estadoFresco);
    
    if(!nuevasOpts.length){
      const sp=$('soparPanel');
      if(sp)sp.style.display='none';
      window._soparOpts=[];
      return;
    }
    
    window._soparOpts=nuevasOpts;
    htm('soparOpts',nuevasOpts.map((opt,idx)=>
      `<button class="sopar-btn" onclick="ejecutarSopar(${idx})">${opt.desc}</button>`
    ).join(''));
  }
};


window.tapar=async function(){if(!estadoLocal)return;const e=estadoLocal;
 if(e.jugadores[e.turnoIdx]!==miNombre)return log('No es tu turno');
 if(!tieneJugada(e,miNombre))return alert('❌ Para TAPAR primero bajá la jugada completa de la ronda.');
 const manoAntes=e.manos?.[miNombre]||[];
 if(manoAntes.length!==1)return alert('❌ Para TAPAR tenés que llegar con UNA sola carta en la mano (la última). Bajá o tirá el resto antes de tapar.');
 /* Con 1 sola carta en la mano no hay nada para "elegir": es esa carta sí o sí, así que
    no dependemos de que el jugador la haya tocado antes para seleccionarla. */
 const idx=0;
 try{
  /* Transacción atómica: recalcula TODO (ronda, fin, ganador, puntajes) contra el estado
     autoritativo de la base en el momento del commit, nunca contra el estado local
     potencialmente desactualizado del cliente. Además re-valida server-side que la mano
     tenga exactamente 1 carta, para que dos taps simultáneos no corrompan la partida. */
  const res=await runTransaction(ref(db,`partidas/${gameId}`),s=>{
   /* IMPORTANTE: acá hay que devolver undefined (return; sin valor) para abortar la
      transacción cuando algo no está bien. Devolver "s" sin modificar NO aborta nada en
      Firebase: la transacción se considera igualmente "committed" (sin escritura real),
      así que el código de más abajo terminaba festejando un tapado que nunca ocurrió. */
   if(!s||s.fase!=='jugando')return;
   if(s.jugadores[s.turnoIdx]!==miNombre)return;
   if(!tieneJugada(s,miNombre))return;
   const mmActual=s.manos?.[miNombre]||[];
   if(mmActual.length!==1)return; /* sólo se puede tapar con la ÚLTIMA carta */
   const manos=JSON.parse(JSON.stringify(s.manos)),mm=[...(manos[miNombre]||[])];
   const [c]=mm.splice(idx,1);
   if(!c)return;
   manos[miNombre]=mm; /* queda vacía: tapaste con tu última carta */
   const pts={};
   s.jugadores.forEach(n=>pts[n]=calcPts(manos[n]||[]));
   const puntajes={...(s.puntajes||{})};
   s.jugadores.forEach(n=>puntajes[n]=(puntajes[n]||0)+pts[n]);
   const nr=s.ronda+1,fin=nr>=RONDAS.length;
   /* El que TAPA (gana) la ronda es quien arranca la próxima — no simplemente "el
      siguiente en orden de turno". */
   const idxTapador=s.jugadores.indexOf(miNombre);
   const ns=fin?s.starterIdx:(idxTapador>=0?idxTapador:s.starterIdx);
   s.manos=manos;
   s.puntajes=puntajes;
   s.fase='esperando_aceptacion';
   s.resumenRonda={
    tapador:miNombre,
    cartaTapa:`${c.v}${c.p}`,
    ptRonda:pts,
    puntajesAcum:puntajes,
    cartasRestantes:manos,
    rondaNum:s.ronda,
    fin,
    ganador:fin?s.jugadores.reduce((a,b)=>puntajes[a]<puntajes[b]?a:b):null,
    siguiente:fin?null:RONDAS[nr].nombre,
    empiezaProx:fin?null:miNombre,
    aceptaron:{}
   };
   return s;
  });
  selSet.clear();
  if(res.committed){
   const c=res.snapshot.val()?.resumenRonda?.cartaTapa||'';
   log(`🟢 ${miNombre} TAPÓ con ${c}`);
  }else{
   /* La transacción abortó: leemos el estado FRESCO del servidor (no el cacheado en el
      cliente) para decir EXACTAMENTE cuál condición falló, en vez del mensaje genérico
      de antes que no permitía saber si era el turno, la apertura o la mano. */
   let motivo='Motivo desconocido — mirá la consola del navegador.';
   try{
    const snap=await get(ref(db,`partidas/${gameId}`));
    const s=snap.val();
    if(!s)motivo='La partida no existe en el servidor.';
    else if(s.fase!=='jugando')motivo=`La partida no está en fase "jugando" (está en "${s.fase}").`;
    else if(s.jugadores[s.turnoIdx]!==miNombre)motivo=`El servidor dice que el turno es de ${s.jugadores[s.turnoIdx]}, no tuyo. Puede que falte refrescar la pantalla.`;
    else if(!tieneJugada(s,miNombre))motivo='El servidor dice que todavía no bajaste la jugada obligatoria de apertura de esta ronda.';
    else if((s.manos?.[miNombre]||[]).length!==1)motivo=`El servidor dice que tenés ${(s.manos?.[miNombre]||[]).length} cartas en mano, no 1.`;
   }catch(e2){console.error('diagnóstico tapar error:',e2);}
   log(`❌ No se pudo TAPAR: ${motivo}`);
  }
 }catch(err){
  console.error('tapar error:',err);
  log('❌ Error al TAPAR: '+(err?.message||err));
  alert('❌ Hubo un error al cerrar la ronda. Mirá el log de eventos para más info.');
 }};

/* ═══════════ ACEPTAR RONDA (transacción atómica: evita choques entre jugadores y estados corruptos previos) ═══════════ */
window.aceptarRonda=async function(){if(!estadoLocal)return;
 try{
  const res=await runTransaction(ref(db,`partidas/${gameId}`),s=>{
   if(!s||s.fase!=='esperando_aceptacion'||!s.resumenRonda)return; /* nada que hacer: aborta la transacción */
   const r=s.resumenRonda;
   const aceptaron={...(r.aceptaron||{}),[miNombre]:true};
   const todos=(s.jugadores||[]).every(n=>aceptaron[n]);
   if(!todos){
    s.resumenRonda.aceptaron=aceptaron;
    return s;
   }
   /* Todos aceptaron: avanzar de ronda. Usamos SIEMPRE s.ronda (nunca resumenRonda.rondaNum) */
   const nr=(s.ronda||0)+1, fin=nr>=RONDAS.length;
   /* El que TAPÓ la ronda (guardado en el resumen) es quien arranca la próxima ronda. */
   const idxTapador=(s.jugadores||[]).indexOf(r.tapador);
   const ns = fin ? s.starterIdx : s.jugadores.indexOf(r.tapador);
   /* Las monedas son de TODA la partida, no se resetean al pasar de ronda: se conservan
      las que le quedaban a cada jugador (7 sólo la primera vez, por si faltara alguna). */
   const bajadas={},compraH={},monedas={...(s.monedas||{})};
   s.jugadores.forEach(n=>{bajadas[n]=[];compraH[n]=false;if(monedas[n]==null)monedas[n]=7;});
   let mazoNuevo=crearMazo(),manosFinales={};
   s.jugadores.forEach(n=>{manosFinales[n]=[];for(let x=0;x<11;x++)manosFinales[n].push(mazoNuevo.pop());});
   const cartaInicial=mazoNuevo.pop(); /* se destapa la primera carta de la mesa al arrancar la nueva ronda */
   s.ronda=fin?nr-1:nr;
   s.puntajes=r.puntajesAcum||s.puntajes;
   s.bajadas=bajadas;
   s.monedas=monedas;
   s.compraHabilitada=compraH;
   s.mesa=cartaInicial;
   s.pozo=[];
   s.robos=0;
   s.turnoIdx=ns;
   s.starterIdx=ns;
   s.fase=fin?'finalizado':'jugando';
   s.mazo=mazoNuevo;
   s.manos=manosFinales;
   s.resumenRonda=null;
   return s;
  });
  if(res.committed)log('▶ Listo confirmado');
 }catch(err){
  console.error('aceptarRonda error:',err);
  log('❌ Error al confirmar "Listo": '+(err?.message||err));
  alert('❌ Hubo un error al pasar a la siguiente ronda. Mirá el log de eventos para más info.');
 }};


 /* ═══════════ APRESSAR JUGADOR (cualquiera puede) ═══════════ */
window.apressarJugador = async function(nombre) {
  if (!estadoLocal) return;
  await update(ref(db, `partidas/${gameId}/apressado`), { [nombre]: Date.now() });
  log(`⏰ ${miNombre} apuró a ${nombre}`);
};

/* ═══════════ HOST: SALTEAR / EXPULSAR ═══════════ */
window.saltearTurno = async function() {
  if (!estadoLocal) return;
  const e = estadoLocal;
  const jugActual = e.jugadores[e.turnoIdx];
  const next = (e.turnoIdx + 1) % e.jugadores.length;
  await update(ref(db, `partidas/${gameId}`), { turnoIdx: next, robos: 0 });
  log(`⏭️ ${miNombre} salteó el turno de ${jugActual}`);
};

window.expulsarJugador = async function(nombre) {
  if (!confirm(`¿Expulsar a ${nombre}? Sus jugadas bajadas quedan en la mesa.`)) return;
  await runTransaction(ref(db, `partidas/${gameId}`), s => {
    if (!s) return;
    const idx = s.jugadores.indexOf(nombre);
    if (idx === -1) return;
    if (!s.expulsados) s.expulsados = {};
    s.expulsados[nombre] = true;
    if (s.jugadores[s.turnoIdx] === nombre) {
      s.turnoIdx = (s.turnoIdx + 1) % s.jugadores.length;
      s.robos = 0;
    }
    return s;
  });
  log(`🚫 ${miNombre} expulsó a ${nombre}`);
};

 /* ═══════════ APRESSAR JUGADOR (cualquiera puede) ═══════════ */
window.apressarJugador = async function(nombre) {
  if (!estadoLocal) return;
  await update(ref(db, `partidas/${gameId}/apressado`), { [nombre]: Date.now() });
  log(`⏰ ${miNombre} apuró a ${nombre}`);
};

/* ═══════════ SOLO HOST: SETUP Y LINKS ═══════════ */
/* ═══════════ HOST: APRESSAR / SALTEAR / EXPULSAR ═══════════ */
window.apressarJugador = async function(nombre) {
  if (!estadoLocal) return;
  await update(ref(db, `partidas/${gameId}/apressado`), { [nombre]: Date.now() });
  log(`⏰ ${miNombre} apuró a ${nombre}`);
};

window.saltearTurno = async function() {
  if (!estadoLocal) return;
  const e = estadoLocal;
  const jugActual = e.jugadores[e.turnoIdx];
  let next = (e.turnoIdx + 1) % e.jugadores.length;
while (e.expulsados?.[e.jugadores[next]] && next !== e.turnoIdx) {
  next = (next + 1) % e.jugadores.length;
}
  await update(ref(db, `partidas/${gameId}`), { turnoIdx: next, robos: 0 });
  log(`⏭️ ${miNombre} salteó el turno de ${jugActual}`);
};

window.expulsarJugador = async function(nombre) {
  if (!confirm(`¿Expulsar a ${nombre}? Sus jugadas bajadas quedan en la mesa.`)) return;
  await runTransaction(ref(db, `partidas/${gameId}`), s => {
    if (!s) return;
    const idx = s.jugadores.indexOf(nombre);
    if (idx === -1) return;
    // Marcar como expulsado (no borramos del array para mantener índices)
    if (!s.expulsados) s.expulsados = {};
    s.expulsados[nombre] = true;
    // Si era su turno, avanzar al siguiente
    if (s.jugadores[s.turnoIdx] === nombre) {
      s.turnoIdx = (s.turnoIdx + 1) % s.jugadores.length;
      s.robos = 0;
    }
    return s;
  });
  log(`🚫 ${miNombre} expulsó a ${nombre}`);
};


window.crearInputs=function(){const num=parseInt($('numJugadores')?.value)||0;
 const c=$('inputJugadores');if(!c)return;
 c.innerHTML=`<div class="input-row"><span class="yo-tag">👤 ${miNombre} (vos — host)</span></div>`;
 for(let i=1;i<num;i++)c.innerHTML+=`<div class="input-row"><label>Jugador ${i+1}:</label>
  <input type="text" id="jug${i}" placeholder="Nombre" oninput="this.value=this.value.toUpperCase();actualizarStarter()"/></div>`;
 actualizarStarter();};

window.actualizarStarter=function(){const num=parseInt($('numJugadores')?.value)||0;
 const n=[miNombre];for(let i=1;i<num;i++){const v=$(`jug${i}`)?.value.trim();n.push(v||`Jugador ${i+1}`);}
 const st=$('starterSel');if(st)st.innerHTML=n.map(x=>`<option value="${x}">${x}</option>`).join('');};

window.iniciarPartida=async function(){const num=parseInt($('numJugadores')?.value);
 if(!num||num<2)return showMsg('Seleccioná al menos 2 jugadores.','error');
 const nombres=[miNombre];
 for(let i=1;i<num;i++){const v=$(`jug${i}`)?.value.trim();
  if(!v)return showMsg(`Nombre jugador ${i+1} vacío.`,'error');nombres.push(v.toUpperCase());}
 const btn=$('btnIniciar');btn.disabled=true;btn.textContent='⏳ Repartiendo...';
 let st=$('starterSel')?.value;if(!nombres.includes(st))st=miNombre;
 const sIdx=nombres.indexOf(st);
 gameId=Math.random().toString(36).substring(2,8).toUpperCase();
 const mazo=crearMazo(),manos={},puntajes={},bajadas={},monedas={},compraH={};
 nombres.forEach(n=>{manos[n]=[];puntajes[n]=0;bajadas[n]=[];monedas[n]=7;compraH[n]=false;});
 for(let c=0;c<11;c++)nombres.forEach(n=>manos[n].push(mazo.pop()));
 const cartaInicial=mazo.pop(); /* el host destapa la primera carta de la mesa al arrancar la partida */
 await set(ref(db,`partidas/${gameId}`),{gameId,host:miNombre,ronda:0,turnoIdx:sIdx,starterIdx:sIdx,
  jugadores:nombres,manos,mazo,mesa:cartaInicial,pozo:[],bajadas,puntajes,monedas,compraHabilitada:compraH,robos:0,fase:'jugando'});
 localStorage.setItem('gameId',gameId);
 escuchar(gameId);
 $('panelSetup').style.display='none';$('panelMesa').style.display='block';
 renderWapp(nombres,gameId);};

function renderWapp(n,gid){const base=location.origin+location.pathname.replace(/(mesa|index)\.html/,'')+'mesa-jugador.html';
 const el=$('wappLinks');if(!el)return;
 el.innerHTML=n.slice(1).map(x=>{
  const l=`${base}?game=${gid}&player=${encodeURIComponent(x)}`;
  const m=encodeURIComponent(`¡Hola ${x}! Entrá a tu mesa de Telefunken 🃏\n${l}`);
  return `<div class="wapp-row"><span class="wapp-n">${x}</span>
   <a href="https://wa.me/?text=${m}" target="_blank" class="whatsapp-btn wapp-small">📱 Enviar</a>
   <button onclick="navigator.clipboard.writeText('${l}').then(()=>alert('Copiado!'))" class="btn-copy">📋</button></div>`;}).join('');}

/* ═══════════ UTILIDADES ═══════════ */
function log(m){const el=$('logEventos');if(!el)return;
 const h=new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
 el.innerHTML=`<div class="log-item"><span class="log-hora">${h}</span> ${m}</div>`+el.innerHTML;
 if(el.children.length>20)el.removeChild(el.lastChild);}

function showMsg(t,k){const el=$('setupMsg');if(!el)return;
 el.textContent=t;el.className='msg-box '+k;el.style.display='block';}