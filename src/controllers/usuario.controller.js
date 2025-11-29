const Usuario = require('../models/usuario');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'tu_clave_secreta_aqui';

const UsuarioController = {
    registrar: async (req, res) => {
        const db = require('../config/config');
        const connection = await db.getConnection();

        try {
            const { nombre, apellido, email, password } = req.body;

            if (!nombre || !email || !password) {
                return res.status(400).json({
                    error: 'Nombre, email y contraseña son obligatorios'
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    error: 'La contraseña debe tener al menos 6 caracteres'
                });
            }

            // Verificar si el email ya existe
            const Usuario = require('../models/usuario');
            const usuarioExistente = await Usuario.buscarPorEmail(email);

            if (usuarioExistente) {
                if (!usuarioExistente.emailVerificado) {
                    return res.status(409).json({
                        error: 'Este email ya está registrado pero no verificado',
                        message: 'Verifica tu email o solicita un nuevo código',
                        idUsuario: usuarioExistente.idUsuario,
                        requiereVerificacion: true
                    });
                }

                return res.status(409).json({
                    error: 'El email ya está registrado'
                });
            }

            await connection.beginTransaction();

            const idUsuario = await Usuario.crear(nombre, apellido, email, password);

            // Generar código de verificación
            const verificacionService = require('../services/verificacion.service');
            const emailService = require('../services/email.service');

            const codigo = verificacionService.generarCodigo();
            const ipCliente = req.ip || req.connection.remoteAddress;

            await verificacionService.guardarCodigo(idUsuario, codigo, ipCliente);

            try {
                await emailService.enviarCodigoVerificacion(email, nombre, codigo);
                console.log(`📧 Email de verificación enviado a: ${email}`);
            } catch (emailError) {
                console.error('❌ Error al enviar email:', emailError);
                await connection.rollback();
                return res.status(500).json({
                    error: 'No se pudo enviar el email de verificación',
                    message: 'Verifica tu conexión a internet e intenta nuevamente'
                });
            }

            await connection.commit();

            res.status(201).json({
                mensaje: 'Usuario registrado exitosamente. Revisa tu email para verificar tu cuenta.',
                idUsuario: idUsuario,
                email: email,
                emailEnviado: true,
                requiereVerificacion: true
            });

        } catch (error) {
            await connection.rollback();
            console.error('❌ Error en registro:', error);
            res.status(500).json({
                error: 'Error al registrar usuario',
                detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } finally {
            connection.release();
        }
    },

    login: async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email y password son requeridos' });
            }

            const Usuario = require('../models/usuario');
            const usuario = await Usuario.buscarPorEmail(email);

            if (!usuario) {
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            const passwordValido = await Usuario.validarPassword(password, usuario.password);
            if (!passwordValido) {
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            // ✅ PERMITIR LOGIN AUNQUE NO ESTÉ VERIFICADO
            // Solo informar al frontend del estado de verificación
            const token = jwt.sign(
                {
                    idUsuario: usuario.idUsuario,
                    email: usuario.email,
                    nombre: usuario.nombre
                },
                SECRET_KEY,
                { expiresIn: '7d' }
            );

            delete usuario.password;

            res.json({
                mensaje: 'Login exitoso',
                token,
                usuario: usuario,
                // ⚠️ Informar al frontend si necesita verificar
                requiereVerificacion: !usuario.emailVerificado
            });

        } catch (error) {
            console.error('Error al hacer login:', error);
            res.status(500).json({ error: 'Error al hacer login' });
        }
    },

    obtenerPerfil: async (req, res) => {
        try {
            const usuario = await Usuario.buscarPorId(req.usuario.idUsuario);
            if (!usuario) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            // No enviar el password aunque no esté en la query
            delete usuario.password;

            res.json(usuario);
        } catch (error) {
            console.error('Error al obtener perfil:', error);
            res.status(500).json({ error: 'Error al obtener perfil' });
        }
    },

    actualizarPerfil: async (req, res) => {
        try {
            const { nombre, apellido, bio, telefono, ubicacion, cargo, redes_sociales } = req.body;

            const datosActualizar = {};

            if (nombre !== undefined) datosActualizar.nombre = nombre;

            if (apellido !== undefined) datosActualizar.apellido = apellido;

            if (bio !== undefined) datosActualizar.bio = bio;
            if (telefono !== undefined) datosActualizar.telefono = telefono;
            if (ubicacion !== undefined) datosActualizar.ubicacion = ubicacion;
            if (cargo !== undefined) datosActualizar.cargo = cargo;
            if (redes_sociales !== undefined) datosActualizar.redes_sociales = redes_sociales;

            if (Object.keys(datosActualizar).length === 0) {
                return res.status(400).json({
                    error: 'No se proporcionaron campos para actualizar'
                });
            }

            const actualizado = await Usuario.actualizarPerfil(
                req.usuario.idUsuario,
                datosActualizar
            );

            if (!actualizado) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            // Obtener usuario actualizado
            const usuarioActualizado = await Usuario.buscarPorId(req.usuario.idUsuario);
            delete usuarioActualizado.password;

            res.json({
                mensaje: 'Perfil actualizado exitosamente',
                usuario: usuarioActualizado
            });
        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            res.status(500).json({
                error: 'Error al actualizar perfil',
                detalle: error.message
            });
        }
    },

    actualizarNombre: async (req, res) => {
        try {
            const { nombre } = req.body;

            if (!nombre || nombre.trim().length === 0) {
                return res.status(400).json({ error: 'El nombre es requerido' });
            }

            const actualizado = await Usuario.actualizarNombre(
                req.usuario.idUsuario,
                nombre.trim()
            );

            if (!actualizado) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            res.json({ mensaje: 'Nombre actualizado exitosamente' });
        } catch (error) {
            console.error('Error al actualizar nombre:', error);
            res.status(500).json({ error: 'Error al actualizar nombre' });
        }
    },

    cambiarPassword: async (req, res) => {
        try {
            const { passwordActual, passwordNuevo } = req.body;

            if (!passwordActual || !passwordNuevo) {
                return res.status(400).json({
                    error: 'Se requiere password actual y nuevo'
                });
            }

            if (passwordNuevo.length < 6) {
                return res.status(400).json({
                    error: 'El nuevo password debe tener al menos 6 caracteres'
                });
            }

            const actualizado = await Usuario.cambiarPassword(
                req.usuario.idUsuario,
                passwordActual,
                passwordNuevo
            );

            if (!actualizado) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            res.json({ mensaje: 'Password actualizado exitosamente' });
        } catch (error) {
            console.error('Error al cambiar password:', error);

            if (error.message === 'Password actual incorrecto') {
                return res.status(400).json({ error: error.message });
            }

            res.status(500).json({ error: 'Error al cambiar password' });
        }
    },

    verificarUsuarios: async (req, res) => {
        try {
            const db = require('../config/config');
            const [rows] = await db.query('SELECT COUNT(*) as total FROM usuario');
            res.json({ existenUsuarios: rows[0].total > 0 });
        } catch (error) {
            console.error('Error al verificar usuarios:', error);
            res.status(500).json({ error: 'Error al verificar usuarios' });
        }
    },

    // ============================================
    // VERIFICAR EMAIL CON CÓDIGO (NUEVO)
    // ============================================
    verificarEmail: async (req, res) => {
        try {
            const { idUsuario, codigo } = req.body;

            // Validaciones
            if (!idUsuario || !codigo) {
                return res.status(400).json({
                    error: 'ID de usuario y código son requeridos'
                });
            }

            if (codigo.length !== 6) {
                return res.status(400).json({
                    error: 'El código debe tener 6 dígitos'
                });
            }

            const verificacionService = require('../services/verificacion.service');

            // Verificar código
            const resultado = await verificacionService.verificarCodigo(idUsuario, codigo);

            if (!resultado.success) {
                // Determinar código de estado según el error
                let statusCode = 400;
                if (resultado.error === 'EXPIRADO') statusCode = 410; // Gone
                if (resultado.error === 'NO_CODIGO') statusCode = 404;

                return res.status(statusCode).json({
                    error: resultado.error,
                    message: resultado.message,
                    intentosRestantes: resultado.intentosRestantes
                });
            }

            // ✅ Verificación exitosa - obtener datos del usuario
            const Usuario = require('../models/usuario');
            const usuario = await Usuario.buscarPorId(idUsuario);

            if (!usuario) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            // Generar JWT ahora que está verificado
            const token = jwt.sign(
                {
                    idUsuario: usuario.idUsuario,
                    email: usuario.email,
                    nombre: usuario.nombre
                },
                SECRET_KEY,
                { expiresIn: '7d' }
            );

            // Enviar email de bienvenida (async, no bloqueante)
            const emailService = require('../services/email.service');
            emailService.enviarBienvenida(usuario.email, usuario.nombre)
                .catch(err => console.error('Error al enviar email de bienvenida:', err));

            console.log(`✅ Usuario ${idUsuario} verificado y autenticado`);

            // Eliminar password
            delete usuario.password;

            res.json({
                mensaje: '¡Email verificado exitosamente!',
                token: token,
                usuario: {
                    ...usuario,
                    emailVerificado: true
                }
            });

        } catch (error) {
            console.error('❌ Error al verificar email:', error);
            res.status(500).json({
                error: 'Error al verificar el código',
                detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // ============================================
    // REENVIAR CÓDIGO DE VERIFICACIÓN (NUEVO)
    // ============================================
    reenviarCodigo: async (req, res) => {
        try {
            // 🔥 Obtener idUsuario del token O del body
            let idUsuario = req.body.idUsuario;

            // Si viene autenticado por token, usar ese ID
            if (req.usuario && req.usuario.idUsuario) {
                idUsuario = req.usuario.idUsuario;
            }

            if (!idUsuario) {
                return res.status(400).json({
                    error: 'ID de usuario requerido'
                });
            }

            const Usuario = require('../models/usuario');
            const verificacionService = require('../services/verificacion.service');
            const emailService = require('../services/email.service');

            // Verificar que el usuario existe
            const usuario = await Usuario.buscarPorId(idUsuario);

            if (!usuario) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            // ✅ IMPORTANTE: NO verificar si ya está verificado para cambio de contraseña
            // if (usuario.emailVerificado) {
            //     return res.status(400).json({
            //         error: 'Este email ya está verificado'
            //     });
            // }

            // Verificar cooldown
            const cooldownCheck = await verificacionService.puedeReenviarCodigo(idUsuario);
            if (!cooldownCheck.puede) {
                return res.status(429).json({
                    error: 'Debes esperar antes de solicitar otro código',
                    message: cooldownCheck.message,
                    segundosRestantes: cooldownCheck.segundosRestantes
                });
            }

            // Verificar límite diario
            const limiteCheck = await verificacionService.verificarLimiteDiario(idUsuario);
            if (!limiteCheck.permitido) {
                return res.status(429).json({
                    error: 'Límite de códigos alcanzado',
                    message: limiteCheck.message
                });
            }

            // Generar nuevo código
            const codigo = verificacionService.generarCodigo();
            const ipCliente = req.ip || req.connection.remoteAddress;

            await verificacionService.guardarCodigo(idUsuario, codigo, ipCliente);

            // 🔥 USAR EL SERVICIO CORRECTO PARA CAMBIO DE CONTRASEÑA
            await emailService.enviarCodigoCambioPassword(
                usuario.email,
                usuario.nombre,
                codigo
            );

            console.log(`📧 Código para cambio de contraseña enviado a usuario ${idUsuario}`);

            res.json({
                mensaje: 'Código enviado exitosamente',
                emailEnviado: true,
                intentosRestantes: limiteCheck.restantes - 1
            });

        } catch (error) {
            console.error('❌ Error al reenviar código:', error);
            res.status(500).json({
                error: 'Error al reenviar código',
                detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // ============================================
    // ENDPOINT DE PRUEBA PARA EMAIL (NUEVO - SOLO DESARROLLO)
    // ============================================
    testEmail: async (req, res) => {
        // Solo en desarrollo
        if (process.env.NODE_ENV !== 'development') {
            return res.status(403).json({ error: 'Endpoint solo disponible en desarrollo' });
        }

        try {
            const { email, nombre } = req.body;

            if (!email || !nombre) {
                return res.status(400).json({ error: 'Email y nombre requeridos' });
            }

            const emailService = require('../services/email.service');
            const codigoPrueba = '123456';

            await emailService.enviarCodigoVerificacion(email, nombre, codigoPrueba);

            res.json({
                mensaje: 'Email de prueba enviado',
                email: email,
                codigo: codigoPrueba
            });

        } catch (error) {
            console.error('❌ Error al enviar email de prueba:', error);
            res.status(500).json({
                error: 'Error al enviar email',
                detalles: error.message
            });
        }
    },

    validarPasswordActual: async (req, res) => {
        try {
            const { password } = req.body;

            if (!password) {
                return res.status(400).json({
                    error: 'PASSWORD_REQUERIDO',
                    mensaje: 'La contraseña es requerida'
                });
            }

            const Usuario = require('../models/usuario');

            // Usar el método que SÍ incluye el password
            const usuario = await Usuario.buscarPorIdConPassword(req.usuario.idUsuario);

            if (!usuario) {
                return res.status(404).json({
                    error: 'USUARIO_NO_ENCONTRADO',
                    mensaje: 'Usuario no encontrado'
                });
            }

            // Validar contraseña
            const passwordValido = await Usuario.validarPassword(password, usuario.password);

            if (!passwordValido) {
                return res.status(401).json({
                    error: 'PASSWORD_INCORRECTO',
                    mensaje: 'La contraseña actual no es correcta'
                });
            }

            res.json({
                mensaje: 'Contraseña válida',
                valida: true
            });

        } catch (error) {
            console.error('❌ Error al validar password:', error);
            res.status(500).json({
                error: 'ERROR_VALIDACION',
                mensaje: 'Error al validar contraseña'
            });
        }
    },

    solicitarCodigoCambioPassword: async (req, res) => {
        try {
            const idUsuario = req.usuario.idUsuario;

            const Usuario = require('../models/usuario');
            const verificacionService = require('../services/verificacion.service');
            const emailService = require('../services/email.service');

            // Verificar que el usuario existe
            const usuario = await Usuario.buscarPorId(idUsuario);

            if (!usuario) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            // Verificar cooldown
            const cooldownCheck = await verificacionService.puedeReenviarCodigo(idUsuario);
            if (!cooldownCheck.puede) {
                return res.status(429).json({
                    error: 'Debes esperar antes de solicitar otro código',
                    message: cooldownCheck.message,
                    segundosRestantes: cooldownCheck.segundosRestantes
                });
            }

            // Verificar límite diario
            const limiteCheck = await verificacionService.verificarLimiteDiario(idUsuario);
            if (!limiteCheck.permitido) {
                return res.status(429).json({
                    error: 'Límite de códigos alcanzado',
                    message: limiteCheck.message
                });
            }

            // Generar nuevo código
            const codigo = verificacionService.generarCodigo();
            const ipCliente = req.ip || req.connection.remoteAddress;

            await verificacionService.guardarCodigo(idUsuario, codigo, ipCliente);

            // Enviar email específico para cambio de contraseña
            await emailService.enviarCodigoCambioPassword(
                usuario.email,
                usuario.nombre,
                codigo
            );

            console.log(`📧 Código para cambio de contraseña enviado a usuario ${idUsuario}`);

            res.json({
                mensaje: 'Código enviado exitosamente',
                emailEnviado: true
            });

        } catch (error) {
            console.error('❌ Error al solicitar código:', error);
            res.status(500).json({
                error: 'Error al solicitar código',
                detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    obtenerPerfilPublico: async (req, res) => {
        try {
            const { idUsuario } = req.params;

            if (!idUsuario || isNaN(idUsuario)) {
                return res.status(400).json({ error: 'ID de usuario inválido' });
            }

            const usuario = await Usuario.buscarPorId(parseInt(idUsuario));

            if (!usuario) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            // ✅ No enviar datos sensibles
            delete usuario.password;

            res.json(usuario);
        } catch (error) {
            console.error('Error al obtener perfil público:', error);
            res.status(500).json({ error: 'Error al obtener perfil' });
        }
    },
    // ============================================
    // SOLICITAR RECUPERACIÓN DE CONTRASEÑA (NUEVO)
    // ============================================
    // ============================================
    // SOLICITAR RECUPERACIÓN DE CONTRASEÑA (CORREGIDO)
    // ============================================
    solicitarRecuperacionPassword: async (req, res) => {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    error: 'EMAIL_REQUERIDO',
                    mensaje: 'El email es requerido'
                });
            }

            const Usuario = require('../models/usuario');
            const verificacionService = require('../services/verificacion.service');
            const emailService = require('../services/email.service');

            // Buscar usuario por email
            const usuario = await Usuario.buscarPorEmail(email);

            // Por seguridad, siempre responder exitosamente aunque el email no exista
            if (!usuario) {
                return res.json({
                    mensaje: 'Si el email existe, recibirás un código de recuperación',
                    emailEnviado: false
                });
            }

            // Verificar cooldown
            const cooldownCheck = await verificacionService.puedeReenviarCodigo(usuario.idUsuario);
            if (!cooldownCheck.puede) {
                return res.status(429).json({
                    error: 'COOLDOWN_ACTIVO',
                    mensaje: cooldownCheck.message,
                    segundosRestantes: cooldownCheck.segundosRestantes
                });
            }

            // Verificar límite diario
            const limiteCheck = await verificacionService.verificarLimiteDiario(usuario.idUsuario);
            if (!limiteCheck.permitido) {
                return res.status(429).json({
                    error: 'LIMITE_ALCANZADO',
                    mensaje: limiteCheck.message
                });
            }

            // Generar código
            const codigo = verificacionService.generarCodigo();
            const ipCliente = req.ip || req.connection.remoteAddress;

            await verificacionService.guardarCodigo(usuario.idUsuario, codigo, ipCliente);

            // 🔥 CAMBIO AQUÍ: Usar el nuevo método
            await emailService.enviarCodigoRecuperacionPassword(
                usuario.email,
                usuario.nombre,
                codigo
            );

            console.log(`📧 Código de recuperación enviado a: ${email}`);

            res.json({
                mensaje: 'Código de recuperación enviado exitosamente',
                emailEnviado: true,
                // Por seguridad, incluir datos ofuscados
                emailOfuscado: email.replace(/(.{3})(.*)(@.*)/, '$1***$3')
            });

        } catch (error) {
            console.error('❌ Error al solicitar recuperación:', error);
            res.status(500).json({
                error: 'ERROR_SERVIDOR',
                mensaje: 'Error al procesar la solicitud'
            });
        }
    },

    // ============================================
    // VERIFICAR CÓDIGO DE RECUPERACIÓN (NUEVO)
    // ============================================
    verificarCodigoRecuperacion: async (req, res) => {
        try {
            const { email, codigo } = req.body;

            if (!email || !codigo) {
                return res.status(400).json({
                    error: 'DATOS_INCOMPLETOS',
                    mensaje: 'Email y código son requeridos'
                });
            }

            if (codigo.length !== 6) {
                return res.status(400).json({
                    error: 'CODIGO_INVALIDO',
                    mensaje: 'El código debe tener 6 dígitos'
                });
            }

            const Usuario = require('../models/usuario');
            const verificacionService = require('../services/verificacion.service');

            // Buscar usuario
            const usuario = await Usuario.buscarPorEmail(email);

            if (!usuario) {
                return res.status(404).json({
                    error: 'USUARIO_NO_ENCONTRADO',
                    mensaje: 'Usuario no encontrado'
                });
            }

            // Verificar código
            const resultado = await verificacionService.verificarCodigo(usuario.idUsuario, codigo);

            if (!resultado.success) {
                let statusCode = 400;
                if (resultado.error === 'EXPIRADO') statusCode = 410;
                if (resultado.error === 'NO_CODIGO') statusCode = 404;

                return res.status(statusCode).json({
                    error: resultado.error,
                    mensaje: resultado.message,
                    intentosRestantes: resultado.intentosRestantes
                });
            }

            // ✅ Código válido - generar token temporal para cambio de contraseña
            const jwt = require('jsonwebtoken');
            const SECRET_KEY = process.env.JWT_SECRET || 'tu_clave_secreta_aqui';

            const tokenTemporal = jwt.sign(
                {
                    idUsuario: usuario.idUsuario,
                    email: usuario.email,
                    tipo: 'recuperacion_password'
                },
                SECRET_KEY,
                { expiresIn: '15m' } // Solo 15 minutos para cambiar la contraseña
            );

            console.log(`✅ Código de recuperación verificado para usuario ${usuario.idUsuario}`);

            res.json({
                mensaje: 'Código verificado correctamente',
                tokenTemporal: tokenTemporal,
                idUsuario: usuario.idUsuario
            });

        } catch (error) {
            console.error('❌ Error al verificar código de recuperación:', error);
            res.status(500).json({
                error: 'ERROR_SERVIDOR',
                mensaje: 'Error al verificar el código'
            });
        }
    },

    // ============================================
    // ESTABLECER NUEVA CONTRASEÑA (NUEVO)
    // ============================================
    establecerNuevaPassword: async (req, res) => {
        try {
            const { tokenTemporal, nuevaPassword } = req.body;

            if (!tokenTemporal || !nuevaPassword) {
                return res.status(400).json({
                    error: 'DATOS_INCOMPLETOS',
                    mensaje: 'Token y nueva contraseña son requeridos'
                });
            }

            if (nuevaPassword.length < 6) {
                return res.status(400).json({
                    error: 'PASSWORD_INVALIDA',
                    mensaje: 'La contraseña debe tener al menos 6 caracteres'
                });
            }

            const jwt = require('jsonwebtoken');
            const bcrypt = require('bcrypt');
            const db = require('../config/config');
            const SECRET_KEY = process.env.JWT_SECRET || 'tu_clave_secreta_aqui';

            // Verificar token temporal
            let decoded;
            try {
                decoded = jwt.verify(tokenTemporal, SECRET_KEY);
            } catch (error) {
                return res.status(401).json({
                    error: 'TOKEN_INVALIDO',
                    mensaje: 'Token inválido o expirado'
                });
            }

            // Verificar que sea un token de recuperación
            if (decoded.tipo !== 'recuperacion_password') {
                return res.status(403).json({
                    error: 'TOKEN_NO_AUTORIZADO',
                    mensaje: 'Token no autorizado para esta operación'
                });
            }

            // Hashear nueva contraseña
            const hashedPassword = await bcrypt.hash(nuevaPassword, 10);

            // Actualizar contraseña
            const [result] = await db.query(
                'UPDATE usuario SET password = ? WHERE idUsuario = ?',
                [hashedPassword, decoded.idUsuario]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    error: 'USUARIO_NO_ENCONTRADO',
                    mensaje: 'Usuario no encontrado'
                });
            }

            console.log(`✅ Contraseña actualizada para usuario ${decoded.idUsuario}`);

            // Generar nuevo token de sesión normal
            const tokenSesion = jwt.sign(
                {
                    idUsuario: decoded.idUsuario,
                    email: decoded.email
                },
                SECRET_KEY,
                { expiresIn: '7d' }
            );

            res.json({
                mensaje: 'Contraseña actualizada exitosamente',
                token: tokenSesion
            });

        } catch (error) {
            console.error('❌ Error al establecer nueva contraseña:', error);
            res.status(500).json({
                error: 'ERROR_SERVIDOR',
                mensaje: 'Error al actualizar la contraseña'
            });
        }
    }
};

module.exports = UsuarioController;