const axios = require('axios');
const { launchBrowser } = require('./config/puppeteer.config');
const { scrapeDailyText } = require('./scrapers/dailyTextScraper');
const { scrapeWatchtowerLink, scrapeWatchtowerData, scrapeMidweekLink, scrapeMidweekData } = require('./scrapers/meetingsScraper');
const { scrapeSongs } = require('./scrapers/songsScraper');
const { processMediaInBlocks, processMeetingItemsMedia } = require('./utils/mediaProcessor');
const { saveJson } = require('./utils/fileSystem');
const { generateQuizPayload } = require('./services/quizGenerator');

function getWeekData(weekOffset = 0) {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff + (weekOffset * 7))); // Sumamos las semanas

    const year = monday.getFullYear();
    const month = (monday.getMonth() + 1).toString().padStart(2, '0');
    const date = monday.getDate().toString().padStart(2, '0');
    const weekId = parseInt(`${year}${month}${date}`);

    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (monday - firstDayOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

    return { year, weekNumber, weekId };
}

async function main() {
    console.log("Iniciando motor de extracción por lotes (Batch)...");
    const browser = await launchBrowser();

    try {
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        // ==========================================
        // 1. LOTE DE TEXTOS DIARIOS (Próximos 15 días)
        // ==========================================
        for (let i = -2; i < 15; i++) {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + i);

            const year = targetDate.getFullYear();
            const month = targetDate.getMonth() + 1;
            const day = targetDate.getDate();
            const dUrl = `https://wol.jw.org/es/wol/h/r4/lp-s/${year}/${month}/${day}`;

            const dailyTextData = await scrapeDailyText(page, dUrl);
            const dateId = parseInt(`${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`);

            await saveJson(`daily_text_${dateId}.json`, {
                dateId, dateHeading: dailyTextData.scrapedDate, scriptureDetails: dailyTextData.scripture, body: dailyTextData.body, additionalInfo: dailyTextData.additional || null
            });
        }

        // ==========================================
        // 2. LOTE DE REUNIONES (Semana actual + 4 semanas a futuro)
        // ==========================================
        for (let w = 0; w < 5; w++) {
            const { year, weekNumber, weekId } = getWeekData(w);
            const meetingsUrl = `https://wol.jw.org/es/wol/meetings/r4/lp-s/${year}/${weekNumber}`;
            console.log(`\nProcesando Semana ${weekNumber} (${year})...`);

            let weeklySongsRaw = [];
            let finalWtModel = null;
            let finalVymModel = null;

            // --- LA ATALAYA ---
            const wtLinkData = await scrapeWatchtowerLink(page, meetingsUrl);
            if (wtLinkData.hasArticle && wtLinkData.link) {
                const wtData = await scrapeWatchtowerData(page, wtLinkData.link);
                weeklySongsRaw.push(wtData.song1, wtData.song2);
                await processMediaInBlocks(wtData.contentBlocks);
                finalWtModel = {
                    weekId, weekRange: wtData.weekRange || wtLinkData.weekRange, hasArticle: true, articleLink: wtLinkData.link, title: wtData.title, themeScripture: wtData.themeScripture || null, theme: wtData.theme || null, source: wtData.source || null, articleContent: wtData.contentBlocks, reviewTitle: wtData.reviewTitle || null, reviewItems: wtData.reviewItems || null
                };
            } else {
                finalWtModel = { weekId, weekRange: wtLinkData.weekRange || `Semana ${weekNumber}`, hasArticle: false };
            }

            // --- VIDA Y MINISTERIO ---
            const vymLinkData = await scrapeMidweekLink(page, meetingsUrl);
            if (vymLinkData.hasMeeting && vymLinkData.link) {
                const vymData = await scrapeMidweekData(page, vymLinkData.link);
                if (vymData.songs) weeklySongsRaw.push(...vymData.songs);
                await processMeetingItemsMedia(vymData.treasures);
                await processMeetingItemsMedia(vymData.ministry);
                await processMeetingItemsMedia(vymData.life);
                finalVymModel = {
                    weekId, weekRange: vymData.weekRange || wtLinkData.weekRange, meetingLink: vymLinkData.link, bibleReading: vymData.bibleReading || null, hasMeeting: true, treasuresItems: vymData.treasures, ministryItems: vymData.ministry, lifeItems: vymData.life
                };
            } else {
                finalVymModel = { weekId, weekRange: vymLinkData.weekRange || `Semana ${weekNumber}`, hasMeeting: false };
            }

            // --- CANCIONES Y ENSAMBLAJE FINAL ---
            const processedSongs = await scrapeSongs(page, weeklySongsRaw);
            if (finalWtModel && finalWtModel.hasArticle) finalWtModel.songs = processedSongs ? processedSongs.filter(s => weeklySongsRaw.slice(0, 2).map(r => r.replace(/\D/g, '')).includes(s.number)) : null;
            if (finalVymModel && finalVymModel.hasMeeting) finalVymModel.songs = processedSongs ? processedSongs.filter(s => weeklySongsRaw.slice(2).map(r => r.replace(/\D/g, '')).includes(s.number)) : null;

            if (finalWtModel) await saveJson(`watchtower_${weekId}.json`, finalWtModel);
            if (finalVymModel) await saveJson(`midweek_${weekId}.json`, finalVymModel);

            // ==========================================
            // GENERACIÓN DE QUIZZES (Desde Banco CSV Privado)
            // ==========================================
            try {
                const quizFileName = `quiz_${weekId}.json`;
                const liveUrl = `https://ferrarigoro.github.io/jwwatch-scraper/${quizFileName}`;
                let finalQuizzes = null;

                // 1. Intentamos recuperar el quiz de nuestra propia web
                try {
                    const cacheResponse = await axios.get(liveUrl);
                    finalQuizzes = cacheResponse.data;
                    console.log(`✅ Caché HIT: Quiz de la semana ${weekId} recuperado de GitHub Pages.`);
                } catch (cacheError) {
                    // 2. Si no existe en la web, lo ensamblamos desde el CSV privado
                    console.log(`⚠️ Caché MISS: Ensamblando nuevo Quiz ${weekId} desde el archivo CSV...`);
                    finalQuizzes = await generateQuizPayload(weekId);
                }

                // 3. Guardamos el archivo localmente para que se publique en Pages
                if (finalQuizzes) {
                    await saveJson(quizFileName, finalQuizzes);
                }

            } catch (e) {
                console.error(`❌ Error procesando Quizzes de la semana ${weekId}:`, e);
            }
        }

    } catch (error) {
        console.error("Error crítico durante la extracción:", error);
    } finally {
        await browser.close();
        console.log("Proceso de Lote (Batch) finalizado exitosamente.");
    }
}

main();