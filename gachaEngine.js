const axios = require('axios');

// Fallback jika API benar-benar down (tetap simpan untuk keamanan)
const PITY_POOL = {
    SSR: [{ id: 21, name: 'Roronoa Zoro', rarity: 'SSR', malRank: 125000, image: 'https://cdn.myanimelist.net/images/characters/3/502901.jpg', url: 'https://myanimelist.net/character/21/Roronoa_Zoro' }],
    SR: [{ id: 73935, name: 'Mikasa Ackerman', rarity: 'SR', malRank: 9800, image: 'https://cdn.myanimelist.net/images/characters/9/215629.jpg', url: 'https://myanimelist.net/character/73935/Mikasa_Ackerman' }],
    R: [{ id: 433, name: 'Mamenoki', rarity: 'R', malRank: 1200, image: 'https://i.imgur.com/8N7V0w9.png', url: 'https://myanimelist.net/character/433' }],
    C: [{ id: 9991, name: 'Karakter Warga Desa A', rarity: 'C', malRank: 12, image: 'https://i.imgur.com/8N7V0w9.png', url: 'https://myanimelist.net/' }]
};

async function fetchFromMAL() {
    try {
        const res = await axios.get('https://api.jikan.moe/v4/random/characters', { timeout: 4000 });
        const c = res.data?.data;
        if (!c) return null;

        const fav = c.favorites || 0;
        let rarity = 'C';
        if (fav >= 15000) rarity = 'SSR';
        else if (fav >= 5000) rarity = 'SR';
        else if (fav >= 1000) rarity = 'R';

        return { sukses: true, id: c.mal_id, name: c.name, rarity: rarity, malRank: fav, image: c.images?.jpg?.image_url || 'https://i.imgur.com/8N7V0w9.png', url: c.url };
    } catch (e) { return null; }
}

async function jalankanGacha(perintah) {
    const kocokan = Math.random() * 100;
    let targetRarity = 'C';

    if (perintah === 'megaluck') {
        if (kocokan < 10) targetRarity = 'SSR'; else if (kocokan < 35) targetRarity = 'SR'; else if (kocokan < 70) targetRarity = 'R'; else targetRarity = 'C';
    } else if (perintah === 'superluck') {
        if (kocokan < 5) targetRarity = 'SSR'; else if (kocokan < 20) targetRarity = 'SR'; else if (kocokan < 60) targetRarity = 'R'; else targetRarity = 'C';
    } else if (perintah === 'luck') {
        if (kocokan < 3) targetRarity = 'SSR'; else if (kocokan < 13) targetRarity = 'SR'; else if (kocokan < 55) targetRarity = 'R'; else targetRarity = 'C';
    } else {
        if (kocokan < 1) targetRarity = 'SSR'; else if (kocokan < 6) targetRarity = 'SR'; else if (kocokan < 45) targetRarity = 'R'; else targetRarity = 'C';
    }

    // 1. Coba ambil dari API
    const hasilAPI = await fetchFromMAL();
    if (hasilAPI && hasilAPI.rarity === targetRarity) return hasilAPI;

    // 2. JIKA GAGAL/TIDAK PAS, PANCING API 2x LAGI (Dynamic Retry)
    // Ini membuat karakter yang keluar jauh lebih bervariasi daripada mengambil dari list statis
    for (let i = 0; i < 2; i++) {
        const pancingan = await fetchFromMAL();
        if (pancingan && pancingan.rarity === targetRarity) return pancingan;
        await new Promise(r => setTimeout(r, 500)); // Delay sangat singkat antar retry
    }

    // 3. Jika setelah 3x percobaan (1 awal + 2 retry) tetap tidak dapat kasta yang pas,
    // baru kita pakai fallback "Pity" agar player tidak kecewa
    const pool = PITY_POOL[targetRarity];
    return { sukses: true, ...pool[Math.floor(Math.random() * pool.length)] };
}

module.exports = { jalankanGacha };
