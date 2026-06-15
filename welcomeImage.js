const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');

async function createCustomImage(type, member, bgUrl) {
    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    // 1. Gambar Background Blur
    const finalBgUrl = 'https://i.imgur.com/pVQfBWI.png';
    try {
        const response = await axios.get(finalBgUrl, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } });
        const background = await loadImage(response.data); 
        
        ctx.filter = 'blur(5px)';
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none'; // Reset blur
    } catch (err) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Gambar Avatar
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

    // 3. Teks (Menggunakan Reset State)
    // Kita save dulu canvas-nya sebelum gambar teks
    ctx.save();
    
    ctx.textAlign = 'center';  
    ctx.strokeStyle = '#ffffff'; 
    ctx.lineWidth = 8;
    ctx.fillStyle = '#000000';   
    
    // Paksa pakai font standar sans-serif, jangan load font aneh-aneh dulu
    ctx.font = 'bold 50px sans-serif';
    const title = type === 'welcome' ? 'WELCOME' : 'GOOD BYE';
    
    // Gambar teks
    ctx.strokeText(title, 350, 185);
    ctx.fillText(title, 350, 185);
    
    ctx.font = 'bold 40px sans-serif';
    const username = (member.user ? member.user.username : 'Unknown').toUpperCase();
    ctx.strokeText(username, 350, 230);
    ctx.fillText(username, 350, 230);
    
    // Restore biar clean
    ctx.restore();

    return canvas.encodeSync('png');
}

module.exports = { createCustomImage };
