const { Resend } = require('resend');

// Usar la API HTTP de Resend (funciona en Render)
const resend = new Resend(process.env.RESEND_API_KEY);

// Verificación al iniciar
const verificarResend = async () => {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.error('❌ RESEND_API_KEY no está configurada');
            return;
        }
        
        if (!process.env.RESEND_API_KEY.startsWith('re_')) {
            console.error('❌ RESEND_API_KEY inválida (debe empezar con "re_")');
            return;
        }

        console.log('✅ Resend configurado correctamente');
        console.log('📋 Config:', {
            hasApiKey: !!process.env.RESEND_API_KEY,
            apiKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 5) + '...'
        });
    } catch (error) {
        console.error('❌ Error al verificar Resend:', error.message);
    }
};

verificarResend();

module.exports = resend;