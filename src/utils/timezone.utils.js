// src/utils/timezone.utils.js
const moment = require('moment-timezone');

/**
 * Convertir fecha local del usuario a UTC
 * @param {string} fechaLocal - Fecha en formato 'YYYY-MM-DD HH:mm:ss' o ISO
 * @param {string} zonaHoraria - IANA timezone (Ej: 'America/Mexico_City')
 * @returns {string} Fecha en UTC formato ISO
 */
exports.convertirAUTC = (fechaLocal, zonaHoraria) => {
    try {
        if (!fechaLocal || !zonaHoraria) {
            throw new Error('Fecha local y zona horaria son requeridas');
        }

        const fechaUTC = moment.tz(fechaLocal, zonaHoraria).utc().toISOString();
        
        console.log('🌍 Conversión a UTC:', {
            entrada: fechaLocal,
            zona: zonaHoraria,
            salidaUTC: fechaUTC
        });

        return fechaUTC;
    } catch (error) {
        console.error('❌ Error al convertir a UTC:', error.message);
        console.error('   Entrada:', { fechaLocal, zonaHoraria });
        
        // Fallback: intentar parsear directamente
        return new Date(fechaLocal).toISOString();
    }
};

/**
 * Convertir fecha UTC a hora local del usuario
 * @param {string} fechaUTC - Fecha en UTC formato ISO
 * @param {string} zonaHoraria - IANA timezone
 * @returns {string} Fecha en hora local formato 'YYYY-MM-DD HH:mm:ss'
 */
exports.convertirALocal = (fechaUTC, zonaHoraria) => {
    try {
        if (!fechaUTC || !zonaHoraria) {
            throw new Error('Fecha UTC y zona horaria son requeridas');
        }

        const fechaLocal = moment(fechaUTC).tz(zonaHoraria).format('YYYY-MM-DD HH:mm:ss');
        
        console.log('🏠 Conversión a local:', {
            entradaUTC: fechaUTC,
            zona: zonaHoraria,
            salidaLocal: fechaLocal
        });

        return fechaLocal;
    } catch (error) {
        console.error('❌ Error al convertir a local:', error.message);
        return new Date(fechaUTC).toISOString();
    }
};

/**
 * Obtener zona horaria del usuario desde BD
 * @param {Connection} connection - Conexión de MySQL
 * @param {number} idUsuario - ID del usuario
 * @returns {Promise<string>} Zona horaria del usuario
 */
exports.obtenerZonaHorariaUsuario = async (connection, idUsuario) => {
    try {
        const [usuarios] = await connection.execute(
            'SELECT zona_horaria FROM usuario WHERE idUsuario = ?',
            [idUsuario]
        );
        
        const zona = usuarios[0]?.zona_horaria || 'America/Mexico_City';
        
        console.log(`🌍 Zona horaria del usuario ${idUsuario}: ${zona}`);
        
        return zona;
    } catch (error) {
        console.error('❌ Error al obtener zona horaria:', error.message);
        return 'America/Mexico_City'; // Fallback
    }
};

/**
 * Validar que una zona horaria sea válida según IANA
 * @param {string} zonaHoraria - Zona horaria a validar
 * @returns {boolean} true si es válida
 */
exports.validarZonaHoraria = (zonaHoraria) => {
    try {
        const zonasValidas = moment.tz.names();
        return zonasValidas.includes(zonaHoraria);
    } catch (error) {
        console.error('❌ Error al validar zona horaria:', error.message);
        return false;
    }
};

/**
 * Obtener offset actual de una zona horaria
 * @param {string} zonaHoraria - IANA timezone
 * @returns {string} Offset en formato 'GMT±X' (Ej: 'GMT-6')
 */
exports.obtenerOffset = (zonaHoraria) => {
    try {
        const offset = moment.tz(zonaHoraria).format('Z'); // Ej: '-06:00'
        const horas = parseInt(offset.split(':')[0]); // -6
        
        return `GMT${horas >= 0 ? '+' : ''}${horas}`;
    } catch (error) {
        console.error('❌ Error al obtener offset:', error.message);
        return 'GMT+0';
    }
};

