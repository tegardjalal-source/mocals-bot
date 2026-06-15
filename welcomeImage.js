const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');

async function createCustomImage(type, member, bgUrl) {
    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    const defaultBg = 'https://i.imgur.com/gY5G5vD.png'; 
    const finalBgUrl = bgUrl || defaultBg;

    try {
        // Trik jitu: Download gambar pakai Axios dengan nyamar jadi browser manusia 
        // Biar nggak diblokir sama sistem keamanan Discord / Imgur
        const response = await axios.get(finalBgUrl, { 
            responseType: 'arraybuffer',
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' 
            }
        });
        
        // Ubah data hasil download jadi gambar canvas
        const background = await loadImage(response.data); 
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    } catch (err) {
        console.error(`⚠️ Gagal meload background:`, err.message);
        // Kalau link tetap mati, kasih warna abu-abu
        ctx.fillStyle = '#2f3136';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Styling Teks (Welcome & Username)
    ctx.fillStyle = '#ffffff'; 
    ctx.textAlign = 'center';  
    
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText(type === 'welcome' ? 'WELCOME' : 'GOOD BYE', canvas.width / 2, 100);
    
    ctx.font = '30px sans-serif';
    const username = member.user ? member.user.username : 'Unknown';
    ctx.fillText(username, canvas.width / 2, 160);

    return canvas.encodeSync('png');
}

module.exports = { createCustomImage };
