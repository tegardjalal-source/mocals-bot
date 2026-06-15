const { createCanvas, loadImage } = require('@napi-rs/canvas');

async function createCustomImage(type, member, bgUrl) {
    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    const defaultBg = 'https://i.imgur.com/gY5G5vD.png'; 
    const finalBgUrl = bgUrl || defaultBg;

    try {
        const background = await loadImage(finalBgUrl); 
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    } catch (err) {
        ctx.fillStyle = '#2f3136';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        console.error(`⚠️ Gagal meload background.`);
    }

    ctx.fillStyle = '#ffffff'; 
    ctx.textAlign = 'center';  
    
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText(type === 'welcome' ? 'WELCOME' : 'GOOD BYE', canvas.width / 2, 100);
    
    ctx.font = '30px sans-serif';
    // Jaga-jaga kalau member.user.username kosong
    const username = member.user ? member.user.username : 'Unknown';
    ctx.fillText(username, canvas.width / 2, 160);

    // 👇 PERBAIKAN: @napi-rs/canvas menggunakan encodeSync('png') bukan toBuffer()
    return canvas.encodeSync('png');
}

module.exports = { createCustomImage };
