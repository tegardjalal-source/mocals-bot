const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const axios = require('axios');

let isFontLoaded = false;

async function createCustomImage(type, member, bgUrl) {
    if (!isFontLoaded) {
        try {
            const fontRes = await axios.get('https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat-Bold.ttf', { responseType: 'arraybuffer' });
            GlobalFonts.register(fontRes.data, 'Montserrat');
            isFontLoaded = true;
        } catch (err) { console.error(err); }
    }

    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    // 1. Background Blur
    const finalBgUrl = bgUrl || 'https://i.postimg.cc/0j2x1X9Z/bg.png';
    try {
        const response = await axios.get(finalBgUrl, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } });
        const background = await loadImage(response.data); 
        
        ctx.filter = 'blur(5px)'; // Efek blur background
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none'; // Matikan filter untuk elemen lain
    } catch (err) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Avatar Bulat di TENGAH
    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatarRes = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
        const avatar = await loadImage(avatarRes.data);
        
        const centerX = canvas.width / 2;
        const centerY = 90;
        const radius = 60;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, centerX - radius, centerY - radius, radius * 2, radius * 2);
        ctx.restore();
    } catch (err) {}

    // 3. Teks Hitam dengan Stroke Putih
    ctx.textAlign = 'center';  
    ctx.strokeStyle = '#ffffff'; // Warna stroke putih
    ctx.lineWidth = 6;           // Ketebalan stroke
    ctx.fillStyle = '#000000';   // Warna teks hitam
    
    ctx.font = 'bold 45px Montserrat';
    // Menulis welcome/goodbye
    ctx.strokeText(type === 'welcome' ? 'WELCOME' : 'GOOD BYE', canvas.width / 2, 185);
    ctx.fillText(type === 'welcome' ? 'WELCOME' : 'GOOD BYE', canvas.width / 2, 185);
    
    ctx.font = 'bold 35px Montserrat';
    const username = member.user ? member.user.username : 'Unknown';
    // Menulis username
    ctx.strokeText(username.toUpperCase(), canvas.width / 2, 225);
    ctx.fillText(username.toUpperCase(), canvas.width / 2, 225);

    return canvas.encodeSync('png');
}

module.exports = { createCustomImage };
