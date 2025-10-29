// netlify/functions/register.js

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI; 
const client = new MongoClient(MONGO_URI);

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Método no permitido' };

    try {
        await client.connect();
        const database = client.db('telefunkenDB');
        const users = database.collection('users');
        
        const { username, password } = JSON.parse(event.body);

        // 1. Verificar si el usuario ya existe
        const existingUser = await users.findOne({ username });
        if (existingUser) {
            return { statusCode: 409, body: JSON.stringify({ message: 'El nombre de usuario ya está en uso.' }) };
        }

        // 2. Encriptar la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Crear y guardar el nuevo usuario
        await users.insertOne({ username, password: hashedPassword, gameState: null });

        return {
            statusCode: 201,
            body: JSON.stringify({ message: 'Usuario registrado con éxito.' })
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: 'Error en el registro serverless.', error: error.message }) };
    } finally {
        await client.close();
    }
};