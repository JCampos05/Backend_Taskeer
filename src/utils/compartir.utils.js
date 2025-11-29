// utils/compartir.utils.js
const crypto = require('crypto');

const generarClaveCompartir = () => {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let clave = '';
    for (let i = 0; i < 8; i++) {
        clave += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    console.log('🔑 generarClaveCompartir() llamada, clave:', clave);
    return clave;
};

const validarClaveCompartir = (clave) => {
    if (!clave || typeof clave !== 'string') return false;
    return /^[A-Z0-9]{8}$/.test(clave);
};

const generarTokenInvitacion = () => {
    return crypto.randomBytes(32).toString('hex');
};

const esRolValido = (rol) => {
    const rolesValidos = ['admin', 'colaborador', 'lector'];
    return rolesValidos.includes(rol);
};

const calcularFechaExpiracion = (dias) => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + dias);
    return fecha;
};

const normalizarEmail = (email) => {
    if (!email) return '';
    return email.toLowerCase().trim();
};

module.exports = {
    generarClaveCompartir,
    validarClaveCompartir,
    generarTokenInvitacion,
    esRolValido,
    calcularFechaExpiracion,
    normalizarEmail
};