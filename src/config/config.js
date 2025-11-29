const mysql = require('mysql2/promise');

// Configuración primaria (Aiven - producción)
const primaryConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
};

// Configuración de respaldo (localhost - desarrollo)
const fallbackConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456789', // Ajusta según tu configuración local
    database: 'tasker', // Ajusta el nombre de tu BD local
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool;
let isUsingFallback = false;

// Función para crear pool con una configuración específica
const createPool = (config) => {
    return mysql.createPool(config);
};

// Intentar conexión con una configuración
const tryConnection = async (config, configName) => {
    try {
        const testPool = createPool(config);
        const connection = await testPool.getConnection();
        console.log(`Conexión exitosa usando ${configName}`);
        connection.release();
        return testPool;
    } catch (error) {
        console.error(`Falló conexión con ${configName}:`, error.message);
        return null;
    }
};

// Inicializar conexión con fallback
const initializeConnection = async () => {
    try {
        // Primero intentar con configuración primaria (Aiven)
        console.log('Intentando conectar con Aiven...');
        pool = await tryConnection(primaryConfig, 'Aiven (Producción)');
        
        // Si falla, intentar con localhost
        if (!pool) {
            console.log('Intentando conectar con localhost...');
            pool = await tryConnection(fallbackConfig, 'Localhost (Desarrollo)');
            isUsingFallback = true;
        }
        
        // Si ambas fallan, salir
        if (!pool) {
            console.error('No se pudo conectar a ninguna base de datos');
            process.exit(1);
        }
        
        if (isUsingFallback) {
            console.log('ADVERTENCIA: Usando base de datos local de respaldo');
        }
        
    } catch (error) {
        console.error('Error crítico al inicializar conexión:', error.message);
        process.exit(1);
    }
};

// Ejecutar inicialización
initializeConnection();

// Exportar el pool (se asignará después de la inicialización)
module.exports = new Proxy({}, {
    get(target, prop) {
        if (!pool) {
            throw new Error('Pool de conexiones aún no inicializado');
        }
        return pool[prop];
    }
});

// Exportar función para verificar si está usando fallback
module.exports.isUsingFallback = () => isUsingFallback;