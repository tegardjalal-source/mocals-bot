const axios = require('axios');

// Pity Pool disuntikkan properti 'sukses: true' agar tidak memicu silang merah di bot utama
const PITY_POOL = {
    SSR: [{ sukses: true, id: 21, name: 'Roronoa Zoro', rarity: 'SSR', malRank: 125000, image: 'https://cdn.myanimelist.net/images/characters/3/502901.jpg', url: 'https://myanimelist.net/character/21/Roronoa_Zoro' }],
    SR: [{ sukses: true, id: 73935, name: 'Mikasa Ackerman', rarity: 'SR', malRank: 9800, image: 'https://cdn.myanimelist.net/images/characters/9/215629.jpg', url: 'https://myanimelist.net/character/73935/Mikasa_Ackerman' }],
    R: [{ sukses: true, id: 433, name: 'Mamenoki', rarity: 'R', malRank: 1200, image: 'https://i.imgur.com/8N7V0w9.png', url: 'https://myanimelist.net/character/433' }],
    C: [{ sukses: true, id: 9991, name: 'Karakter Warga Desa A', rarity: 'C', malRank: 12, image: 'https://i.imgur.com/8N7V0w9.png', url: 'https://myanimelist.net/' }]
};

// Memori anti-duplikat
let lastFiveCharIds = []; 

async function fetchFromMAL() {
    try {
        // Mengontak API MyAnimeList Random Character
        const res = await axios.get('https://api.jikan.moe/v4/random/characters', { timeout: 4000 });
        const c = res.data?.data;
        if (!c) return null;

        const fav = c.favorites || 0;
        let rarity = 'C';
        
        // Penentuan kasta murni berdasarkan jumlah favorit asli di MyAnimeList
        if (fav >= 15000) rarity = 'SSR';
        else if (fav >= 5000) rarity = 'SR';
        else if (fav >= 1000) rarity = 'R';

        return { 
            sukses: true, 
            id: c.mal_id, 
            name: c.name, 
            rarity: rarity, 
            malRank: fav, 
            image: c.images?.jpg?.image_url || 'https://i.imgur.com/8N7V0w9.png', 
            url: c.url 
        };
    } catch (e) { 
        return null; 
    }
}

async function jalankanGacha(perintah) {
    const kocokan = Math.random() * 100;
    let targetRarity = 'C';

    // ⚖️ PENYESUAIAN ADIL: Menyelaraskan logika kasta gacha dengan deskripsi !gachainfo kamu
    if (perintah === 'megaluck') {
        // !gachamegaluck WAJIB SSR (100% jaminan SSR)
        targetRarity = 'SSR';
    } else if (perintah === 'superluck') {
        // !gachasuperluck minimal SR (Peluang: 85% SR, 15% SSR)
        targetRarity = kocokan < 15 ? 'SSR' : 'SR';
    } else if (perintah === 'luck') {
        // !gachaluck minimal R (Peluang: 70% R, 25% SR, 5% SSR)
        if (kocokan < 5) targetRarity = 'SSR';
        else if (kocokan < 30) targetRarity = 'SR';
        else targetRarity = 'R';
    } else {
        // !gacha biasa tarif $500 (Peluang acak murni dari bawah)
        if (kocokan < 1) targetRarity = 'SSR';
        else if (kocokan < 6) targetRarity = 'SR';
        else if (kocokan < 45) targetRarity = 'R';
        else targetRarity = 'C';
    }

    let hasil = null;

    // Lakukan maksimal 3 kali percobaan untuk menembak karakter dari MAL yang pas kastanya
    for (let i = 0; i < 3; i++) {
        const temp = await fetchFromMAL();
        if (temp && temp.rarity === targetRarity && !lastFiveCharIds.includes(temp.id)) {
            hasil = temp;
            break;
        }
        // Jeda 600ms antar-request agar tidak terkena Rate Limit API Jikan (Maks 3 req/detik)
        await new Promise(r => setTimeout(r, 650)); 
    }

    // Pity Anti-Macet: Jika pencarian internet gagal/rate-limit, ambil data dari PITY_POOL cadangan
    if (!hasil) {
        const pool = PITY_POOL[targetRarity];
        hasil = pool[Math.floor(Math.random() * pool.length)];
        console.log(`⚠️ [Gacha Engine] Mengaktifkan Pity Cadangan untuk kasta: ${targetRarity}`);
    }

    // Catat ID Karakter ke memori anti-duplikat
    lastFiveCharIds.push(hasil.id);
    if (lastFiveCharIds.length > 5) lastFiveCharIds.shift(); 

    return hasil;
}

module.exports = { jalankanGacha };
