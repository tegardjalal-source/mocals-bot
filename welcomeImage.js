const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');

async function createCustomImage(type, member, bgUrl) {
    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    // 1. Pilih Gambar Berdasarkan Tipe (Welcome/Goodbye)
    const finalBgUrl = type === 'welcome' ? 'https://i.imgur.com/vpo6oxQ.jpeg' : 'https://i.imgur.com/WEMClPV.jpeg';

    // 2. Gambar Background
    try {
        const response = await axios.get(finalBgUrl, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } });
        const background = await loadImage(response.data); 
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    } catch (err) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 3. Gambar Avatar (Posisi Tengah)
    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatarRes = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
        const avatar = await loadImage(avatarRes.data);
        
        // Border hitam avatar
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
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

    // Tidak ada kode teks di sini, jadi bener-bener polosan sesuai desain lu
    return canvas.encodeSync('png');
}

module.exports = { createCustomImage };
