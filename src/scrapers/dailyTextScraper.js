async function scrapeDailyText(page, url) {
    console.log(`Extrayendo texto diario de: ${url}`);
    
    // Navegamos y esperamos a que el DOM esté cargado
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // evaluate() ejecuta este código directamente dentro del navegador
    const data = await page.evaluate(() => {
        const result = {
            scrapedDate: "",
            scripture: "",
            body: "",
            additional: ""
        };

        try {
            // 1. AISLAR EL CONTENEDOR CORRECTO
            const pathMatch = window.location.pathname.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\/?$/);
            let container = null;

            if (pathMatch) {
                const year = pathMatch[1];
                const month = pathMatch[2].padStart(2, '0');
                const day = pathMatch[3].padStart(2, '0');
                const dataDateStr = `${year}-${month}-${day}`;
                
                container = document.querySelector(`[data-date="${dataDateStr}"]`);
            }

            if (!container) {
                container = document.querySelector('.itemActive') || 
                            document.querySelector('.carousel-item.active') || 
                            document.querySelector('.tabContent.active');
            }

            if (!container) {
                container = document;
            }

            // 2. EXTRAER DATOS
            const header = container.querySelector('header h2') || container.querySelector('h2');
            if (header) {
                result.scrapedDate = header.innerText.replace(/\s+/g, ' ').trim();
            }

            const themeEl = container.querySelector('.themeScrp');
            if (themeEl) {
                result.scripture = themeEl.innerText.replace(/\s+/g, ' ').trim();
            } else {
                const firstP = container.querySelector('.article p') || container.querySelector('p');
                if (firstP) result.scripture = firstP.innerText.replace(/\s+/g, ' ').trim();
            }

            const bodyContainer = container.querySelector('.bodyTxt');
            if (bodyContainer) {
                result.body = bodyContainer.innerText.trim();
            } else {
                const bodyParagraphs = container.querySelectorAll('.pGroup p');
                const bodyArr = [];
                for (let i = 0; i < bodyParagraphs.length; i++) {
                    if (!bodyParagraphs[i].classList.contains('themeScrp')) {
                        bodyArr.push(bodyParagraphs[i].innerText.replace(/\s+/g, ' ').trim());
                    }
                }
                result.body = bodyArr.join('\n\n');
            }
        } catch (e) {
            result.additional = "Error JS: " + e.message;
        }

        return result;
    });

    return data;
}

module.exports = { scrapeDailyText };