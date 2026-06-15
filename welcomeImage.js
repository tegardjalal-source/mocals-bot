const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');

async function createCustomImage(type, member, bgUrl) {
    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    // 1. Background (TANPA BLUR DULU)
    const finalBgUrl = 'https://i.imgur.com/pVQfBWI.png';
    try {
        const response = await axios.get(finalBgUrl, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } });
        const background = await loadImage(response.data); 
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    } catch (err) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Avatar
    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatarRes = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
        const avatar = await loadImage(avatarRes.data);
        
        ctx.drawImage(avatar, 290, 30, 120, 120);
    } catch (err) {}

    // 3. Teks DEBUG (Warna Merah, No Stroke, No Blur)
    ctx.textAlign = 'center';  
    ctx.fillStyle = '#FF0000'; // Merah biar kontras
    ctx.font = '50px sans-serif';
    
    // Tulis teks
    ctx.fillText("TESTING TEXT", 350, 200);

    return canvas.encodeSync('png');
}

module.exports = { createCustomImage };
