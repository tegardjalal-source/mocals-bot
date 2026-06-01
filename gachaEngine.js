const axios = require('axios');

/**
 * Fungsi acak untuk menentukan Rarity kartu gacha
 * Gacha Rate: SSR (2%), SR (10%), R (30%), C (58%)
 */
function tentukanRarity() {
    const rate = Math.random() * 100;
    if (rate < 2) return 'SSR';
    if (rate < 12) return 'SR';
    if (rate < 42) return 'R';
    return 'C';
}

/**
 * Mengambil data karakter acak langsung dari database MyAnimeList via Jikan API
 */
async function rollGachaMALResmi() {
    try {
        const response = await axios.get('https://api.jikan.moe/v4/random/characters');
        const character = response.data?.data;

        if (!character || !character.mal_id) {
            return { 
                sukses: false, 
                pesan: '✖️ Takdir waifu/husbando kamu gagal terbaca oleh bintang-bintang. Server MAL sedang sibuk, coba lagi ya!' 
            };
        }

        const id = character.mal_id;
        const name = character.name;
        const url = character.url;
        const rarity = tentukanRarity();
        
        // Perbaikan: Mengambil murni jumlah user yang memfavoritkan karakter (format angka Indonesia, misal: 15.230)
        // Jika kosong/tidak ada, otomatis diisi string '0'
        const malRank = character.favorites ? character.favorites.toLocaleString('id-ID') : '0';

        const image = character.images?.jpg?.image_url || 'https://i.imgur.com/8N7V0w9.png';

        return {
            sukses: true,
            id: id,
            name: name,
            rarity: rarity,
            image: image,
            url: url,
            malRank: malRank
        };

    } catch (error) {
        console.error('Error saat gacha MAL:', error.message);
        if (error.response && error.response.status === 429) {
            return { 
                sukses: false, 
                pesan: '✖️ Server MyAnimeList sedang membatasi permintaan (Rate Limit). Sembari menunggu cooldown, silakan coba beberapa saat lagi!' 
            };
        }
        return { 
            sukses: false, 
            pesan: '✖️ Terjadi gangguan koneksi saat menghubungi server MyAnimeList.' 
        };
    }
}

/**
 * Fungsi khusus Black Market: Menjamin Rarity Bagus Tinggi
 * Rate: SR (70%), SSR (30%)
 */
function tentukanRarityBagus() {
    return Math.random() * 100 < 30 ? 'SSR' : 'SR';
}

/**
 * Menghasilkan kartu acak khusus dengan jaminan Rarity tinggi
 */
async function rollKartuBagus() {
    try {
        const response = await axios.get('https://api.jikan.moe/v4/random/characters');
        const character = response.data?.data;
        if (!character || !character.mal_id) return null;

        return {
            id: character.mal_id,
            name: character.name,
            rarity: tentukanRarityBagus(), // Jaminan SR/SSR
            favorites: character.favorites || 0
        };
    } catch (e) {
        return null;
    }
}

// UPDATE module.exports kamu di paling bawah menjadi seperti ini:
module.exports = { rollGachaMALResmi, rollKartuBagus };
