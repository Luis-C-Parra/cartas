<<<<<<< HEAD
# 🎲 TELEFUNKEN FAMILIAR

**Juego de dados y cartas clásico, ahora 100% online y familiar.**
Partidas multijugador en tiempo real desde el celular o la PC, sin instalar nada.

© 2026 TELEFUNKEN FAMILIAR · **Lic. Luis C. Parra** · Todos los derechos reservados.

---

## ✨ Características

- 🌐 **Multijugador en tiempo real** con Firebase Realtime Database (2 a 8 jugadores).
- 🃏 **Las 7 rondas clásicas**: 1 Trica, 2 Tricas, 3 Tricas, 1 Cuarta, 2 Cuartas, Quina y Escalera.
- 🃏 **Joker comodín**: vale por cualquier carta (y se puede *sopar*).
- 💰 **Sistema de monedas**: comprar la carta recién tirada cuesta 🪙1 (7 monedas por partida).
- 🧹 **Sopar**: agregá cartas a jugadas bajadas, cambiá jokers, estirá o partí escaleras.
- ✊ **Cartas arrastrables**: mantené presionado y deslizá para ordenar tu mano, o usá 🔃 Ordenar.
- 🟢 **TAPA**: cerrá la ronda con tu última carta y mirá el resumen en el modal de fin de ronda.
- 🌙 **Dos temas visuales**: claro suave y modo casino elegante (botón flotante).
- 📱 **Pensado para el celu**: aviso para girar a horizontal y botones compactos.
- 🔐 **Login** con usuarios autorizados (Google Apps Script) + acceso por WhatsApp.

---

## 🃏 Cómo se juega (resumen)

1. El host crea la partida y envía el link a cada jugador por WhatsApp.
2. Se reparten **11 cartas**. En tu turno: robás del mazo o comprás la carta de la mesa, y tirás una.
3. Cuando tengas la jugada de la ronda (ej. 2 tricas = 6 cartas), la bajás **completa de una vez** con 📥 BAJAR.
4. Después de bajar tu jugada, desde tu siguiente turno podés **comprar** y **sopar**.
5. Cuando te quede **1 sola carta**, tocá 🟢 TAPA para cerrar la ronda.
6. Puntos en contra por cartas sobrantes: A=15, J=11, Q=12, K=13, 🃏=20.
7. Al final de las 7 rondas gana el de **menor puntaje**. 🏆

---

## 🚀 Jugar online (GitHub Pages)

1. Subí el repo a GitHub.
2. `Settings → Pages → Branch: main → Save`.
3. Abrí la URL del sitio: el `index.html` te lleva solo al login o a la mesa.

## 💻 Jugar en local

Guardá todos los archivos en una carpeta y abrí `index.html` (o `login.html`) en el navegador.
Requiere internet (Firebase + fuentes).

---

## 📁 Estructura del proyecto

| Archivo            | Función                                              |
|--------------------|------------------------------------------------------|
| `index.html`       | Puerta de entrada: redirige a login o mesa           |
| `login.html`       | Inicio de sesión + reglas del juego                  |
| `mesa.html`        | Pantalla del **host** (crea la partida, links WhatsApp) |
| `mesa-jugador.html`| Pantalla de cada **jugador** invitado                |
| `juego.js`         | Lógica única del juego (host y jugador)              |
| `mesa.css`         | Estilos: tema claro suave + modo casino              |
| `logo.png`         | Isotipo del juego                                    |

---

## 🛠️ Tecnologías

- HTML5 + CSS3 (vanilla)
- JavaScript ES Modules
- Firebase Realtime Database (estado compartido en tiempo real)
- Google Apps Script (validación de usuarios)

---

## 📞 Contacto / acceso

¿Querés tu usuario para jugar? Pedilo por WhatsApp:
[🟢 Solicitar acceso](https://wa.me/5491162841533?text=Hola,%20quiero%20acceso%20a%20Telefunken%20Familiar)

---

> **TELEFUNKEN FAMILIAR** — hecho con ❤️ para jugar en familia.
> © 2026 · Lic. Luis C. Parra
=======
# cartas
juego de cartas telefunken
>>>>>>> e6adf89f81f75407b94c8dfc2479ace99e5250e4
