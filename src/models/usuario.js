const db = require('../config/config');
const bcrypt = require('bcrypt');

const Usuario = {
    crear: async (nombre, apellido, email, password) => {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO usuario (nombre, apellido, email, password) VALUES (?, ?, ?, ?)',
            [nombre, apellido || null, email, hashedPassword]
        );
        return result.insertId;
    },

    buscarPorEmail: async (email) => {
        const [rows] = await db.query(
            'SELECT * FROM usuario WHERE email = ?',
            [email]
        );
        return rows[0];
    },

    buscarPorId: async (idUsuario) => {
        const [rows] = await db.query(
            `SELECT 
                idUsuario, 
                nombre,
                apellido,
                email, 
                emailVerificado,
                bio,
                telefono,
                ubicacion,
                zona_horaria,
                cargo,
                redes_sociales,
                fechaRegistro,
                fecha_actualizacion
            FROM usuario 
            WHERE idUsuario = ?`,
            [idUsuario]
        );

        // Parsear redes_sociales si existe
        if (rows[0] && rows[0].redes_sociales) {
            try {
                rows[0].redes_sociales = JSON.parse(rows[0].redes_sociales);
            } catch (e) {
                rows[0].redes_sociales = null;
            }
        }

        return rows[0];
    },

    actualizarPerfil: async (idUsuario, datos) => {
        const { nombre, apellido, bio, telefono, ubicacion, cargo, redes_sociales } = datos;

        // Construir query dinámicamente solo con campos proporcionados
        const campos = [];
        const valores = [];

        if (nombre !== undefined) {
            campos.push('nombre = ?');
            valores.push(nombre);
        }
        
        if (apellido !== undefined) {
            campos.push('apellido = ?');
            valores.push(apellido);
        }

        if (bio !== undefined) {
            campos.push('bio = ?');
            valores.push(bio);
        }
        if (telefono !== undefined) {
            campos.push('telefono = ?');
            valores.push(telefono);
        }
        if (ubicacion !== undefined) {
            campos.push('ubicacion = ?');
            valores.push(ubicacion);
        }
        if (cargo !== undefined) {
            campos.push('cargo = ?');
            valores.push(cargo);
        }
        if (redes_sociales !== undefined) {
            campos.push('redes_sociales = ?');
            valores.push(JSON.stringify(redes_sociales));
        }

        if (campos.length === 0) {
            throw new Error('No hay campos para actualizar');
        }

        valores.push(idUsuario);

        const query = `UPDATE usuario SET ${campos.join(', ')} WHERE idUsuario = ?`;

        const [result] = await db.query(query, valores);
        return result.affectedRows > 0;
    },

    actualizarNombre: async (idUsuario, nombre, apellido) => {
        const [result] = await db.query(
            'UPDATE usuario SET nombre = ?, apellido = ? WHERE idUsuario = ?',
            [nombre, apellido || null, idUsuario]
        );
        return result.affectedRows > 0;
    },

    cambiarPassword: async (idUsuario, passwordActual, passwordNuevo) => {
        // Obtener password actual del usuario
        const [rows] = await db.query(
            'SELECT password FROM usuario WHERE idUsuario = ?',
            [idUsuario]
        );

        if (rows.length === 0) {
            throw new Error('Usuario no encontrado');
        }

        // Verificar password actual
        const passwordValido = await bcrypt.compare(passwordActual, rows[0].password);
        if (!passwordValido) {
            throw new Error('Password actual incorrecto');
        }

        // Hashear nuevo password
        const hashedPassword = await bcrypt.hash(passwordNuevo, 10);

        // Actualizar password
        const [result] = await db.query(
            'UPDATE usuario SET password = ? WHERE idUsuario = ?',
            [hashedPassword, idUsuario]
        );

        return result.affectedRows > 0;
    },

    validarPassword: async (password, hashedPassword) => {
        return await bcrypt.compare(password, hashedPassword);
    },

    buscarPorIdConPassword: async (idUsuario) => {
        const [rows] = await db.query(
            'SELECT * FROM usuario WHERE idUsuario = ?',
            [idUsuario]
        );
        return rows[0];
    },
};

module.exports = Usuario;