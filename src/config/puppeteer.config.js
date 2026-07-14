const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Activamos el plugin de evasión
puppeteer.use(StealthPlugin());

/**
 * Inicializa y retorna una instancia de navegador lista para usar.
 */
async function launchBrowser() {
    return await puppeteer.launch({
        headless: "new", // Usa el nuevo modo headless de Chrome, es más difícil de detectar
        args: [
            '--no-sandbox', // Obligatorio para entornos CI/CD como GitHub Actions
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage', // Evita cuelgues por falta de memoria compartida en contenedores
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ],
        // Opcional: Podemos forzar un User-Agent móvil si el diseño del sitio facilita la extracción
        // como lo hacías en tu WebView original.
        defaultViewport: {
            width: 1280,
            height: 720,
            isMobile: false
        }
    });
}

module.exports = { launchBrowser };