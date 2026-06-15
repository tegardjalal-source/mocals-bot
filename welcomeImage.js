const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');

async function createCustomImage(type, member, bgUrl) {
    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    // 1. Background Blur
    const finalBgUrl = bgUrl || 'https://i.postimg.cc/0j2x1X9Z/bg.png';
    try {
        const response = await axios.get(finalBgUrl, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } });
        const background = await loadImage(response.data); 
        ctx.filter = 'blur(5px)'; 
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
    } catch (err) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Avatar
    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatarRes = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
        const avatar = await loadImage(avatarRes.data);
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(350, 90, 60, 0, Math.PI * 2);
        ctx.stroke();
        ctx.save();
        ctx.beginPath();
        ctx.arc(350, 90, 60, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, 290, 30, 120, 120);
        ctx.restore();
    } catch (err) {}

    // 3. Teks Hitam dengan Stroke Putih (Font Standar Sans-Serif)
    ctx.textAlign = 'center';  
    ctx.strokeStyle = '#ffffff'; 
    ctx.lineWidth = 8;           // Stroke dipertebal
    ctx.fillStyle = '#000000';   
    
    // Pakai font 'sans-serif' yang pasti ada di server
    ctx.font = 'bold 50px sans-serif';
    const title = type === 'welcome' ? 'WELCOME' : 'GOOD BYE';
    ctx.strokeText(title, 350, 185);
    ctx.fillText(title, 350, 185);
    
    ctx.font = 'bold 40px sans-serif';
    const username = (member.user ? member.user.username : 'Unknown').toUpperCase();
    ctx.strokeText(username, 350, 230);
    ctx.fillText(username, 350, 230);

    return canvas.encodeSync('png');
}

module.exports = { createCustomImage };