/**
 * Calcular recordatorios predefinidos basados en fecha de vencimiento
 * @param {string|Date} fechaVencimiento - Fecha de vencimiento de la tarea
 * @param {string} zonaHoraria - Zona horaria del usuario
 * @returns {Array} Array de recordatorios con fechas UTC y locales
 */
exports.calcularRecordatoriosPredefinidos = (fechaVencimiento, zonaHoraria) => {
    try {
        const recordatorios = [];
        const vencimiento = moment(fechaVencimiento).tz(zonaHoraria);
        const ahora = moment();

        console.log('📅 Calculando recordatorios para:', {
            vencimiento: vencimiento.format('YYYY-MM-DD HH:mm:ss'),
            zona: zonaHoraria
        });

        // 1 día antes (a las 9:00 AM en zona horaria del usuario)
        const unDiaAntes = vencimiento.clone()
            .subtract(1, 'days')
            .hour(9)
            .minute(0)
            .second(0);
        
        if (unDiaAntes.isAfter(ahora)) {
            recordatorios.push({
                fecha: unDiaAntes.utc().toISOString(),
                fechaLocal: unDiaAntes.format('YYYY-MM-DD HH:mm:ss'),
                zonaHoraria,
                tipo: '1_dia_antes',
                descripcion: '1 día antes a las 9:00 AM',
                notificado: false,
                fechaCreacion: new Date().toISOString()
            });
        }

        // 1 hora antes
        const unaHoraAntes = vencimiento.clone().subtract(1, 'hours');
        
        if (unaHoraAntes.isAfter(ahora)) {
            recordatorios.push({
                fecha: unaHoraAntes.utc().toISOString(),
                fechaLocal: unaHoraAntes.format('YYYY-MM-DD HH:mm:ss'),
                zonaHoraria,
                tipo: '1_hora_antes',
                descripcion: '1 hora antes',
                notificado: false,
                fechaCreacion: new Date().toISOString()
            });
        }

        // En el momento exacto
        if (vencimiento.isAfter(ahora)) {
            recordatorios.push({
                fecha: vencimiento.utc().toISOString(),
                fechaLocal: vencimiento.format('YYYY-MM-DD HH:mm:ss'),
                zonaHoraria,
                tipo: 'en_el_momento',
                descripcion: 'En el momento de vencimiento',
                notificado: false,
                fechaCreacion: new Date().toISOString()
            });
        }

        console.log(`✅ ${recordatorios.length} recordatorios calculados`);

        return recordatorios;
    } catch (error) {
        console.error('❌ Error al calcular recordatorios:', error.message);
        return [];
    }
};

/**
 * Verificar si una fecha ya pasó en la zona horaria del usuario
 * @param {string} fechaUTC - Fecha en UTC
 * @param {string} zonaHoraria - Zona horaria del usuario
 * @returns {boolean} true si ya pasó
 */
exports.fechaPasada = (fechaUTC, zonaHoraria) => {
    try {
        const fecha = moment(fechaUTC).tz(zonaHoraria);
        const ahora = moment().tz(zonaHoraria);
        
        return fecha.isBefore(ahora);
    } catch (error) {
        console.error('❌ Error al verificar fecha:', error.message);
        return false;
    }
};

/**
 * Formatear fecha para mostrar al usuario
 * @param {string} fechaUTC - Fecha en UTC
 * @param {string} zonaHoraria - Zona horaria del usuario
 * @param {string} formato - Formato de salida (por defecto: 'DD/MM/YYYY HH:mm')
 * @returns {string} Fecha formateada
 */
exports.formatearFecha = (fechaUTC, zonaHoraria, formato = 'DD/MM/YYYY HH:mm') => {
    try {
        return moment(fechaUTC).tz(zonaHoraria).format(formato);
    } catch (error) {
        console.error('❌ Error al formatear fecha:', error.message);
        return 'Fecha inválida';
    }
};

module.exports = exports;