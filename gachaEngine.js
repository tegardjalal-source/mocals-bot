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
        // Mengambil karakter acak dari API MyAnimeList (Jikan v4)
        const response = await axios.get('https://api.jikan.moe/v4/random/characters');
        const character = response.data?.data;

        // Validasi jika API mengembalikan data kosong atau error internal
        if (!character || !character.mal_id) {
            return { 
                sukses: false, 
                pesan: '✖️ Takdir waifu/husbando kamu gagal terbaca oleh bintang-bintang. Server MAL sedang sibuk, coba lagi ya!' 
            };
        }

        // Ekstraksi data sesuai dengan kebutuhan Embed di index.js kamu
        const id = character.mal_id;
        const name = character.name;
        const url = character.url;
        const rarity = tentukanRarity();
        
        // Ambil gambar JPG (bisa fallback ke WebP atau gambar default jika kosong)
        const image = character.images?.jpg?.image_url || 'https://i.imgur.com/8N7V0w9.png';

        return {
            sukses: true,
            id: id,
            name: name,
            rarity: rarity,
            image: image,
            url: url
        };

    } catch (error) {
        console.error('Error saat gacha MAL:', error.message);
        
        // Antisipasi jika terkena Rate Limit (HTTP 429) dari API gratisan Jikan
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

module.exports = { rollGachaMALResmi };
