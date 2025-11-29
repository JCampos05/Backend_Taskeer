const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.resend.com',
    port: parseInt(process.env.EMAIL_PORT || '465'),
    secure: process.env.EMAIL_SECURE === 'true', // true para puerto 465
    auth: {
        user: process.env.EMAIL_USER || 'resend',
        pass: process.env.EMAIL_PASSWORD
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
});

// Verificación al iniciar
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Error al conectar con Resend:', error.message);
        console.error('📋 Config:', {
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            user: process.env.EMAIL_USER,
            hasApiKey: !!process.env.EMAIL_PASSWORD
        });
    } else {
        console.log('✅ Resend listo para enviar emails');
    }
});

module.exports = transporter;