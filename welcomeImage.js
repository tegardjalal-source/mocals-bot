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

    // 1. Background
    const finalBgUrl = bgUrl || 'https://i.postimg.cc/0j2x1X9Z/bg.png';
    try {
        const response = await axios.get(finalBgUrl, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } });
        const background = await loadImage(response.data); 
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    } catch (err) {
        ctx.fillStyle = '#000000'; // Background hitam ala Koya
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Avatar Bulat di TENGAH (Ala Koya)
    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatarRes = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
        const avatar = await loadImage(avatarRes.data);
        
        const centerX = canvas.width / 2;
        const centerY = 100; // Agak ke atas
        const radius = 65;

        // Border putih tipis (Opsional, biar makin mirip)
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

    // 3. Teks di BAWAH avatar
    ctx.fillStyle = '#ffffff'; 
    ctx.textAlign = 'center';  
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    
    ctx.font = 'bold 45px Montserrat';
    ctx.fillText(type === 'welcome' ? 'WELCOME' : 'GOOD BYE', canvas.width / 2, 195);
    
    ctx.font = 'bold 35px Montserrat';
    const username = member.user ? member.user.username : 'Unknown';
    ctx.fillText(username.toUpperCase(), canvas.width / 2, 235);

    return canvas.encodeSync('png');
}

module.exports = { createCustomImage };
