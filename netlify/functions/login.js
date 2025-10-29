// netlify/functions/login.js

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const MONGO_URI = process.env.MONGO_URI; 
const JWT_SECRET = process.env.JWT_SECRET;
const client = new MongoClient(MONGO_URI);

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Método no permitido' };

    try {
        await client.connect();
        const database = client.db('telefunkenDB');
        const users = database.collection('users');
        
        const { username, password } = JSON.parse(event.body);

        // 1. Buscar al usuario
        const user = await users.findOne({ username });
        if (!user) {
            return { statusCode: 401, body: JSON.stringify({ message: 'Credenciales inválidas.' }) };
        }

        // 2. Comparar la contraseña encriptada
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return { statusCode: 401, body: JSON.stringify({ message: 'Credenciales inválidas.' }) };
        }

        // 3. Generar Token JWT
        const token = jwt.sign(
            { id: user._id, username: user.username }, // Usamos _id de MongoDB para el token
            JWT_SECRET,
            { expiresIn: '7d' } 
        );

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Inicio de sesión exitoso.', token: token, username: user.username })
        };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: 'Error en el servidor durante el login.' }) };
    } finally {
        await client.close();
    }
};