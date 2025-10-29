// netlify/functions/auth.js

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET; 

/**
 * Verifica el token JWT del cliente.
 * @param {object} event - El objeto de evento de Netlify Function
 * @returns {object|null} - Devuelve el payload decodificado (userID) o null si falla.
 */
const verifyToken = (event) => {
    const authHeader = event.headers.authorization;
    if (!authHeader) return null;

    // El header es típicamente: "Bearer [token]"
    const token = authHeader.split(' ')[1]; 
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded; 
    } catch (err) {
        return null; // Token inválido o expirado
    }
};

module.exports = { verifyToken };