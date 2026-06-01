const axios = require('axios');

// Pool Karakter Lokal sebagai penyelamat (Fallback) jika API down,
// atau jika kasta karakter dari API tidak sesuai dengan target hoki local RNG.
// Kamu bisa menambah atau mengubah list karakter di bawah ini sesuka hati.
const LOCAL_POOL = {
    SSR: [
        { id: 21, name: 'Roronoa Zoro', rarity: 'SSR', malRank: 125000, image: 'https://cdn.myanimelist.net/images/characters/3/502901.jpg', url: 'https://myanimelist.net/character/21/Roronoa_Zoro' },
        { id: 417, name: 'Lelouch Lamperouge', rarity: 'SSR', malRank: 162000, image: 'https://cdn.myanimelist.net/images/characters/8/455119.jpg', url: 'https://myanimelist.net/character/417/Lelouch_Lamperouge' },
        { id: 45627, name: 'Satoru Gojo', rarity: 'SSR', malRank: 98000, image: 'https://cdn.myanimelist.net/images/characters/14/422204.jpg', url: 'https://myanimelist.net/character/45627/Satoru_Gojo' },
        { id: 131019, name: 'Levi Ackerman', rarity: 'SSR', malRank: 138000, image: 'https://cdn.myanimelist.net/images/characters/2/241339.jpg', url: 'https://myanimelist.net/character/131019/Levi' },
        { id: 40, name: 'Luffy Monkey D.', rarity: 'SSR', malRank: 145000, image: 'https://cdn.myanimelist.net/images/characters/9/310307.jpg', url: 'https://myanimelist.net/character/40/Monkey_D_Luffy' }
    ],
    SR: [
        { id: 73935, name: 'Mikasa Ackerman', rarity: 'SR', malRank: 9800, image: 'https://cdn.myanimelist.net/images/characters/9/215629.jpg', url: 'https://myanimelist.net/character/73935/Mikasa_Ackerman' },
        { id: 118837, name: 'Kaneki Ken', rarity: 'SR', malRank: 8900, image: 'https://cdn.myanimelist.net/images/characters/4/255017.jpg', url: 'https://myanimelist.net/character/118837/Ken_Kaneki' },
        { id: 18397, name: 'Killua Zoldyck', rarity: 'SR', malRank: 14000, image: 'https://cdn.myanimelist.net/images/characters/11/447541.jpg', url: 'https://myanimelist.net/character/18397/Killua_Zoldyck' }
    ],
    R: [
        { id: 433, name: 'Mamenoki', rarity: 'R', malRank: 1200, image: 'https://i.imgur.com/8N7V0w9.png', url: 'https://myanimelist.net/character/433' },
        { id: 141209, name: 'Zenitsu Agatsuma', rarity: 'R', malRank: 3200, image: 'https://cdn.myanimelist.net/images/characters/16/384790.jpg', url: 'https://myanimelist.net/character/141209/Zenitsu_Agatsuma' }
    ],
    C: [
        { id: 9991, name: 'Karakter Warga Desa A', rarity: 'C', malRank: 12, image: 'https://i.imgur.com/8N7V0w9.png', url: 'https://myanimelist.net/' },
        { id: 9992, name: 'Ninja Figuran Konoha', rarity: 'C', malRank: 45, image: 'https://i.imgur.com/8N7V0w9.png', url: 'https://myanimelist.net/' }
    ]
};

// Fungsi internal untuk fetch data 1 KALI saja ke MyAnimeList via Jikan API
async function fetchFromMAL() {
    try {
        const res = await axios.get('https://api.jikan.moe/v4/random/characters', { timeout: 4000 });
        const charData = res.data?.data;
        if (!charData) return null;

        const fav = charData.favorites || 0;
        let rarity = 'C';
        if (fav >= 15000) rarity = 'SSR';
        else if (fav >= 5000) rarity = 'SR';
        else if (fav >= 1000) rarity = 'R';

        return {
            sukses: true,
            id: charData.mal_id,
            name: charData.name,
            rarity: rarity,
            malRank: fav,
            image: charData.images?.jpg?.image_url || 'https://i.imgur.com/8N7V0w9.png',
            url: charData.url
        };
    } catch (error) {
        console.error('⚠️ [API Jikan] Gagal atau Timeout:', error.message);
        return null; // Jika API bermasalah, biarkan sistem fallback mengambil alih
    }
}

/**
 * ENGINE UTAMA GACHA MULTI-LUCK
 * @param {string} perintah - Berisi tipe gacha ('biasa', 'luck', 'superluck', 'megaluck')
 */
async function jalankanGacha(perintah) {
    const kocokan = Math.random() * 100; // Menghasilkan angka pecahan acak dari 0.00 sampai 99.99
    let targetRarity = 'C';

    // 1. MATRIKS DISTRIBUSI CHANCE (Peluang Akurat Konfigurasi Lokal)
    if (perintah === 'megaluck') {
        if (kocokan < 10) targetRarity = 'SSR';       // 10% Chance SSR
        else if (kocokan < 35) targetRarity = 'SR';   // 25% Chance SR
        else if (kocokan < 70) targetRarity = 'R';    // 35% Chance R
        else targetRarity = 'C';                      // 30% Chance C
    } 
    else if (perintah === 'superluck') {
        if (kocokan < 5) targetRarity = 'SSR';        // 5% Chance SSR
        else if (kocokan < 20) targetRarity = 'SR';   // 15% Chance SR
        else if (kocokan < 60) targetRarity = 'R';    // 40% Chance R
        else targetRarity = 'C';                      // 40% Chance C
    } 
    else if (perintah === 'luck') {
        if (kocokan < 3) targetRarity = 'SSR';        // 3% Chance SSR
        else if (kocokan < 13) targetRarity = 'SR';   // 10% Chance SR
        else if (kocokan < 55) targetRarity = 'R';    // 42% Chance R
        else targetRarity = 'C';                      // 45% Chance C
    } 
    else { 
        // Default: Perintah '!gacha' biasa / bursa harian pasar gelap biasa
        if (kocokan < 1) targetRarity = 'SSR';        // 1% Chance SSR
        else if (kocokan < 6) targetRarity = 'SR';    // 5% Chance SR
        else if (kocokan < 45) targetRarity = 'R';    // 39% Chance R
        else targetRarity = 'C';                      // 55% Chance C
    }

    // 2. AMBIL SAMPEL REAL DARI MYANIMELIST (Hanya 1x Request)
    const karakterAPI = await fetchFromMAL();

    // SINKRONISASI NASIB: Jika API merespon dengan baik DAN kasta karakternya kebetulan pas dengan kocokan kita
    if (karakterAPI && karakterAPI.rarity === targetRarity) {
        return karakterAPI; // Player beruntung mendapatkan rilisan murni dari database MAL!
    }

    // 3. JALUR LOKAL FALLBACK (Kunci Garansi Kasta)
    // Jika API down, terkena rate-limit, atau kasta dari API meleset dari target kocokan RNG di atas,
    // Ambil secara paksa dari database lokal demi melindungi integritas persentase hoki game.
    const poolSesuaiRarity = LOCAL_POOL[targetRarity];
    const karakterPilihan = poolSesuaiRarity[Math.floor(Math.random() * poolSesuaiRarity.length)];
    
    return {
        sukses: true,
        ...karakterPilihan
    };
}

module.exports = { jalankanGacha };
