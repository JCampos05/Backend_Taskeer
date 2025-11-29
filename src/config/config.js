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
    ssl: process.env.DB_HOST ? {
        rejectUnauthorized: false
    } : undefined
};

// Configuración de respaldo (localhost - desarrollo)
const fallbackConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456789', // Ajusta según tu configuración local
    database: 'taskeer', // Ajusta el nombre de tu BD local
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool = null;
let isUsingFallback = false;
let isInitialized = false;

// Función para crear pool con una configuración específica
const createPool = (config) => {
    return mysql.createPool(config);
};

// Intentar conexión con una configuración
const tryConnection = async (config, configName) => {
    try {
        const testPool = createPool(config);
        const connection = await testPool.getConnection();
        console.log(`✅ Conexión exitosa usando ${configName}`);
        connection.release();
        return testPool;
    } catch (error) {
        console.error(`❌ Falló conexión con ${configName}:`, error.message);
        return null;
    }
};

// Inicializar conexión con fallback de forma síncrona al inicio
const initializeConnection = async () => {
    if (isInitialized) return pool;
    
    try {
        // Primero intentar con configuración primaria (Aiven)
        if (process.env.DB_HOST) {
            console.log('🔄 Intentando conectar con Aiven...');
            pool = await tryConnection(primaryConfig, 'Aiven (Producción)');
        }
        
        // Si falla, intentar con localhost
        if (!pool) {
            console.log('🔄 Intentando conectar con localhost...');
            pool = await tryConnection(fallbackConfig, 'Localhost (Desarrollo)');
            isUsingFallback = true;
        }
        
        // Si ambas fallan, salir
        if (!pool) {
            console.error('❌ No se pudo conectar a ninguna base de datos');
            process.exit(1);
        }
        
        if (isUsingFallback) {
            console.log('⚠️  ADVERTENCIA: Usando base de datos local de respaldo');
        }
        
        isInitialized = true;
        return pool;
        
    } catch (error) {
        console.error('❌ Error crítico al inicializar conexión:', error.message);
        process.exit(1);
    }
};

// Inicializar inmediatamente al cargar el módulo
const poolPromise = initializeConnection();

// Exportar el pool con un getter que espera la inicialización
module.exports = new Proxy({}, {
    get(target, prop) {
        if (prop === 'getConnection') {
            return async (...args) => {
                if (!isInitialized) {
                    await poolPromise;
                }
                return pool.getConnection(...args);
            };
        }
        
        if (prop === 'query') {
            return async (...args) => {
                if (!isInitialized) {
                    await poolPromise;
                }
                return pool.query(...args);
            };
        }
        
        if (prop === 'execute') {
            return async (...args) => {
                if (!isInitialized) {
                    await poolPromise;
                }
                return pool.execute(...args);
            };
        }
        
        if (prop === 'end') {
            return async (...args) => {
                if (!isInitialized) {
                    await poolPromise;
                }
                return pool.end(...args);
            };
        }
        
        if (prop === 'isUsingFallback') {
            return () => isUsingFallback;
        }
        
        // Para cualquier otra propiedad, esperar inicialización
        if (!isInitialized) {
            throw new Error('Pool de conexiones aún no inicializado. Usa await en métodos asíncronos.');
        }
        
        return pool[prop];
    }
});

module.exports.waitForInitialization = () => poolPromise;