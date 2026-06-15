const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const axios = require('axios');

let isFontLoaded = false;

async function createCustomImage(type, member, bgUrl) {
    // 1. Download font otomatis agar teks muncul di Railway
    if (!isFontLoaded) {
        try {
            const fontRes = await axios.get('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf', { responseType: 'arraybuffer' });
            GlobalFonts.register(fontRes.data, 'Roboto');
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
        console.error(`⚠️ Gagal meload background:`, err.message);
        ctx.fillStyle = '#2f3136'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Styling Teks & Efek Shadow agar tidak nyatu dengan background
    ctx.fillStyle = '#ffffff'; 
    ctx.textAlign = 'center';  
    ctx.shadowColor = 'black'; // Bayangan hitam
    ctx.shadowBlur = 7;        // Kehalusan bayangan
    ctx.lineWidth = 5;
    
    // Teks Utama
    ctx.font = 'bold 50px Roboto';
    ctx.fillText(type === 'welcome' ? 'WELCOME' : 'GOOD BYE', canvas.width / 2, 100);
    
    // Teks Username
    ctx.font = 'bold 40px Roboto'; 
    const username = member.user ? member.user.username : 'Unknown';
    ctx.fillText(username, canvas.width / 2, 170); // Posisi sedikit diturunkan

    return canvas.encodeSync('png');
}

module.exports = { createCustomImage };
