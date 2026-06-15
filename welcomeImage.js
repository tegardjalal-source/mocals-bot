const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const axios = require('axios');

let isFontLoaded = false;

async function createCustomImage(type, member, bgUrl) {
    if (!isFontLoaded) {
        try {
            const fontRes = await axios.get('https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat-Bold.ttf', { responseType: 'arraybuffer' });
            GlobalFonts.register(fontRes.data, 'Montserrat');
            isFontLoaded = true;
        } catch (err) {
            console.error('⚠️ Gagal memuat font:', err.message);
        }
    }

    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    // 1. Gambar Background
    const finalBgUrl = bgUrl || 'https://i.postimg.cc/0j2x1X9Z/bg.png';
    try {
        const response = await axios.get(finalBgUrl, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } });
        const background = await loadImage(response.data); 
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    } catch (err) {
        ctx.fillStyle = '#2f3136';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Gambar Avatar User (Lingkaran)
    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatarRes = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
        const avatar = await loadImage(avatarRes.data);
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(120, 125, 60, 0, Math.PI * 2, true); // Posisi avatar di kiri
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 60, 65, 120, 120);
        ctx.restore();
    } catch (err) {
        console.error('⚠️ Gagal memuat avatar:', err.message);
    }

    // 3. Teks (Digeser ke kanan biar nggak ketabrak avatar)
    ctx.fillStyle = '#ffffff'; 
    ctx.textAlign = 'left'; // Rata kiri
    ctx.shadowColor = 'black'; 
    ctx.shadowBlur = 7;
    
    ctx.font = 'bold 50px Montserrat';
    ctx.fillText(type === 'welcome' ? 'WELCOME' : 'GOOD BYE', 220, 110);
    
    ctx.font = 'bold 40px Montserrat';
    const username = member.user ? member.user.username : 'Unknown';
    ctx.fillText(username, 220, 170);

    return canvas.encodeSync('png');
}

module.exports = { createCustomImage };
