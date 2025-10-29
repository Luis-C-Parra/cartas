// netlify/functions/loadGame.js

const faunadb = require('faunadb');
const { verifyToken } = require('./auth-middleware'); // Usamos el mismo verificador
const q = faunadb.query;
const client = new faunadb.Client({ secret: process.env.FAUNADB_SECRET_KEY });

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') { // El cliente enviará una petición GET
        return { statusCode: 405, body: 'Método no permitido' };
    }

    // 1. Verificar Autenticación
    const userPayload = verifyToken(event);
    if (!userPayload) {
        // Devuelve un 403 o 404 si no hay token válido. El frontend lo interpretará como "no hay sesión" o "no hay juego guardado".
        return { statusCode: 403, body: JSON.stringify({ message: 'No autorizado o token inválido.' }) };
    }

    try {
        const userRef = q.Ref(q.Collection('users'), userPayload.ref);

        // 2. Obtener el documento completo del usuario
        const result = await client.query(
            q.Get(userRef)
        );

        const userData = result.data;
        
        // 3. Devolver el estado del juego si existe
        if (userData.gameState) {
             return {
                statusCode: 200,
                body: JSON.stringify({ 
                    message: 'Estado de juego recuperado.',
                    gameState: userData.gameState 
                })
            };
        } else {
            // El usuario está logueado, pero nunca ha guardado una partida
             return {
                statusCode: 404, 
                body: JSON.stringify({ message: 'No se encontró un estado de juego guardado para este usuario.' }) 
            };
        }

    } catch (error) {
        console.error("Error al cargar el estado del juego:", error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Error en el servidor al cargar la partida.' }) };
    }
};