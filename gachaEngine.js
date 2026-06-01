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
        
        // 🔥 LOGIKA BARU: Rarity disesuaikan dengan jumlah Fans/Favorites MAL nyata! 🔥
        let rarity = 'C';
        if (favorites >= 15000) {
            rarity = 'SSR';      // Karakter Legendaris / Super Populer (Sanji, Gojo, Luffy, Zoro, dll)
        } else if (favorites >= 5000) {
            rarity = 'SR';       // Karakter Utama / Karakter Pendukung yang sangat disukai
        } else if (favorites >= 1000) {
            rarity = 'R';        // Karakter Sampingan Berbobot yang lumayan dikenal
        } else {
            rarity = 'C';        // Karakter Figuran / NPC Kurang Populer
        }

        return {
            sukses: true,
            id: charData.mal_id,
            name: charData.name,
            rarity: rarity,
            malRank: favorites, // Di index.js kamu pake hasil.malRank buat nampilin jumlah user favorites
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
    // Melakukan looping berulang sampai dapet karakter yang punya tier SR atau SSR
    for (let i = 0; i < 10; i++) { // Kita batasi maksimal 10x loop biar bot gak hang klo API MAL delay
        const hasil = await rollGachaMALResmi();
        if (hasil.sukses && (hasil.rarity === 'SR' || hasil.rarity === 'SSR')) {
            return hasil;
        }
        await delay(1500); // Kasih jeda aman antar-looping
    }
    
    // Fallback darurat semisal dalam 10x loop gagal dapet SR/SSR (Biar Black Market gak kosong)
    return {
        sukses: true,
        id: 21, // ID Zoro legendaris wkwk
        name: 'Roronoa Zoro',
        rarity: 'SSR',
        malRank: 120000,
        image: 'https://cdn.myanimelist.net/images/characters/3/502901.jpg',
        url: 'https://myanimelist.net/character/21/Roronoa_Zoro'
    };
}

module.exports = { rollGachaMALResmi, rollKartuBagus };
```[cite: 1]

---

### 🌟 Skema Tier Rarity yang Baru:
*   **`SSR`**: Koleksi Maha-Langka. Hanya untuk karakter dengan **$\ge$ 15.000 Favorites** di MAL (Sanji otomatis langsung naik tahta jadi SSR di gacha selanjutnya!)[cite: 1].
*   **`SR`**: Karakter Populer / *Main Character* anime musiman terkenal (**5.000 – 14.999 Favorites**)[cite: 1].
*   **`R`**: Karakter pendukung berbobot (**1.000 – 4.999 Favorites**)[cite: 1].
*   **`C`**: Karakter figuran / *NPC* murni (**< 1.000 Favorites**)[cite: 1].

Ganti total isi file `gachaEngine.js` kamu dengan kode di atas, lalu silakan jalankan kembali bot Mocals Chan. Sekarang nilai jual kartu di bursa pasarmu dijamin bakal jauh lebih stabil dan masuk akal![cite: 1]
