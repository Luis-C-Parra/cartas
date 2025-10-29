// netlify/functions/saveGame.js

const { MongoClient, ObjectId } = require('mongodb');
const { verifyToken } = require('../functions/auth'); 

const MONGO_URI = process.env.MONGO_URI; 
const client = new MongoClient(MONGO_URI);

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Método no permitido' };

    // 1. Verificar Autenticación
    const userPayload = verifyToken(event);
    if (!userPayload) {
        return { statusCode: 403, body: JSON.stringify({ message: 'No autorizado. Token inválido.' }) };
    }

    try {
        await client.connect();
        const database = client.db('telefunkenDB');
        const users = database.collection('users');

        const gameState = JSON.parse(event.body);
        const userId = new ObjectId(userPayload.id); // Convertir ID a ObjectId de MongoDB

        // 2. Actualizar el documento del usuario con el nuevo estado del juego
        await users.updateOne(
            { _id: userId },
            { $set: { gameState: gameState } }
        );

        return { statusCode: 200, body: JSON.stringify({ message: 'Progreso del juego guardado exitosamente.' }) };
        
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: 'Error al guardar el estado del juego.', error: error.message }) };
    } finally {
        await client.close();
    }
};