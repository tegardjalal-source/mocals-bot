const { createCanvas, loadImage } = require('canvas');

// Tambahkan parameter bgUrl
async function createCustomImage(type, member, bgUrl) {
    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    // Background default jika server belum nge-set custom background
    const defaultBg = 'https://i.imgur.com/gY5G5vD.png'; 
    const finalBgUrl = bgUrl || defaultBg;

    try {
        // Coba load background custom/default
        const background = await loadImage(finalBgUrl); 
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    } catch (err) {
        // Kalau URL dari user rusak, kasih warna solid abu-abu gelap biar bot ga crash
        ctx.fillStyle = '#2f3136';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        console.error(`⚠️ Gagal meload gambar welcome untuk ${member.user.username}`);
    }

    // Styling Teks
    ctx.fillStyle = '#ffffff'; 
    ctx.textAlign = 'center';  
    
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText(type === 'welcome' ? 'WELCOME' : 'GOOD BYE', canvas.width / 2, 100);
    
    ctx.font = '30px sans-serif';
    ctx.fillText(member.user.username, canvas.width / 2, 160);

    return canvas.toBuffer();
}

module.exports = { createCustomImage };
