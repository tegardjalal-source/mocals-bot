const axios = require('axios');

// Fungsi helper jeda waktu (mencegah Jikan API terkena spam 429 Rate Limit)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function rollGachaMALResmi() {
    try {
        // Mengambil karakter acak secara global dari MyAnimeList via Jikan API
        const res = await axios.get('https://api.jikan.moe/v4/random/characters');
        const charData = res.data?.data;

        if (!charData) {
            return { sukses: false, pesan: '✖️ Gagal menarik takdir karakter dari MyAnimeList. Coba lagi ya!' };
        }

        const favorites = charData.favorites || 0;
        
        // Logika Rarity disesuaikan dengan jumlah Fans/Favorites MAL nyata
        let rarity = 'C';
        if (favorites >= 15000) {
            rarity = 'SSR';      // Karakter Legendaris / Super Populer
        } else if (favorites >= 5000) {
            rarity = 'SR';       // Karakter Utama / Karakter Pendukung populer
        } else if (favorites >= 1000) {
            rarity = 'R';        // Karakter Sampingan Berbobot
        } else {
            rarity = 'C';        // Karakter Figuran / NPC Kurang Populer
        }

        return {
            sukses: true,
            id: charData.mal_id,
            name: charData.name,
            rarity: rarity,
            malRank: favorites,
            image: charData.images?.jpg?.image_url || 'https://i.imgur.com/8N7V0w9.png',
            url: charData.url
        };
    } catch (error) {
        console.error('Error Gacha Engine:', error.message);
        return { sukses: false, pesan: '✖️ Terjadi gangguan koneksi ke MyAnimeList atau server sedang sibuk.' };
    }
}

// Fungsi gacha premium khusus untuk bursa Black Market (Wajib dapet minimal SR / SSR)
async function rollKartuBagus() {
    for (let i = 0; i < 10; i++) { 
        const hasil = await rollGachaMALResmi();
        if (hasil.sukses && (hasil.rarity === 'SR' || hasil.rarity === 'SSR')) {
            return hasil;
        }
        await delay(1500); 
    }
    
    // Fallback darurat semisal dalam 10x loop gagal dapet SR/SSR
    return {
        sukses: true,
        id: 21, 
        name: 'Roronoa Zoro',
        rarity: 'SSR',
        malRank: 120000,
        image: 'https://cdn.myanimelist.net/images/characters/3/502901.jpg',
        url: 'https://myanimelist.net/character/21/Roronoa_Zoro'
    };
}

module.exports = { rollGachaMALResmi, rollKartuBagus };
