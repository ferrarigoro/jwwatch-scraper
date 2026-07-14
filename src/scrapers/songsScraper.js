async function scrapeSongs(page, rawSongs) {
    // 1. Limpiamos los números (Ej: de "Canción 14" a "14")
    const songNumbers = [...new Set(
        rawSongs.filter(s => s)
                .map(s => String(s).replace(/\D/g, ''))
                .filter(n => n.trim() !== '')
    )];

    if (songNumbers.length === 0) return null;

    console.log(`Buscando enlaces para canciones: ${songNumbers.join(', ')}`);
    const indexUrl = 'https://wol.jw.org/es/wol/publication/r4/lp-s/sjj';
    await page.goto(indexUrl, { waitUntil: 'domcontentloaded' });

    // 2. Obtenemos el mapa de { "14": "https://..." }
    const songLinks = await page.evaluate((targets) => {
        const result = {};
        const links = document.querySelectorAll('a');
        for (let i = 0; i < links.length; i++) {
            const a = links[i];
            if (a.href && a.href.includes('/wol/d/')) {
                const match = a.innerText.trim().match(/(\d+)/);
                if (match) {
                    const num = match[1];
                    if (targets.includes(num) && !result[num]) {
                        result[num] = a.href;
                    }
                }
            }
        }
        return result;
    }, songNumbers);

    // 3. Entramos a cada canción y extraemos la letra
    const songsList = [];
    for (const num of songNumbers) {
        const url = songLinks[num];
        if (url) {
            console.log(`Extrayendo letra de la canción ${num}...`);
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            
            const songData = await page.evaluate(() => {
                const titleEl = document.querySelector('h1');
                const title = titleEl ? titleEl.innerText.replace(/\s+/g, ' ').trim() : '';
                
                const lyricsBlocks = [];
                const targetList = document.querySelector('ol.source');
                if (targetList) {
                    const lis = targetList.querySelectorAll(':scope > li');
                    for (let i = 0; i < lis.length; i++) {
                        const stanzaLines = [];
                        const children = lis[i].children;
                        for (let j = 0; j < children.length; j++) {
                            const child = children[j];
                            const tag = child.tagName.toLowerCase();
                            const text = child.innerText.trim();
                            if (text) {
                                if (tag === 'p') stanzaLines.push(text);
                                else if (tag === 'div') stanzaLines.push('\n' + text);
                            }
                        }
                        if (stanzaLines.length > 0) lyricsBlocks.push(stanzaLines.join('\n').trim());
                    }
                }
                return { title, lyrics: lyricsBlocks.join('\n\n').trim() };
            });

            songsList.push({
                number: num,
                title: songData.title || `Canción ${num}`,
                lyrics: songData.lyrics
            });
        } else {
            console.warn(`⚠️ No se encontró URL para la canción ${num}`);
        }
    }
    return songsList.length > 0 ? songsList : null;
}

module.exports = { scrapeSongs };