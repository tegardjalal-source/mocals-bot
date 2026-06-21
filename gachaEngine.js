const axios = require('axios');

// 🌟 KOLAM KARAKTER POPULER (Anti-Macet untuk Kasta Tinggi)
// Kamu bisa bebas menambah ID MAL karakter populer di sini kapan saja!
const POOL_SSR = [21, 40, 11, 71, 417, 13, 87, 14, 208, 4328, 85, 4606, 139, 45627]; 
const POOL_SR = [73935, 68, 12, 17, 118, 45, 111, 246, 55, 345, 118731, 84, 1535];

// 🛡️ Pity Pool Diperluas (Offline Fallback jika API Jikan mati total)
const PITY_POOL = {
    SSR: [
        { sukses: true, id: 21, name: 'Roronoa Zoro', rarity: 'SSR', malRank: 125000, image: 'https://cdn.myanimelist.net/images/characters/3/502901.jpg', url: 'https://myanimelist.net/character/21' },
        { sukses: true, id: 40, name: 'Luffy Monkey D.', rarity: 'SSR', malRank: 140000, image: 'https://cdn.myanimelist.net/images/characters/9/310307.jpg', url: 'https://myanimelist.net/character/40' },
        { sukses: true, id: 45627, name: 'Levi Ackerman', rarity: 'SSR', malRank: 135000, image: 'https://cdn.myanimelist.net/images/characters/2/284121.jpg', url: 'https://myanimelist.net/character/45627' }
    ],
    SR: [
        { sukses: true, id: 73935, name: 'Mikasa Ackerman', rarity: 'SR', malRank: 9800, image: 'https://cdn.myanimelist.net/images/characters/9/215629.jpg', url: 'https://myanimelist.net/character/73935' },
        { sukses: true, id: 17, name: 'Alphonse Elric', rarity: 'SR', malRank: 8500, image: 'https://cdn.myanimelist.net/images/characters/5/54265.jpg', url: 'https://myanimelist.net/character/17' },
        { sukses: true, id: 118731, name: 'Megumin', rarity: 'SR', malRank: 12000, image: 'https://cdn.myanimelist.net/images/characters/14/311029.jpg', url: 'https://myanimelist.net/character/118731' }
    ],
    R: [
        { sukses: true, id: 433, name: 'Mamenoki', rarity: 'R', malRank: 1200, image: 'https://i.imgur.com/8N7V0w9.png', url: 'https://myanimelist.net/character/433' },
        { sukses: true, id: 622, name: 'Chuchu', rarity: 'R', malRank: 1050, image: 'https://i.imgur.com/8N7V0w9.png', url: 'https://myanimelist.net/character/622' }
    ],
    C: [
        { sukses: true, id: 9991, name: 'Karakter Warga Desa A', rarity: 'C', malRank: 12, image: 'https://i.imgur.com/8N7V0w9.png', url: 'https://myanimelist.net/' },
        { sukses: true, id: 9992, name: 'Prajurit Tak Bernama', rarity: 'C', malRank: 2, image: 'https://i.imgur.com/8N7V0w9.png', url: 'https://myanimelist.net/' }
    ]
};

let lastFiveCharIds = []; 

// Fungsi 1: Narik spesifik ID dari MAL (Cepat, khusus SSR & SR)
async function fetchSpecificMAL(id, expectedRarity) {
    try {
        const res = await axios.get(`https://api.jikan.moe/v4/characters/${id}`, { timeout: 4000 });
        const c = res.data?.data;
        if (!c) return null;
        return { 
            sukses: true, id: c.mal_id, name: c.name, rarity: expectedRarity, malRank: c.favorites || 0, 
            image: c.images?.jpg?.image_url || 'https://i.imgur.com/8N7V0w9.png', url: c.url 
        };
    } catch (e) {
        return null; 
    }
}

// Fungsi 2: Mancing acak dari MAL (Khusus R & C)
async function fetchRandomMAL(targetRarity) {
    try {
        const res = await axios.get('https://api.jikan.moe/v4/random/characters', { timeout: 4000 });
        const c = res.data?.data;
        if (!c) return null;

        const fav = c.favorites || 0;
        let rarity = 'C';
        if (fav >= 15000) rarity = 'SSR';
        else if (fav >= 5000) rarity = 'SR';
        else if (fav >= 1000) rarity = 'R';

        // Tolak jika raritas yang didapat meleset dari target acakan
        if (rarity !== targetRarity) return null;

        return { 
            sukses: true, id: c.mal_id, name: c.name, rarity: rarity, malRank: fav, 
            image: c.images?.jpg?.image_url || 'https://i.imgur.com/8N7V0w9.png', url: c.url 
        };
    } catch (e) {
        return null; 
    }
}

async function jalankanGacha(perintah) {
    const kocokan = Math.random() * 100;
    let targetRarity = 'C';

    if (perintah === 'megaluck') {
        targetRarity = 'SSR';
    } else if (perintah === 'superluck') {
        targetRarity = kocokan < 15 ? 'SSR' : 'SR';
    } else if (perintah === 'luck') {
        if (kocokan < 5) targetRarity = 'SSR';
        else if (kocokan < 30) targetRarity = 'SR';
        else targetRarity = 'R';
    } else {
        if (kocokan < 1) targetRarity = 'SSR';
        else if (kocokan < 6) targetRarity = 'SR';
        else if (kocokan < 45) targetRarity = 'R';
        else targetRarity = 'C';
    }

    let hasil = null;

    // 🎯 LOGIKA PENCARIAN CERDAS
    if (targetRarity === 'SSR' || targetRarity === 'SR') {
        // Ambil data langsung dari kolam ID terdaftar agar pasti dapat SSR/SR
        const pool = targetRarity === 'SSR' ? POOL_SSR : POOL_SR;
        
        // Cek anti-duplikat memori sebelum gacha
        let availableIds = pool.filter(id => !lastFiveCharIds.includes(id));
        if (availableIds.length === 0) availableIds = pool; // Failsafe jika memori kepenuhan
        
        const idTarget = availableIds[Math.floor(Math.random() * availableIds.length)];
        
        // Proses memancing ke MAL (Pasti berhasil karena ID-nya valid)
        hasil = await fetchSpecificMAL(idTarget, targetRarity);
    } else {
        // Kasta ampas (R dan C) tetap pakai teknik memancing buta / random ke MAL
        for (let i = 0; i < 3; i++) {
            const temp = await fetchRandomMAL(targetRarity);
            if (temp && !lastFiveCharIds.includes(temp.id)) {
                hasil = temp;
                break;
            }
            await new Promise(r => setTimeout(r, 650)); 
        }
    }

    // Pity Anti-Macet Offline
    if (!hasil) {
        const pool = PITY_POOL[targetRarity];
        // Pilih Pity Pool yang tidak ada di memori terakhir (Anti-Duplicate)
        let availablePity = pool.filter(char => !lastFiveCharIds.includes(char.id));
        if (availablePity.length === 0) availablePity = pool;
        
        hasil = availablePity[Math.floor(Math.random() * availablePity.length)];
        console.log(`⚠️ [Gacha Engine] Mengaktifkan Pity Cadangan untuk kasta: ${targetRarity}`);
    }

    // Catat ID Karakter ke memori
    lastFiveCharIds.push(hasil.id);
    if (lastFiveCharIds.length > 5) lastFiveCharIds.shift(); 

    return hasil;
}

module.exports = { jalankanGacha };
