const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const axios = require('axios');

// Fungsi untuk load font (dilakukan sekali di awal)
async function loadFonts() {
    try {
        const fontRes = await axios.get('https://github.com/google/fonts/raw/main/ofl/roboto/Roboto-Bold.ttf', { responseType: 'arraybuffer' });
        GlobalFonts.register(fontRes.data, 'Roboto');
        return true;
    } catch (err) {
        console.error('⚠️ Font gagal dimuat:', err.message);
        return false;
    }
}

// Jalankan load font sekali pas bot pertama kali nyala
let fontReady = false;
loadFonts().then(success => { fontReady = success; });

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
        ctx.filter = 'none'; // WAJIB: Reset filter agar teks tidak ikut blur
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

    // 3. Teks Hitam dengan Stroke Putih
    ctx.textAlign = 'center';  
    ctx.strokeStyle = '#ffffff'; 
    ctx.lineWidth = 8;
    ctx.fillStyle = '#000000';   
    
    // Gunakan 'Roboto' jika berhasil dimuat, kalau gagal fallback ke 'sans-serif'
    const fontName = fontReady ? 'Roboto' : 'sans-serif';
    
    ctx.font = `bold 50px ${fontName}`;
    const title = type === 'welcome' ? 'WELCOME' : 'GOOD BYE';
    ctx.strokeText(title, 350, 185);
    ctx.fillText(title, 350, 185);
    
    ctx.font = `bold 40px ${fontName}`;
    const username = (member.user ? member.user.username : 'Unknown').toUpperCase();
    ctx.strokeText(username, 350, 230);
    ctx.fillText(username, 350, 230);

    return canvas.encodeSync('png');
}

module.exports = { createCustomImage };
