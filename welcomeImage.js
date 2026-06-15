const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const axios = require('axios');

let isFontLoaded = false;

async function createCustomImage(type, member, bgUrl) {
    // Mengunduh font "Great Vibes" yang bergaya kaligrafi
    if (!isFontLoaded) {
        try {
            const fontRes = await axios.get('https://github.com/google/fonts/raw/main/ofl/greatvibes/GreatVibes-Regular.ttf', { responseType: 'arraybuffer' });
            GlobalFonts.register(fontRes.data, 'GreatVibes');
            isFontLoaded = true;
        } catch (err) {
            console.error('⚠️ Gagal memuat font:', err.message);
        }
    }

    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    const finalBgUrl = bgUrl || 'https://i.postimg.cc/0j2x1X9Z/bg.png';

    try {
        const response = await axios.get(finalBgUrl, { 
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const background = await loadImage(response.data); 
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    } catch (err) {
        ctx.fillStyle = '#2f3136';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Styling Teks dengan Shadow
    ctx.fillStyle = '#ffffff'; 
    ctx.textAlign = 'center';  
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; 
    ctx.shadowBlur = 10;
    
    // Gunakan font 'GreatVibes'
    ctx.font = '70px GreatVibes';
    ctx.fillText(type === 'welcome' ? 'Welcome' : 'Good Bye', canvas.width / 2, 100);
    
    ctx.font = '60px GreatVibes';
    const username = member.user ? member.user.username : 'Unknown';
    ctx.fillText(username, canvas.width / 2, 180);

    return canvas.encodeSync('png');
}

module.exports = { createCustomImage };
