/**
 * Obtener URL del frontend según entorno
 */
function obtenerFrontendUrl() {
    const nodeEnv = process.env.NODE_ENV || 'development';

    if (nodeEnv === 'production') {
        return process.env.FRONTEND_URL_PROD || 'https://taskeer.onrender.com';
    }

    // En desarrollo, usar la primera URL de la lista
    const urlsDev = process.env.FRONTEND_URL_DEV || 'http://localhost:4200';
    return urlsDev.split(',')[0].trim();
}

/**
 * Obtener todas las URLs permitidas para CORS
 */
function obtenerUrlsPermitidas() {
    const nodeEnv = process.env.NODE_ENV || 'development';

    if (nodeEnv === 'production') {
        const urlProd = process.env.FRONTEND_URL_PROD;
        return urlProd ? [urlProd] : ['https://taskeer.onrender.com'];
    }

    // En desarrollo, retornar array de todas las URLs
    const urlsDev = process.env.FRONTEND_URL_DEV || 'http://localhost:4200';
    return urlsDev.split(',').map(url => url.trim());
}

module.exports = {
    obtenerFrontendUrl,
    obtenerUrlsPermitidas
};