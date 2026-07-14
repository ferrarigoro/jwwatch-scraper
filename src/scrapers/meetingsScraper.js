// src/scrapers/meetingsScraper.js

async function scrapeWatchtowerLink(page, url) {
    console.log(`Buscando enlace de La Atalaya en: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    return await page.evaluate(() => {
        const result = { weekRange: "", link: "", hasArticle: false };
        const headerStrong = document.querySelector('header strong');
        const h1 = document.querySelector('h1');

        if (headerStrong) {
            const fullDate = headerStrong.innerText.trim();
            result.weekRange = fullDate.replace(/\s+de\s+\d{4}/i, '').trim();
        } else if (h1) {
            result.weekRange = h1.innerText.trim();
        }

        const headers = document.querySelectorAll('h2');
        for (let i = 0; i < headers.length; i++) {
            if (headers[i].innerText.toLowerCase().includes('atalaya')) {
                let sibling = headers[i].nextElementSibling;
                while (sibling) {
                    if (sibling.tagName === 'UL' || sibling.classList.contains('directory')) {
                        const aTag = sibling.querySelector('a');
                        if (aTag && aTag.href && aTag.href.includes('/wol/d/')) {
                            result.link = aTag.href;
                            result.hasArticle = true;
                            break;
                        }
                    }
                    sibling = sibling.nextElementSibling;
                }
                break;
            }
        }
        return result;
    });
}

async function scrapeWatchtowerData(page, url) {
    console.log(`Extrayendo artículo de La Atalaya: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    return await page.evaluate(() => {
        function getText(el) { return el ? el.innerText.trim() : ''; }

        const title = getText(document.querySelector('h1'));
        const song1 = getText(document.getElementById('tt4'));
        const themeScrp = getText(document.getElementById('tt8'));
        const theme = getText(document.getElementById('tt10')).replace(/^TEMA\s*/i, '').trim();

        let weekRange = "";
        const strongs = document.querySelectorAll('header strong');
        for (let i = 0; i < strongs.length; i++) {
            const txt = strongs[i].innerText.trim();
            if (/\d/.test(txt) && txt.toUpperCase().includes('DE')) {
                weekRange = txt.replace(/[\s\u00A0]+de[\s\u00A0]+\d{4}/i, '').trim();
                break;
            }
        }

        let song2 = getText(document.getElementById('tt37'));
        if (!song2.includes('CANCIÓN')) {
            const allP = document.querySelectorAll('p');
            for(let i = allP.length - 1; i >= 0; i--) {
                if(allP[i].innerText.includes('CANCIÓN')) {
                    song2 = allP[i].innerText.trim();
                    break;
                }
            }
        }

        const reviewItems = [];
        let reviewTitle = "";
        const teachBlock = document.querySelector('.blockTeach');

        if (teachBlock) {
            const heading = teachBlock.querySelector('h2, h3, h4');
            reviewTitle = heading ? getText(heading) : "¿Qué respondería?";

            let items = teachBlock.querySelectorAll('li');
            if (items.length === 0) items = teachBlock.querySelectorAll('p');

            let count = 0;
            for (let k = 0; k < items.length && count < 3; k++) {
                const txt = getText(items[k]);
                if (txt.length > 5 && txt !== reviewTitle && !txt.toLowerCase().includes('canción')) {
                    reviewItems.push(txt.split(/\s*Respuesta/i)[0].trim());
                    count++;
                }
            }
            teachBlock.parentNode.removeChild(teachBlock);
        }

        const blocks = [];
        const articleContainer = document.querySelector('.article') || document.querySelector('.bodyTxt') || document.body;
        const elements = articleContainer.querySelectorAll('h2, h3, figure img');

        for(let j = 0; j < elements.length; j++) {
            const el = elements[j];
            const tag = el.tagName.toUpperCase();

            if (tag === 'H2' || tag === 'H3') {
                const text = getText(el);
                if(text.length > 0 && text !== title) blocks.push({ type: 'subtitle', content: text });
            } else if (tag === 'IMG') {
                const src = el.src || el.getAttribute('data-img-uri') || '';
                if (src) blocks.push({ type: 'image', url: src });
            }
        }

        return { title, weekRange, themeScripture: themeScrp, theme, song1, song2, source: "", contentBlocks: blocks, reviewTitle, reviewItems };
    });
}

async function scrapeMidweekLink(page, url) {
    console.log(`Buscando enlace de Vida y Ministerio en: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    return await page.evaluate(() => {
        const result = { link: "", hasMeeting: false };
        const headers = document.querySelectorAll('h2');
        for (let i = 0; i < headers.length; i++) {
            if (headers[i].innerText.toLowerCase().includes('ministerio')) {
                let sibling = headers[i].nextElementSibling;
                while (sibling) {
                    if (sibling.tagName === 'UL' || sibling.classList.contains('directory')) {
                        const aTag = sibling.querySelector('a');
                        if (aTag && aTag.href && aTag.href.includes('/wol/d/')) {
                            result.link = aTag.href;
                            result.hasMeeting = true;
                            break;
                        }
                    }
                    sibling = sibling.nextElementSibling;
                }
                break;
            }
        }
        return result;
    });
}

async function scrapeMidweekData(page, url) {
    console.log(`Extrayendo datos de Vida y Ministerio: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    return await page.evaluate(() => {
        function getText(el) { return el ? (el.innerText || el.textContent).replace(/\s+/g, ' ').trim() : ''; }
        
        function extractMedia(element, obj, prepend) {
            if(!element) return;
            const links = element.querySelectorAll('a');
            for(let v=0; v<links.length; v++) {
                const href = links[v].href;
                if(href && (href.toLowerCase().includes('video') || getText(links[v]).toLowerCase().includes('video'))) {
                    if (prepend) obj.videos.unshift(href); else obj.videos.push(href);
                }
            }
            const imgs = element.querySelectorAll('img');
            for(let i=0; i<imgs.length; i++) {
                const src = imgs[i].src || imgs[i].getAttribute('data-img-uri');
                if(src) {
                    if (prepend) obj.images.unshift({ type: 'image', url: src }); else obj.images.push({ type: 'image', url: src });
                }
            }
        }

        const result = { weekRange: '', bibleReading: '', songs: [], treasures: [], ministry: [], life: [] };
        let currentSection = 0;
        const allElements = document.querySelectorAll('h1, h2, h3, h4, strong, p.themeScrp');
        const processedNums = [];
        let passedH1 = false;

        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            const txt = getText(el);
            if (!txt) continue;

            if (el.tagName === 'H1') {
                result.weekRange = txt;
                passedH1 = true;
                continue;
            }

            if (passedH1 && result.bibleReading === '' && result.songs.length === 0) {
                const lower = txt.toLowerCase();
                if (!lower.includes('canción') && !lower.includes('tesoros') && !lower.includes('semana') && txt !== result.weekRange && txt.length > 3) {
                    result.bibleReading = txt;
                    continue;
                }
            }

            if (el.tagName === 'H2') {
                const lower = txt.toLowerCase();
                if (lower.includes('maestros')) currentSection = 1;
                if (lower.includes('vida cristiana')) currentSection = 2;
                continue;
            }

            const songRegex = /canción\s+\d+/i;
            if (songRegex.test(txt)) {
                let cleanSong = txt;
                if (txt.includes('|')) {
                    const parts = txt.split('|');
                    for (let p = 0; p < parts.length; p++) {
                        if (songRegex.test(parts[p])) { cleanSong = parts[p].trim(); break; }
                    }
                } else { cleanSong = cleanSong.trim(); }
                
                const songNumMatch = cleanSong.match(/\d+/);
                if (songNumMatch) cleanSong = songNumMatch[0];
                
                if (result.songs.length === 0 || result.songs[result.songs.length - 1] !== cleanSong) {
                    result.songs.push(cleanSong);
                }
                continue;
            }

            const match = txt.match(/^(\d+)\.\s*(.*)/);
            if (match) {
                const num = parseInt(match[1]);
                const cleanTitle = match[2];
                if (processedNums.indexOf(num) !== -1) continue; 
                processedNums.push(num);

                let container = el;
                if (el.tagName === 'STRONG') container = el.parentElement;

                const itemObj = { number: num, title: cleanTitle, duration: null, extra: "", videos: [], images: [] };

                if (num === 1) {
                    let prev = container.previousElementSibling;
                    while (prev && !['H1', 'H2', 'H3', 'H4'].includes(prev.tagName)) {
                        if (prev.querySelector('strong') && getText(prev.querySelector('strong')).match(/^\d+\./)) break;
                        extractMedia(prev, itemObj, true); 
                        prev = prev.previousElementSibling;
                    }
                }

                const extraParts = [];
                function processLines(rawText, isFirstContainer) {
                    const lines = rawText.split('\n');
                    for (let l = 0; l < lines.length; l++) {
                        let line = lines[l].trim().replace(/\s{2,}/g, ' ');
                        if (!line) continue;
                        if (isFirstContainer && l === 0) {
                            const titleMatch = line.match(/^\d+\.\s*([^:]+):?(.*)/);
                            if (titleMatch) {
                                line = titleMatch[2].trim();
                            } else {
                                line = line.replace(/^\d+\.\s*/, '');
                                if (line.startsWith(cleanTitle)) line = line.substring(cleanTitle.length).trim();
                            }
                            if (line.startsWith(':') || line.startsWith('-')) line = line.substring(1).trim();
                        }
                        line = line.replace(/\bRespuesta\b:?/ig, '').trim();
                        if (!line) continue;
                        if ((line.startsWith('¿') || line.endsWith('?')) && !line.startsWith('•')) line = '• ' + line;
                        extraParts.push(line);
                    }
                }

                processLines(container.innerText || container.textContent || '', true);
                extractMedia(container, itemObj, false);

                let sibling = container.nextElementSibling;
                while (sibling && !['H1', 'H2', 'H3', 'H4'].includes(sibling.tagName)) {
                    if (sibling.querySelector('strong') && getText(sibling.querySelector('strong')).match(/^\d+\./)) break;
                    const sibLower = getText(sibling).toLowerCase();
                    if (sibLower.includes('seamos mejores maestros') || sibLower.includes('nuestra vida cristiana')) break;
                    processLines(sibling.innerText || sibling.textContent || '', false);
                    extractMedia(sibling, itemObj, false);
                    sibling = sibling.nextElementSibling;
                }

                itemObj.videos = [...new Set(itemObj.videos)];
                const uniqueImages = [];
                const seenUrls = new Set();
                for (let imgIdx = 0; imgIdx < itemObj.images.length; imgIdx++) {
                    const imgUrl = itemObj.images[imgIdx].url;
                    if (!seenUrls.has(imgUrl)) {
                        seenUrls.add(imgUrl);
                        uniqueImages.push(itemObj.images[imgIdx]);
                    }
                }
                itemObj.images = uniqueImages;

                let extraInfo = extraParts.join('\n\n').trim();
                if (extraInfo.toLowerCase().includes('seamos mejores maestros')) extraInfo = extraInfo.split(/seamos mejores maestros/i)[0].trim();
                if (extraInfo.toLowerCase().includes('nuestra vida cristiana')) extraInfo = extraInfo.split(/nuestra vida cristiana/i)[0].trim();

                const timeMatch = extraInfo.match(/^\((\d+)\s*min(?:s)?\.?\)/i);
                if (timeMatch) {
                    itemObj.duration = timeMatch[1].trim();
                    extraInfo = extraInfo.replace(timeMatch[0], '').trim();
                    if (extraInfo.startsWith(':') || extraInfo.startsWith('-')) extraInfo = extraInfo.substring(1).trim();
                }
                itemObj.extra = extraInfo;

                if (currentSection === 0) result.treasures.push(itemObj);
                else if (currentSection === 1) result.ministry.push(itemObj);
                else if (currentSection === 2) result.life.push(itemObj);
            }
        }
        return result;
    });
}

module.exports = { scrapeWatchtowerLink, scrapeWatchtowerData, scrapeMidweekLink, scrapeMidweekData };