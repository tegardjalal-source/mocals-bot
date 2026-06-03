require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const cron = require('node-cron');
const { google } = require('googleapis');
// Mengimpor Engine Baru Berbasis Akurasi Tingkat Hoki (Anti Rate-Limit)
const { jalankanGacha } = require('./gachaEngine');

const BIN_ID = '6a19995121f9ee59d299ebec'; 
const MASTER_KEY = process.env.JSONBIN_KEY;

async function fetchData() {
    try {
        const res = await axios.get(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, { headers: { 'X-Master-Key': MASTER_KEY } });
        return res.data.record;
    } catch (e) { return {}; }
}

async function saveData(data) {
    try {
        await axios.put(`https://api.jsonbin.io/v3/b/${BIN_ID}`, data, { headers: { 'X-Master-Key': MASTER_KEY, 'Content-Type': 'application/json' } });
    } catch (e) { console.error("Gagal simpan:", e); }
}

// === DECK SYSTEM HELPER: Menghitung Power Kartu Secara Dinamis + Bonus Dadu Hoki ===
function hitungPowerKartu(rarity) {
    const basePower = { 'SSR': 100, 'SR': 70, 'R': 40, 'C': 20 };
    const bonusHoki = Math.floor(Math.random() * 16); // Bonus acak 0-15 poin agar adu deck tidak monoton
    return (basePower[rarity] || 20) + bonusHoki;
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const GUILD_ID = '746583847734345741';
const activeDuels = {};
const notifiedVideosCache = new Set();

// CACHE UNTUK MEREKAM TIMESTAMPS PESAN PENGGUNA (ANTI-SPAM)
const messageCounts = new Map();

// FITUR BARU: RAM Local Cache untuk mengingat status keamanan server tanpa membebani database
const securityDisabledGuilds = new Set();

const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

// === ANTI-SPAM YOUTUBE LIVE ===
async function checkYouTubeLiveStreams() {
    const data = await fetchData();
    const channels = data.ytChannels || [];

    for (const channelId of channels) {
        try {
            const playlistId = 'UU' + channelId.substring(2);
            const res = await youtube.playlistItems.list({ playlistId, part: 'snippet', maxResults: 1 });
            if (!res.data.items.length) continue;
            
            const videoId = res.data.items[0].snippet.resourceId.videoId;
            const videoRes = await youtube.videos.list({ id: videoId, part: 'snippet' });
            
            const isLive = videoRes.data.items[0].snippet.liveBroadcastContent === 'live';
            if (isLive && !notifiedVideosCache.has(videoId)) {
                console.log(`Channel ${channelId} sedang LIVE!`);
                for (const guildId in data.serverSettings) {
                    const logChannelId = data.serverSettings[guildId].ytLogChannel;
                    if (logChannelId) {
                        const channel = client.channels.cache.get(logChannelId);
                        if (channel) {
                            channel.send(`@everyone 🚨 **Ada yang lagi live nihh, jangan lupa mampir yaa...** https://www.youtube.com/watch?v=${videoId}`);
                        }
                    }
                }
                notifiedVideosCache.add(videoId);
            } 
            else if (!isLive && notifiedVideosCache.has(videoId)) {
                notifiedVideosCache.delete(videoId);
                console.log(`Live streaming ${videoId} telah selesai. Cache dibersihkan.`);
            }
        } catch (err) { 
            console.error(`Error cek channel ${channelId}:`, err.message);
        }
    }
}

async function updateBotStatus() {
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return;
        const members = await guild.members.fetch({ withPresences: true });
        const onlineCount = members.filter(m => !m.user.bot && m.presence && ['online', 'idle', 'dnd'].includes(m.presence.status)).size;
        const totalHumans = members.filter(m => !m.user.bot).size;
        const offlineCount = totalHumans - onlineCount;
        client.user.setActivity(`🍀 𝐎𝐧𝐥𝐢𝐧𝐞: ${onlineCount} | 🍁 𝐎𝐟𝐟𝐥𝐢𝐧𝐞: ${offlineCount}`, { type: ActivityType.Custom });
    } catch (e) { console.error('Gagal update status:', e); }
}

async function sendUpdateLog(guild, content) {
    const data = await fetchData();
    const logChannelId = data.serverSettings?.[guild.id]?.logChannelId;
    if (!logChannelId) return;
    const channel = guild.channels.cache.get(logChannelId);
    if (channel) {
        channel.send({
            embeds: [new EmbedBuilder().setColor(0x00FF00).setTitle('🚀 Update Fitur Bot').setDescription(content).setTimestamp()]
        });
    }
}

client.once('ready', async () => {
    console.log(`${client.user.tag} sudah siap beraksi!`);
    
    // FITUR BARU: Sinkronisasi data status keamanan server dari database ke RAM saat pertama kali menyala
    const data = await fetchData();
    if (data.serverSettings) {
        for (const guildId in data.serverSettings) {
            if (data.serverSettings[guildId].securityDisabled === true) {
                securityDisabledGuilds.add(guildId);
            }
        }
        console.log("🔒 Cache status sistem keamanan server berhasil dimuat.");
    }

    checkYouTubeLiveStreams();
    setInterval(checkYouTubeLiveStreams, 60000);
    
    const guild = client.guilds.cache.get(GUILD_ID);
    if (guild) {
        await guild.members.fetch().catch(console.error);
        console.log("Data member berhasil dimuat ke cache.");
    }
    updateBotStatus();
    setInterval(updateBotStatus, 60000);
});

// === LOGIKA AUTOMATION JAM 00:00 (ULANG TAHUN & REFRESH BLACK MARKET) ===
cron.schedule('0 0 * * *', async () => {
    const data = await fetchData();
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;

    // 1. Logika Selamat Ulang Tahun
    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }).replace('/', '-'); 

    for (const userId in data.hbd) {
        if (data.hbd[userId] === today) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                const hbdRoleId = '1509897738215624744'; 
                await member.roles.add(hbdRoleId).catch(console.error);

                const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0);
                if (channel) {
                    channel.send(`🎉 Selamat ulang tahun @${member.user.username}! Semoga harimu menyenangkan! 🎂`);
                }
            }
        }
    }

    // 2. Logika Bursa Gelap (Black Market) Otomatis
    console.log("🔄 Jam 00:00: Meriset barang di Black Market...");
    data.blackMarket = [];

    for (let i = 0; i < 5; i++) {
        const kartu = await jalankanGacha('biasa');
        if (kartu && kartu.sukses) {
            const hargaBM = Math.floor(Math.random() * 900) + 300; 
            data.blackMarket.push({
                listingId: `BM-${Math.floor(1000 + Math.random() * 9000)}`,
                id: kartu.id,
                name: kartu.name,
                rarity: kartu.rarity,
                price: hargaBM,
                isPremium: false
            });
        }
        await new Promise(resolve => setTimeout(resolve, 1300)); 
    }

    const kartuSpesial = await jalankanGacha('megaluck');
    if (kartuSpesial && kartuSpesial.sukses) {
        const hargaBMSpesial = Math.floor(Math.random() * 2000) + 1500; 
        data.blackMarket.push({
            listingId: `BM-PREM`,
            id: kartuSpesial.id,
            name: kartuSpesial.name,
            rarity: kartuSpesial.rarity,
            price: hargaBMSpesial,
            isPremium: true
        });
    }

    await saveData(data);

    const targetChannelId = data.serverSettings?.[guild.id]?.bmChannelId;
    const bmChannel = targetChannelId ? guild.channels.cache.get(targetChannelId) : (guild.systemChannel || guild.channels.cache.find(c => c.type === 0));

    if (bmChannel && data.blackMarket.length > 0) {
        let bmText = '🚨 **BLACK MARKET TELAH DI-RESET! (BERLAKU 24 JAM)** 🚨\n*Penyelundup kartu ilegal telah datang membawa barang dagangan baru:*\n\n';
        data.blackMarket.forEach((item) => {
            if (item.isPremium) {
                bmText += `🔥 **[PREMIUM ITEM] ${item.name}** [${item.rarity}]\n`;
            } else {
                bmText += `📦 **${item.name}** [${item.rarity}]\n`;
            }
            bmText += `┣ 💰 Harga Ilegal: **$${item.price}**\n`;
            bmText += `┗ 🎫 Perintah Beli: \`!buybm ${item.listingId}\`\n\n`;
        });

        const bmEmbed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle('🕵️‍♂️ BURSA RAHASIA: BLACK MARKET KARTU')
            .setDescription(bmText)
            .setFooter({ text: 'Gunakan "!buybm [Kode_Listing]" sebelum lapak disita polisi jam 00:00 besok! ⏱️' })
            .setTimestamp();

        bmChannel.send({ content: "@everyone 📑 **Ada selundupan kartu baru di pasar gelap nih!**", embeds: [bmEmbed] });
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // ========================================================
    // 🔥 FITUR INTEGRASI: DETEKSI ANTI-SPAM, PURGE & AUTO-KICK
    // ========================================================
    // Pengecekan: Hanya jalankan anti-spam jika fitur keamanan TIDAK dimatikan di server ini
    if (!securityDisabledGuilds.has(message.guild.id)) {
        // Bypass proteksi jika pengirim adalah Administrator atau memiliki izin mengelola pesan
        if (!message.member?.permissions.has('Administrator') && !message.member?.permissions.has('ManageMessages')) {
            const userId = message.author.id;
            const now = Date.now();
            const LIMIT = 5; 
            const TIME_WINDOW = 3000; 

            if (!messageCounts.has(userId)) {
                messageCounts.set(userId, []);
            }

            const timestamps = messageCounts.get(userId);
            timestamps.push(now);

            const recentMessages = timestamps.filter(ts => now - ts < TIME_WINDOW);
            messageCounts.set(userId, recentMessages);

            if (recentMessages.length > LIMIT) {
                try {
                    const fetchedMessages = await message.channel.messages.fetch({ limit: 20 });
                    const messagesToDelete = fetchedMessages.filter(m => m.author.id === userId);

                    if (messagesToDelete.size > 0) {
                        await message.channel.bulkDelete(messagesToDelete, true);
                    }

                    if (message.member && message.member.kickable) {
                        await message.member.kick('Spam berlebihan terdeteksi otomatis oleh sistem keamanan bot.');
                        
                        const antiSpamEmbed = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('🚨 TINDAKAN AUTO-MODERASI')
                            .setDescription(`**${message.author.tag}** telah ditendang dari server karena melakukan spamming secara berlebihan. Seluruh pesan terduga spam telah dibersihkan secara massal!`)
                            .setTimestamp();
                        
                        message.channel.send({ embeds: [antiSpamEmbed] });
                    }

                    messageCounts.delete(userId); 
                    return; // ⛔ STOP EKSEKUSI!
                } catch (err) {
                    console.error('Gagal memproses eksekusi sistem anti-spam:', err);
                }
            }
        }
    }
    // ========================================================

    // === PENGECKAN MENTION BOT ===
    if (message.mentions.has(client.user.id) && !message.content.startsWith('!')) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x00FF00) 
            .setTitle('📚 Pusat Bantuan Mocals Chan')
            .setDescription(
                "Haloo ada yang bisa mocals bantu?? kalo ada, kamu bisa melihat list command berikut and apa yang bisa mocals chan bantu:\n\n" +
                "`!help` - Menampilkan semua command\n" +
                "`!status` - Cek status bot\n" +
                "`!info` - Informasi lebih lanjut\n" +
                "`!gachainfo` - guide untuk market dan gacha waifu/husbando kalian! ✨"
            )
            .setFooter({ text: 'Gunakan perintah dengan bijak ya! ✨' });
        return message.reply({ embeds: [helpEmbed] }); 
    }

    const isCommand = message.content.startsWith('!');
    let command = '';
    let args = [];
    
    if (isCommand) {
        args = message.content.slice(1).trim().split(/ +/);
        command = args.shift().toLowerCase();
    }

    let data = await fetchData();

    // === KELOMPOK COMMAND 1: CORE & ADMIN CONFIG (TIDAK DAPAT XP) ===
    if (isCommand) {
        if (command === 'help') {
            const helpEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('📚 Pusat Bantuan Mocals Chan')
                .setDescription('Halo! Ini adalah daftar perintah lengkap yang bisa kamu gunakan di server:')
                .addFields(
                    { name: 'ℹ️ Hiburan & Informasi', value: '`!ping`, `!halo`, `!gabutnih`, `!rank`, `!8ball`, `!coinflip`, `!remind`, `!userinfo`, `!serverinfo`, `!status`, `!info`', inline: false },
                    { name: '💰 Ekonomi & Toko Pasar', value: '`!money`, `!work`, `!gamble`, `!leaderboard`, `!givecash`', inline: false },
                    { name: '⚔️ Duel Formasi Deck & Taruhan', value: '`!setdeck [ID_MAL]` (Pasang/copot kartu), `!deck` (Cek deck), `!duel @user` (Latihan), `!bit @user [jumlah]` (Taruhan koin), `!confirm`, `!reject`', inline: false },
                    { name: '🎂 Ulang Tahun', value: '`!sethbd DD-MM`', inline: false },
                    { name: '🔮 Gacha Multi-Luck & Album Kartu', value: '`!gacha`, `!gachaluck`, `!gachasuperluck`, `!gachamegaluck`, `!gachainfo`, `!collection`, `!charinfo`, `!topcollector`', inline: false },
                    { name: '🛒 Bursa Pasar & Black Market', value: '`!sellcard [ID] [Harga]` - Jual kartu.\n`!marketlist` - Etalase toko.\n`!buycard [Kode]`, `!buybm [Kode]`', inline: false },
                    { name: '📺 Pemantau YouTube Live', value: '`!addchannel`, `!removechannel`, `!listchannels`', inline: false }
                );

            if (message.member.permissions.has('Administrator')) {
                helpEmbed.addFields({
                    name: '🛠️ Perintah Khusus Administrator (Rahasia)',
                    value: '`!bmchannelset`, `!testbm`, `!setchannelnotif`, `!testyt`, `!setwelcome`, `!setleave`, `!testwelcome`, `!testleave`, `!setupupdate`, `!postupdate`, `!mocalschanbc`, `!teshbd`, `!enablesecurity`, `!disablesecurity`',
                    inline: false
                });
                helpEmbed.setColor('#ff0000'); 
            }

            helpEmbed.setFooter({ text: 'Gunakan perintah dengan bijak ya! ✨' });
            return message.reply({ embeds: [helpEmbed] });
        }

        if (command === 'status') {
            const statusEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🤖 Status Mocals Chan')
                .addFields(
                    { name: '🌐 Latency (Ping)', value: `${client.ws.ping}ms`, inline: true },
                    { name: '⏳ Uptime', value: `${(process.uptime() / 60).toFixed(0)} menit`, inline: true },
                    { name: '👥 Total Member', value: `${message.guild.memberCount}`, inline: true },
                    { name: '💻 Versi Node.js', value: process.version, inline: true }
                )
                .setTimestamp();
            return message.reply({ embeds: [statusEmbed] });
        }

        if (command === 'info') {
            const infoEmbed = new EmbedBuilder()
                .setColor(0xFF69B4)
                .setTitle('🌸 Tentang Mocals Chan')
                .setDescription('Hai! Aku Mocals Chan, asisten ceria yang siap menemanimu di server ini.')
                .addFields(
                    { name: '🛠️ Apa yang bisa aku lakukan?', value: 'Membantu urusan ekonomi, hiburan, hingga pengingat waktu.', inline: false },
                    { name: '✨ Dibuat dengan', value: 'Node.js & Discord.js', inline: true },
                    { name: '💖 Motoku', value: 'Selalu siap membantu dengan semangat!', inline: true }
                )
                .setFooter({ text: 'Senang bisa melayani kalian di sini! ✨' });
            return message.reply({ embeds: [infoEmbed] });
        }

        if (command === 'gachainfo') {
            const infoEmbed = new EmbedBuilder()
                .setColor(0xFF69B4)
                .setTitle('🔮 Panduan Gacha Multi-Luck & Bursa Pasar')
                .setDescription('Hai! Ini adalah tarif harga serta jaminan kasta gacha keberuntungan Mocals Chan:')
                .addFields(
                    { name: '🎲 Pilihan Kategori Gacha', value: 
                        `🔴 \`!gacha\` - Tarif: **$500** | Hasil: Acak Bebas (\`C\`, \`R\`, \`SR\`, \`SSR\`)\n` +
                        `🟢 \`!gachaluck\` - Tarif: **$3.500** | Jaminan: Minimal Rare (**\`R\`**, \`SR\`, \`SSR\`)\n` +
                        `🔵 \`!gachasuperluck\` - Tarif: **$15.000** | Jaminan: Minimal Super Rare (**\`SR\`**, \`SSR\`)\n` +
                        `🔥 \`!gachamegaluck\` - Tarif: **$75.000** | Jaminan: **Wajib Kasta Tertinggi (\`SSR\`)!**`, inline: false },
                    { name: '🗂️ Manajemen Kartu & Deck', value: '`!collection` - Album kartu.\n`!setdeck [ID]` - Pasang/copot kartu ke Deck.\n`!deck` - Cek deck aktif (Maks 3 kartu).\n`!topcollector` - Hall of Fame kolektor.', inline: false },
                    { name: '🛒 Pasar Bursa & Black Market', value: '`!sellcard [ID] [Harga]` - Jual kartu.\n`!marketlist` - Etalase toko.\n`!buycard [Kode]` - Beli bursa player.\n`!buybm [Kode]` - Ambil selundupan pasar gelap harian.', inline: false }
                )
                .setFooter({ text: 'Gunakan dana tabunganmu secara bijak ya! ✨' });
            return message.reply({ embeds: [infoEmbed] });
        }

        if (command === 'charinfo') {
            const charName = args.join(' ');
            if (!charName) {
                return message.reply('✖️ Format salah! Gunakan: `!charinfo [Nama Karakter]`\nContoh: `!charinfo Lelouch Lamperouge`');
            }

            const loadingMsg = await message.reply('🔍 Sedang mengontak database MyAnimeList... Mohon tunggu...');

            try {
                const response = await axios.get(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(charName)}&limit=1`);
                const charData = response.data?.data?.[0];

                if (!charData) {
                    return loadingMsg.edit(`✖️ Karakter dengan nama **${charName}** gagal ditemukan di MyAnimeList.`);
                }

                const name = charData.name;
                const kanjiName = charData.name_kanji ? ` (${charData.name_kanji})` : '';
                const url = charData.url;
                const imageUrl = charData.images?.jpg?.image_url || 'https://i.imgur.com/8N7V0w9.png';
                const favorites = charData.favorites ? charData.favorites.toLocaleString('id-ID') : '0';
                
                let about = charData.about || 'Tidak ada info biografi tertulis tentang karakter ini.';
                if (about.length > 1800) {
                    about = about.substring(0, 1795) + '... *(baca selengkapnya di situs MAL)*';
                }

                const charEmbed = new EmbedBuilder()
                    .setColor('#ff69b4')
                    .setTitle(`👤 Profil Karakter: ${name}${kanjiName}`)
                    .setURL(url)
                    .setDescription(about)
                    .setThumbnail(imageUrl)
                    .addFields(
                        { name: '🆔 ID MAL Karakter', value: `\`${charData.mal_id}\``, inline: true },
                        { name: '❤️ Total Penggemar', value: `👤 **${favorites} User**`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Mocals Chan Database Wiki • Powered by MyAnimeList' });

                return loadingMsg.edit({ content: '✨ Data karakter berhasil ditemukan! ✨', embeds: [charEmbed] });

            } catch (error) {
                console.error('Error saat nyari charinfo MAL:', error.message);
                if (error.response && error.response.status === 429) {
                    return loadingMsg.edit('✖️ Server MyAnimeList sedang membatasi permintaan (Rate Limit). Sembari menunggu cooldown, silakan coba lagi beberapa saat lagi!');
                }
                return loadingMsg.edit('✖️ Terjadi gangguan koneksi internet saat menghubungi server MyAnimeList.');
            }
        }

        if (command === 'bmchannelset' && message.member.permissions.has('Administrator')) {
            const ch = message.mentions.channels.first();
            if (!ch) return message.reply('✖️ Format salah! Tag channel tujuannya. Contoh: `!bmchannelset #black-market`');

            if (!data.serverSettings) data.serverSettings = {};
            if (!data.serverSettings[message.guild.id]) data.serverSettings[message.guild.id] = {};
            
            data.serverSettings[message.guild.id].bmChannelId = ch.id;
            await saveData(data);
            return message.reply(`✅ Lapak rahasia dikunci! Info selundupan Black Market harian akan dikirim otomatis ke channel ${ch}.`);
        }

        // === FITUR COMMAND ADMIN KHUSUS: MENGATUR SWITCH ON/OFF SISTEM KEAMANAN ===
        if (command === 'enablesecurity' && message.member.permissions.has('Administrator')) {
            if (!data.serverSettings) data.serverSettings = {};
            if (!data.serverSettings[message.guild.id]) data.serverSettings[message.guild.id] = {};
            
            data.serverSettings[message.guild.id].securityDisabled = false;
            await saveData(data);
            securityDisabledGuilds.delete(message.guild.id); // Hapus dari daftar RAM "fitur mati"
            
            return message.reply('✅ **Sistem Keamanan Aktif!** Fitur Anti-Spam, Auto-Purge, dan Auto-Kick sekarang berjalan penuh di server ini.');
        }

        if (command === 'disablesecurity' && message.member.permissions.has('Administrator')) {
            if (!data.serverSettings) data.serverSettings = {};
            if (!data.serverSettings[message.guild.id]) data.serverSettings[message.guild.id] = {};
            
            data.serverSettings[message.guild.id].securityDisabled = true;
            await saveData(data);
            securityDisabledGuilds.add(message.guild.id); // Daftarkan ke RAM cache sebagai server yang menonaktifkan fitur
            
            return message.reply('⚠️ **Sistem Keamanan Dimatikan!** Fitur Anti-Spam dan Auto-Kick telah dinonaktifkan. Gunakan `!enablesecurity` untuk menghidupkannya kembali.');
        }

        // 🔮 === CORE LOGIKA: MULTI-TIER LUCK GACHA ENGINE SYSTEM === 🔮
        const gachaTiers = {
            'gacha': { name: 'Normal', price: 500, allowedRarity: ['C', 'R', 'SR', 'SSR'], text: 'bebas apa aja' },
            'gachaluck': { name: 'Luck', price: 3500, allowedRarity: ['R', 'SR', 'SSR'], text: 'minimal Rare (R)' },
            'gachasuperluck': { name: 'Super Luck', price: 15000, allowedRarity: ['SR', 'SSR'], text: 'minimal Super Rare (SR)' },
            'gachamegaluck': { name: 'Mega Luck', price: 75000, allowedRarity: ['SSR'], text: 'WAJIB Maha-Langka (SSR)' }
        };

        if (gachaTiers[command]) {
            const config = gachaTiers[command];
            const userId = message.author.id;

            if (!data.economy) data.economy = {};
            if (!data.economy[userId]) data.economy[userId] = { money: 0, lastWork: 0, cards: [], deck: [] };
            const userWallet = data.economy[userId];

            if (userWallet.money < config.price) {
                return message.reply(`✖️ Dompet lu kering! Opsy gacha **!${command}** butuh dana hoki sebesar **$${config.price.toLocaleString('id-ID')}**, tabungan lu cuma ada **$${userWallet.money.toLocaleString('id-ID')}**.`);
            }

            const loadingMsg = await message.reply(`🔮 Menghubungi bursa MyAnimeList... Menyalakan ritual **${config.name} Roll** (${config.text})...`);

            try {
                const jenisEngine = command === 'gacha' ? 'biasa' : command.replace('gacha', '');
                const hasil = await jalankanGacha(jenisEngine); 

                if (!hasil || !hasil.sukses) {
                    return loadingMsg.edit(`✖️ Gagal menarik takdir karakter dari MyAnimeList. Saldo lu aman tidak terpotong, coba lagi ya!`);
                }

                userWallet.money -= config.price;
                if (!userWallet.cards) userWallet.cards = [];
                
                const sudahPunya = userWallet.cards.find(c => c.id === hasil.id);
                if (sudahPunya) {
                    sudahPunya.count += 1;
                } else {
                    userWallet.cards.push({ id: hasil.id, name: hasil.name, rarity: hasil.rarity, count: 1 });
                }

                await saveData(data);

                const warnaRarity = { 'SSR': '#ff0055', 'SR': '#ffaa00', 'R': '#00aaff', 'C': '#aaaaaa' };
                const cardEmbed = new EmbedBuilder()
                    .setTitle(`🎉 GACHA BERHASIL! [${hasil.rarity}]`)
                    .setDescription(`<@${userId}> sukses memanggil karakter dari ritual **${config.name} Gacha**!`)
                    .addFields(
                        { name: 'Nama Karakter', value: `**${hasil.name}**`, inline: true },
                        { name: 'Rarity', value: `✨ **${hasil.rarity}**`, inline: true },
                        { name: '🆔 ID MAL Karakter', value: `\`${hasil.id}\``, inline: true },
                        { name: '❤️ Total Penggemar', value: `👤 **${hasil.malRank.toLocaleString('id-ID')} User**`, inline: true },
                        { name: 'Sisa Uangmu', value: `💰 **$${userWallet.money.toLocaleString('id-ID')}**`, inline: false }
                    )
                    .setImage(hasil.image)
                    .setColor(warnaRarity[hasil.rarity] || '#ffffff')
                    .setURL(hasil.url)
                    .setFooter({ text: "Mocals Chan Multi-Luck Gacha Engine • Powered by MyAnimeList" });

                return loadingMsg.edit({ content: "✨ Takdir waifu/husbando hoki lu telah mendarat! ✨", embeds: [cardEmbed] });

            } catch (error) {
                console.error("Error Core Gacha:", error);
                return loadingMsg.edit("✖️ Terjadi kesalahan teknis internal dalam memproses transaksi gacha server.");
            }
        }

        // === FITUR BARU: !SETDECK [ID_MAL] ===
        if (command === 'setdeck') {
            const cardId = parseInt(args[0]);
            const userId = message.author.id;

            if (!cardId) return message.reply('✖️ Format salah! Gunakan: `!setdeck [ID_MAL]`\nContoh: `!setdeck 21`');

            if (!data.economy) data.economy = {};
            if (!data.economy[userId]) data.economy[userId] = { money: 0, cards: [], deck: [] };
            const userWallet = data.economy[userId];
            if (!userWallet.deck) userWallet.deck = [];

            const punyaKartu = userWallet.cards.find(c => c.id === cardId);
            if (!punyaKartu) return message.reply('✖️ Lu kagak punya kartu karakter dengan ID MAL tersebut di album lu!');

            if (userWallet.deck.includes(cardId)) {
                userWallet.deck = userWallet.deck.filter(id => id !== cardId);
                await saveData(data);
                return message.reply(`✅ Kartu **${punyaKartu.name}** berhasil dilepas dari deck aktif lu.`);
            }

            if (userWallet.deck.length >= 3) {
                return message.reply('✖️ Deck lu penuh! Maksimal cuma boleh bawa **3 kartu**. Lepas salah satu kartu dulu lewat `!setdeck [ID]` baru pasang yang baru.');
            }

            userWallet.deck.push(cardId);
            await saveData(data);
            return message.reply(`✅ **${punyaKartu.name}** [${punyaKartu.rarity}] berhasil dipasang ke deck tempur lu! (${userWallet.deck.length}/3)`);
        }

        // === FITUR BARU: !DECK ===
        if (command === 'deck') {
            const userId = message.author.id;
            const userWallet = data.economy?.[userId];
            const activeDeck = userWallet?.deck || [];

            if (activeDeck.length === 0) {
                return message.reply('📭 Deck aktif lu masih kosong melompong. Pasang waifu/husbando andalan lu pake perintah `!setdeck [ID_MAL]`!');
            }

            let deckText = `🃏 **DECK TEMPUR AKTIF LU (${activeDeck.length}/3)** 🃏\n\n`;
            let totalBasePower = 0;

            activeDeck.forEach((id, index) => {
                const rincianKartu = userWallet.cards.find(c => c.id === id);
                if (rincianKartu) {
                    deckText += `**${index + 1}. ${rincianKartu.name}** [\`${rincianKartu.rarity}\`] *(ID: \`${id}\`)*\n`;
                    totalBasePower += rincianKartu.rarity === 'SSR' ? 100 : rincianKartu.rarity === 'SR' ? 70 : rincianKartu.rarity === 'R' ? 40 : 20;
                }
            });

            const deckEmbed = new EmbedBuilder()
                .setColor('#00ffbb')
                .setTitle(`⚔️ Strategi Deck: ${message.author.username}`)
                .setDescription(deckText + `\n📈 *Estimasi Base Power Deck: **${totalBasePower} PT***`)
                .setFooter({ text: 'Ketik !setdeck [ID_MAL] pada kartu yang sama untuk mencopotnya.' });

            return message.reply({ embeds: [deckEmbed] });
        }

        // === COMMAND !SELLCARD ===
        if (command === 'sellcard') {
            const cardId = parseInt(args[0]);
            const hargaJual = parseInt(args[1]);
            const userId = message.author.id;

            if (!cardId || isNaN(hargaJual) || hargaJual <= 0) {
                return message.reply('✖️ Format salah! Gunakan: `!sellcard [ID_MAL] [Harga]`\nContoh: `!sellcard 31254 1500`');
            }

            if (!data.economy) data.economy = {};
            if (!data.economy[userId]) data.economy[userId] = { money: 0, cards: [] };
            const userWallet = data.economy[userId];

            if (!userWallet.cards || userWallet.cards.length === 0) {
                return message.reply('✖️ Lu belum punya kartu karakter sama sekali untuk dijual.');
            }

            const indexKartu = userWallet.cards.findIndex(c => c.id === cardId);
            if (indexKartu === -1) {
                return message.reply('✖️ Kartu dengan ID MAL tersebut gak ada di inventori lu.');
            }

            const kartu = userWallet.cards[indexKartu];

            if (kartu.count > 1) {
                kartu.count -= 1;
            } else {
                userWallet.cards.splice(indexKartu, 1);
            }

            if (!data.market) data.market = [];
            const listingId = Date.now().toString().slice(-6); 

            data.market.push({
                listingId: listingId,
                sellerId: userId,
                sellerName: message.author.username,
                id: kartu.id,
                name: kartu.name,
                rarity: kartu.rarity,
                price: hargaJual
            });

            await saveData(data);

            const sellEmbed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('🛒 KARTU BERHASIL DIPASARKAN!')
                .setDescription(`<@${userId}> memasang kartu ke toko market bursa!`)
                .addFields(
                    { name: '📦 Nama Karakter', value: `**${kartu.name}** (${kartu.rarity})`, inline: true },
                    { name: '🆔 ID MAL Karakter', value: `\`${kartu.id}\``, inline: true },
                    { name: '🎫 Kode Listing Toko', value: `\`${listingId}\``, inline: true },
                    { name: '💰 Value Harga', value: `**$${hargaJual}**`, inline: false }
                )
                .setFooter({ text: 'Gunakan "!buycard [Kode_Listing]" untuk membeli kartu ini!' });

            return message.reply({ embeds: [sellEmbed] });
        }

        // === COMMAND !MARKETLIST ===
        if (command === 'marketlist') {
            if (!data.market || data.market.length === 0) {
                return message.reply('📭 Bursa pasar kartu saat ini lagi kosong melompong. Belum ada yang jualan nih!');
            }

            let marketText = '';
            data.market.forEach((item, index) => {
                marketText += `**${index + 1}. ${item.name}** [${item.rarity}]\n`;
                marketText += `┣ 🆔 ID MAL: \`${item.id}\`\n`;
                marketText += `┣ 👤 Penjual: <@${item.sellerId}>\n`;
                marketText += `┣ 💰 Harga: **$${item.price.toLocaleString('id-ID')}**\n`;
                marketText += `┗ 🎫 Kode Beli: \`!buycard ${item.listingId}\`\n\n`;
            });

            if (marketText.length > 3900) {
                marketText = marketText.substring(0, 3850) + '\n*...dan beberapa kartu lainnya tidak termuat karena bursa pasar terlalu penuh!*';
            }

            const marketListEmbed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('🛒 BURSA PASAR KARTU ANIME (FOR SALE)')
                .setDescription(marketText)
                .setTimestamp()
                .setFooter({ text: 'Mocals Chan Marketplace • Segera borong waifu idamanmu! ✨' });

            return message.reply({ embeds: [marketListEmbed] });
        }

        // === COMMAND !BUYCARD ===
        if (command === 'buycard') {
            const listingId = args[0];
            const buyerId = message.author.id;

            if (!listingId) {
                return message.reply('✖️ Masukkan kode listing toko! Format: `!buycard [Kode_Listing]`');
            }

            if (!data.market || data.market.length === 0) {
                return message.reply('✖️ Bursa pasar kartu saat ini lagi kosong.');
            }

            const marketIndex = data.market.findIndex(item => item.listingId === listingId);
            if (marketIndex === -1) {
                return message.reply('✖️ Kode listing toko tidak ditemukan atau kartu sudah laku terjual.');
            }

            const itemGacha = data.market[marketIndex];

            if (itemGacha.sellerId === buyerId) {
                return message.reply('✖️ Lu gak bisa beli kartu bikinan lu sendiri kocak!');
            }

            if (!data.economy) data.economy = {};
            if (!data.economy[buyerId]) data.economy[buyerId] = { money: 0, cards: [] };
            const buyerWallet = data.economy[buyerId];

            if (buyerWallet.money < itemGacha.price) {
                return message.reply(`✖️ Duit lu kurang! Harga kartu ini **$${itemGacha.price}**, tabungan lu cuma **$${buyerWallet.money}**.`);
            }

            buyerWallet.money -= itemGacha.price;

            if (!data.economy[itemGacha.sellerId]) data.economy[itemGacha.sellerId] = { money: 0, cards: [] };
            data.economy[itemGacha.sellerId].money += itemGacha.price;

            if (!buyerWallet.cards) buyerWallet.cards = [];
            const sudahPunya = buyerWallet.cards.find(c => c.id === itemGacha.id);
            if (sudahPunya) {
                sudahPunya.count += 1;
            } else {
                buyerWallet.cards.push({ id: itemGacha.id, name: itemGacha.name, rarity: itemGacha.rarity, count: 1 });
            }

            data.market.splice(marketIndex, 1);
            await saveData(data);

            const buyEmbed = new EmbedBuilder()
                .setColor('#00ff55')
                .setTitle('🤝 TRANSAKSI MARKET BERHASIL!')
                .setDescription(`<@${buyerId}> telah membeli kartu milik **${itemGacha.sellerName}**!`)
                .addFields(
                    { name: '🛒 Karakter Dibeli', value: `**${itemGacha.name}** [${itemGacha.rarity}]`, inline: true },
                    { name: '💸 Dana Terpotong', value: `**$${itemGacha.price}**`, inline: true },
                    { name: '💰 Sisa Uangmu', value: `**$${buyerWallet.money}**`, inline: false }
                );

            return message.reply({ embeds: [buyEmbed] });
        }

        // === COMMAND !BUYBM ===
        if (command === 'buybm') {
            const listingId = args[0];
            const buyerId = message.author.id;

            if (!listingId) {
                return message.reply('✖️ Masukkan kode listing pasar gelap! Format: `!buybm [Kode_Listing]`');
            }

            if (!data.blackMarket || data.blackMarket.length === 0) {
                return message.reply('✖️ Penyelundup sedang bersembunyi. Black Market kosong saat ini.');
            }

            const bmIndex = data.blackMarket.findIndex(item => item.listingId === listingId);
            if (bmIndex === -1) {
                return message.reply('✖️ Kode listing pasar gelap salah atau kartu tersebut sudah diborong orang lain!');
            }

            const itemBM = data.blackMarket[bmIndex];

            if (!data.economy) data.economy = {};
            if (!data.economy[buyerId]) data.economy[buyerId] = { money: 0, cards: [] };
            const buyerWallet = data.economy[buyerId];

            if (buyerWallet.money < itemBM.price) {
                return message.reply(`✖️ Duit haram lu kurang! Harganya **$${itemBM.price}**, dompet lu cuma ada **$${buyerWallet.money}**.`);
            }

            buyerWallet.money -= itemBM.price;

            if (!buyerWallet.cards) buyerWallet.cards = [];
            const sudahPunya = buyerWallet.cards.find(c => c.id === itemBM.id);
            if (sudahPunya) {
                sudahPunya.count += 1;
            } else {
                buyerWallet.cards.push({ id: itemBM.id, name: itemBM.name, rarity: itemBM.rarity, count: 1 });
            }

            data.blackMarket.splice(bmIndex, 1);
            await saveData(data);

            const bmBuyEmbed = new EmbedBuilder()
                .setColor('#1a1a1a')
                .setTitle('🕵️‍♂️ TRANSAKSI GELAP SELESAI!')
                .setDescription(`<@${buyerId}> berhasil menyelundupkan kartu dari Black Market secara ilegal!`)
                .addFields(
                    { name: '📦 Kartu Selundupan', value: `**${itemBM.name}** [${itemBM.rarity}]`, inline: true },
                    { name: '💸 Dana Terpotong', value: `**$${itemBM.price}**`, inline: true },
                    { name: '💰 Sisa Uangmu', value: `**$${buyerWallet.money}**`, inline: false }
                );

            return message.reply({ embeds: [bmBuyEmbed] });
        }

        // === COMMAND KHUSUS ADMIN: !TESTBM ===
        if (command === 'testbm' && message.member.permissions.has('Administrator')) {
            const loadingBM = await message.reply("⏳ Menghubungi pasar gelap... Sedang menyelundupkan 6 barang baru dari MyAnimeList...");
            
            data.blackMarket = [];
            for (let i = 0; i < 5; i++) {
                const kartu = await jalankanGacha('biasa'); 
                if (kartu && kartu.sukses) {
                    const hargaBM = Math.floor(Math.random() * 900) + 300;
                    data.blackMarket.push({
                        listingId: `BM-${Math.floor(1000 + Math.random() * 9000)}`,
                        id: kartu.id,
                        name: kartu.name,
                        rarity: kartu.rarity,
                        price: hargaBM,
                        isPremium: false
                    });
                }
                await new Promise(resolve => setTimeout(resolve, 1300));
            }

            const kartuSpesial = await jalankanGacha('megaluck'); 
            if (kartuSpesial && kartuSpesial.sukses) {
                const hargaBMSpesial = Math.floor(Math.random() * 2000) + 1500;
                data.blackMarket.push({
                    listingId: `BM-PREM`,
                    id: kartuSpesial.id,
                    name: kartuSpesial.name,
                    rarity: kartuSpesial.rarity,
                    price: hargaBMSpesial,
                    isPremium: true
                });
            }

            await saveData(data);

            const targetChannelId = data.serverSettings?.[message.guild.id]?.bmChannelId;
            const destChannel = targetChannelId ? message.guild.channels.cache.get(targetChannelId) : message.channel;

            let bmText = '🚨 **BLACK MARKET TELAH DI-RESET! (TEST MODE)** 🚨\n*Penyelundup kartu ilegal telah datang membawa barang dagangan baru:*\n\n';
            data.blackMarket.forEach((item) => {
                if (item.isPremium) {
                    bmText += `🔥 **[PREMIUM ITEM] ${item.name}** [${item.rarity}]\n`;
                } else {
                    bmText += `📦 **${item.name}** [${item.rarity}]\n`;
                }
                bmText += `┣ 💰 Harga Ilegal: **$${item.price}**\n`;
                bmText += `┗ 🎫 Perintah Beli: \`!buybm ${item.listingId}\`\n\n`;
            });

            const bmEmbed = new EmbedBuilder()
                .setColor('#2f3136')
                .setTitle('🕵️‍♂️ BURSA RAHASIA: BLACK MARKET KARTU')
                .setDescription(bmText)
                .setTimestamp();

            await loadingBM.delete();
            return destChannel.send({ content: "@everyone 📑 **[SIMULASI] Lapak bursa rahasia Black Market berhasil dibuka secara paksa!**", embeds: [bmEmbed] });
        }

        // === COMMAND !TOPCOLLECTOR ===
        if (command === 'topcollector') {
            if (!data.economy) data.economy = {};

            const rarityOrder = { 'SSR': 1, 'SR': 2, 'R': 3, 'C': 4 };

            const listCollector = Object.entries(data.economy)
                .map(([id, profile]) => {
                    let totalKartu = 0;
                    let top5Cards = [];
                    
                    if (profile.cards && Array.isArray(profile.cards)) {
                        totalKartu = profile.cards.reduce((acc, curr) => acc + (curr.count || 1), 0);
                        
                        top5Cards = [...profile.cards]
                            .sort((a, b) => (rarityOrder[a.rarity] || 5) - (rarityOrder[b.rarity] || 5))
                            .slice(0, 5);
                    }
                    return { userId: id, total: totalKartu, top5: top5Cards };
                })
                .filter(u => u.total > 0)
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);

            if (listCollector.length === 0) {
                return message.reply('📭 Belum ada kolektor kartu anime di server ini.');
            }

            let descriptionText = '';
            const trophy = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅', '🏅', '🏅', '🏅', '🏅'];

            listCollector.forEach((user, index) => {
                const topCardsText = user.top5
                    .map(c => `**${c.name}** (\`${c.rarity}\`)`)
                    .join(', ');

                descriptionText += `${trophy[index]} **Peringkat ${index + 1}** • <@${user.userId}>\n`;
                descriptionText += `┣ Total Koleksi: **${user.total} Kartu**\n`;
                descriptionText += `┗ **Top 5**: ${topCardsText || 'Belum memiliki koleksi'}\n\n`;
            });

            const collectorEmbed = new EmbedBuilder()
                .setColor('#00aaff')
                .setTitle('🏆 HALL OF FAME: TOP 10 ANIME CARD COLLECTORS')
                .setDescription(descriptionText)
                .setTimestamp()
                .setFooter({ text: 'Mocals Chan Gacha League • Terus kumpulkan waifumu! ✨' });

            return message.reply({ embeds: [collectorEmbed] });
        }

        // === COMMAND !COLLECTION ===
        if (command === 'collection') {
            const targetMember = message.mentions.members.first() || message.member;
            const targetId = targetMember.id;

            if (!data.economy) data.economy = {};
            const targetWallet = data.economy[targetId];

            if (!targetWallet || !targetWallet.cards || targetWallet.cards.length === 0) {
                return message.reply(`📭 ${targetMember.user.username} belum memiliki koleksi kartu karakter anime sama sekali.`);
            }

            const rarityOrder = { 'SSR': 1, 'SR': 2, 'R': 3, 'C': 4 };
            const sortedCards = [...targetWallet.cards].sort((a, b) => {
                return (rarityOrder[a.rarity] || 5) - (rarityOrder[b.rarity] || 5);
            });

            let collectionText = '';
            sortedCards.forEach((kartu, index) => {
                collectionText += `**${index + 1}. ${kartu.name}** • \`${kartu.rarity}\` • x${kartu.count || 1} *(ID: \`${kartu.id}\`)*\n`;
            });

            if (collectionText.length > 3900) {
                collectionText = collectionText.substring(0, 3850) + '\n*...dan beberapa kartu lainnya tidak termuat karena lemari koleksi penuh!*';
            }

            const collectionEmbed = new EmbedBuilder()
                .setColor('#00ffbb')
                .setTitle(`🗂️ Album Koleksi Anime: ${targetMember.user.username}`)
                .setDescription(collectionText)
                .setThumbnail(targetMember.user.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: `Mocals Chan Album League • Diminta oleh ${message.author.username}` });

            return message.reply({ embeds: [collectionEmbed] });
        }

        // --- MANAJEMEN YOUTUBE NOTIF ---
        if (command === 'setchannelnotif' && message.member.permissions.has('Administrator')) {
            const ch = message.mentions.channels.first();
            if (!ch) return message.reply('Tag channel-nya!');
            if (!data.serverSettings) data.serverSettings = {};
            if (!data.serverSettings[message.guild.id]) data.serverSettings[message.guild.id] = {};
            
            data.serverSettings[message.guild.id].ytLogChannel = ch.id;
            await saveData(data);
            return message.reply(`✅ Channel notification live diatur ke ${ch}`);
        }

        if (command === 'addchannel') {
            const id = args[0];
            if (!id) return message.reply('Masukkan ID channel!');
            if (!data.ytChannels) data.ytChannels = [];
            if (data.ytChannels.includes(id)) return message.reply('Channel sudah ada di list!');
            
            data.ytChannels.push(id);
            await saveData(data);
            return message.reply(`✅ Channel ${id} berhasil ditambahkan!`);
        }

        if (command === 'listchannels') {
            const channels = data.ytChannels || [];
            if (channels.length === 0) return message.reply('Belum ada channel.');

            const channelDetails = await Promise.all(channels.map(async (id) => {
                try {
                    const res = await youtube.channels.list({ id: id, part: 'snippet' });
                    const title = res.data.items[0].snippet.title;
                    return `${title} (https://www.youtube.com/channel/${id})`;
                } catch (e) { return `Channel ID: ${id} (Error mengambil nama)`; }
            }));
            const list = channelDetails.map((info, index) => `${index + 1}. ${info}`).join('\n');
            return message.reply(`📺 **Daftar Channel Dipantau**:\n${list}`);
        }

        if (command === 'testyt' && message.member.permissions.has('Administrator')) {
            message.reply('🔄 Memulai pengecekan live YouTube secara manual...');
            const channels = data.ytChannels || [];
            const logChannelId = data.serverSettings?.[message.guild.id]?.ytLogChannel;
            const targetChannel = logChannelId ? client.channels.cache.get(logChannelId) : null;

            if (!logChannelId || !targetChannel) {
                return message.channel.send('❌ Channel notifikasi belum diatur. Gunakan `!setchannelnotif #channel`!');
            }

            let found = false;
            for (const channelId of channels) {
                try {
                    const playlistId = 'UU' + channelId.substring(2);
                    const res = await youtube.playlistItems.list({ playlistId, part: 'snippet', maxResults: 1 });
                    if (!res.data.items.length) continue;
                    
                    const videoId = res.data.items[0].snippet.resourceId.videoId;
                    const videoRes = await youtube.videos.list({ id: videoId, part: 'snippet' });
                    if (videoRes.data.items[0]?.snippet?.liveBroadcastContent === 'live') {
                        targetChannel.send(`📢 **[TEST]** Channel YouTube sedang LIVE! https://www.youtube.com/watch?v=${videoId}`);
                        found = true;
                    }
                } catch (err) { console.error(`Error test channel ${channelId}:`, err.message); }
            }
            if (!found) message.channel.send('⚠️ Tidak ada channel di list yang sedang live saat ini.');
            return message.channel.send('✅ Pengecekan manual selesai.');
        }

        if (command === 'removechannel') {
            const id = args[0];
            if (!data.ytChannels) return message.reply('List channel kosong!');
            data.ytChannels = data.ytChannels.filter(c => c !== id);
            await saveData(data);
            return message.reply(`✅ Channel ${id} dihapus dari list.`);
        }

        // --- WELCOME & LEAVE CONFIG ---
        if (command === 'setwelcome' && message.member.permissions.has('Administrator')) {
            const ch = message.mentions.channels.first();
            if (!ch) return message.reply('Tag channel-nya! Contoh: !setwelcome #welcome');
            if (!data.serverSettings) data.serverSettings = {};
            if (!data.serverSettings[message.guild.id]) data.serverSettings[message.guild.id] = {};
            data.serverSettings[message.guild.id].welcomeId = ch.id;
            await saveData(data);
            return message.reply(`✅ Channel welcome berhasil diatur ke ${ch}`);
        }

        if (command === 'setleave' && message.member.permissions.has('Administrator')) {
            const ch = message.mentions.channels.first();
            if (!ch) return message.reply('Tag channel-nya! Contoh: !setleave #leave');
            if (!data.serverSettings) data.serverSettings = {};
            if (!data.serverSettings[message.guild.id]) data.serverSettings[message.guild.id] = {};
            data.serverSettings[message.guild.id].leaveId = ch.id;
            await saveData(data);
            return message.reply(`✅ Channel leave berhasil diatur ke ${ch}`);
        }
        
        if (command === 'testwelcome' && message.member.permissions.has('Administrator')) {
            client.emit('guildMemberAdd', message.member);
            return message.reply('✅ Simulasi event `guildMemberAdd` dijalankan.');
        }

        if (command === 'testleave' && message.member.permissions.has('Administrator')) {
            client.emit('guildMemberRemove', message.member);
            return message.reply('✅ Simulasi event `guildMemberRemove` dijalankan.');
        }

        // --- CONFIG UPDATES & BROADCAST ---
        if (command === 'setupupdate' && message.member.permissions.has('Administrator')) {
            const ch = message.mentions.channels.first();
            if (!ch) return message.reply('Tag channel!');
            if (!data.serverSettings) data.serverSettings = {};
            data.serverSettings[message.guild.id] = { logChannelId: ch.id };
            await saveData(data);
            return message.reply(`✅ Log diatur ke ${ch}`);
        }
        
        if (command === 'postupdate' && message.member.permissions.has('Administrator')) {
            sendUpdateLog(message.guild, args.join(' '));
            return message.reply('✅ Terkirim!');
        }

        if (command === 'mocalschanbc' && message.member.permissions.has('Administrator')) {
            const targetChannel = message.mentions.channels.first();
            const broadcastMsg = message.content.slice(14).replace(/<#[0-9]+>/, '').trim();

            if (!targetChannel || !broadcastMsg) {
                return message.reply('Format salah! Contoh: !mocalschanbc #announcement Pesan kamu');
            }

            let successCount = 0;
            client.guilds.cache.forEach(guild => {
                const channel = guild.channels.cache.get(targetChannel.id);
                if (channel) {
                    channel.send(`📢 **Broadcast**: ${broadcastMsg}`).catch(console.error);
                    successCount++;
                }
            });
            return message.reply(`✅ Pesan berhasil dibroadcast ke ${successCount} server!`);     
        }
    }

    // === KELOMPOK OPERATIONS BACKGROUND: LOGIKA XP & MESSAGE COUNTER ===
    if (!data.messages) data.messages = {};
    data.messages[message.author.id] = (data.messages[message.author.id] || 0) + 1;
    if (!data.xp) data.xp = {};
    if (!data.xp[message.author.id]) data.xp[message.author.id] = { xp: 0, level: 1 };
    data.xp[message.author.id].xp += Math.floor(Math.random() * 6) + 5;
    let neededXP = data.xp[message.author.id].level * 100;
    if (data.xp[message.author.id].xp >= neededXP) {
        data.xp[message.author.id].level += 1;
        data.xp[message.author.id].xp = 0;
        message.channel.send(`🎉 Selamat ${message.author}, kamu naik ke **Level ${data.xp[message.author.id].level}**! ✨`);
    }
    await saveData(data);

    // === KELOMPOK COMMAND 2: UTILITY & ECONOMY (DAPAT XP) ===
    if (isCommand) {
        if (command === 'ping') return message.reply('Pong! 🏓');
        if (command === 'halo') return message.reply(`Halo ${message.author}! Mocals Bot siap membantu. ✨`);
        if (command === 'gabutnih') return message.reply('SAMA, AKU JUGA GABUT😠😠😠😠');
        
        if (command === 'rank') {
            const userXP = data.xp[message.author.id] || { xp: 0, level: 1 };
            return message.reply(`📊 **Status Mocals Bot**\nLevel: **${userXP.level}**\nXP: **${userXP.xp}**`);
        }

        // === UPGRADE LOGIKA DECK: DUEL BIASA (ADU STRATEGI DECK) ===
        if (command === 'duel') {
            const lawan = message.mentions.members.first();
            if (!lawan) return message.reply('Tag dulu lawanmu!');
            if (lawan.user.bot) return message.reply('Bot tidak bisa diajak duel! 🤖');
            if (lawan.id === message.author.id) return message.reply('Masa duel sama diri sendiri? 😅');

            const deckPenantang = data.economy?.[message.author.id]?.deck || [];
            if (deckPenantang.length === 0) {
                return message.reply('✖️ Lu belum nyusun deck tempur lu! Atur dulu waifu andalan lu pake `!setdeck [ID]`.');
            }

            const deckLawan = data.economy?.[lawan.id]?.deck || [];
            if (deckLawan.length === 0) {
                return message.reply(`✖️ Gak bisa ditantang! <@${lawan.id}> belum menyusun deck aktifnya.`);
            }

            // Jalankan simulasi tarung instan tanpa taruhan koin
            let powerPenantang = 0;
            deckPenantang.forEach(id => {
                const k = data.economy[message.author.id].cards.find(c => c.id === id);
                if (k) powerPenantang += hitungPowerKartu(k.rarity);
            });

            let powerLawan = 0;
            deckLawan.forEach(id => {
                const k = data.economy[lawan.id].cards.find(c => c.id === id);
                if (k) powerLawan += hitungPowerKartu(k.rarity);
            });

            const pemenang = powerPenantang > powerLawan ? message.author.username : lawan.user.username;
            const pecundang = pemenang === message.author.username ? lawan.user.username : message.author.username;

            message.channel.send(`⚔️ **${message.author.username}** menantang **${lawan.user.username}** untuk adu formasi deck kartu!`);
            setTimeout(() => message.channel.send(`💥 *JLEB! Efek sinergi bertubrukan, angka kalkulator perang bergulir...*`), 1500);
            return setTimeout(() => {
                message.channel.send(`🏆 **Hasil Pertandingan Album:**\n┣ 📊 Power Deck **${message.author.username}**: \`${powerPenantang} PT\`\n┣ 📊 Power Deck **${lawan.user.username}**: \`${powerLawan} PT\`\n\n👑 Selamat **${pemenang}** berhasil menggilas formasi deck milik **${pecundang}**!`);
            }, 3500);
        }

        if (command === '8ball') {
            const q = args.join(' ');
            const ans = ['Ya, tentu saja! ✨', 'Sepertinya tidak...', 'Moking nanti.', 'Jangan harap.', 'Tentu saja! 🍀', 'Tidak mungkin.'];
            return message.reply(`🎱 **Pertanyaan**: ${q || 'kosong'}\n**Jawaban**: ${ans[Math.floor(Math.random() * ans.length)]}`);
        }

        if (command === 'coinflip') {
            const hasil = Math.random() < 0.5 ? 'Kepala (Heads)' : 'Ekor (Tails)';
            return message.reply(`🪙 Hasil coin flip adalah: **${hasil}**`);
        }
        
        if (command === 'remind') {
            const waktu = parseInt(args[0]);
            const pesan = args.slice(1).join(' ');
            if (!waktu || !pesan) return message.reply('Remind buat apatu?? Contoh: !remind 60 belajar (60 itu 1 menit yah)');
            message.reply(`✅ Oke, diingatkan dalam ${waktu} detik.`);
            return setTimeout(() => message.channel.send(`⏰ ${message.author}, pengingat: **${pesan}**`), waktu * 1000);
        }

        if (command === 'userinfo') {
            const member = message.mentions.members.first() || message.member;
            const roles = member.roles.cache.filter(r => r.id !== message.guild.id).map(r => `<@&${r.id}>`).join(', ') || 'Tidak ada';
            const joinedYears = Math.floor((new Date() - member.joinedAt) / (1000 * 60 * 60 * 24 * 365));
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle(`👤 Informasi User: ${member.user.username}`)
                    .setThumbnail(member.user.displayAvatarURL())
                    .addFields(
                        { name: 'ID', value: `\`${member.id}\``, inline: true },
                        { name: 'Bergabung di Server', value: `${joinedYears} years ago`, inline: true },
                        { name: 'Total Pesan', value: `\`${data.messages?.[member.id] || 0}\``, inline: true },
                        { name: 'Roles', value: roles }
                    )
                ]
            });
        }

        if (command === 'serverinfo') {
            const { guild } = message;
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle(`🏠 Info Server: ${guild.name}`)
                        .addFields(
                            { name: 'Total Member', value: `\`${guild.memberCount}\``, inline: true },
                            { name: 'Dibuat pada', value: guild.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), inline: true }
                        )
                ]
            });
        }

        if (command === 'teshbd' && message.member.permissions.has('Administrator')) {
            const hbdRoleId = '1509897738215624744';
            if (!message.member.roles.cache.has(hbdRoleId)) {
                message.member.roles.add(hbdRoleId).catch(console.error);
            }
            message.channel.send(`🎉 (TEST) Selamat ulang tahun ${message.author}! Semoga harimu menyenangkan! 🎂`);
            return setTimeout(() => {
                message.member.roles.remove(hbdRoleId).catch(console.error);
                message.channel.send(`⏱️ (TEST) Role HBD telah dihapus dari ${message.author}.`);
            }, 5000);
        }

        if (command === 'sethbd') {
            const tgl = args[0];
            const dateRegex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])$/;

            if (!tgl || !dateRegex.test(tgl)) {
                return message.reply('❌ Format salah! Gunakan format `DD-MM`. Contoh: `!sethbd 10-05`');
            }
            if (!data.hbd) data.hbd = {};
            data.hbd[message.author.id] = tgl;
            await saveData(data);
            return message.reply('✅ Tanggal ultah disimpan!');
        }

        // --- SISTEM EKONOMI ---
        if (command === 'money') {
            if (!data.economy) data.economy = {};
            const user = data.economy[message.author.id] || { money: 0 };
            return message.reply(`💰 Saldo kamu saat ini: **${user.money}**`);
        }

        if (command === 'reject') {
            const duel = activeDuels[message.author.id];
            if (!duel) return message.reply('Kamu tidak sedang ditantang!');
            delete activeDuels[message.author.id];
            return message.channel.send(`🚫 ${message.author} menolak tantangan duel!`);
        }

        if (command === 'work') {
            if (!data.economy) data.economy = {};
            const user = data.economy[message.author.id] || { money: 0, lastWork: 0 };
            const now = Date.now();
            if (now - user.lastWork < 300000) {
                return message.reply('⏳ Kamu capek! Istirahat dulu 5 menit.');
            }
            
            const reward = Math.floor(Math.random() * 500) + 100;
            user.money += reward;
            user.lastWork = now; 
            data.economy[message.author.id] = user;
            await saveData(data);
            return message.reply(`💼 Kamu bekerja dan mendapatkan **${reward}**!`);
        }

        if (command === 'gamble') {
            const amount = parseInt(args[0]);
            if (!data.economy) data.economy = {};
            const user = data.economy[message.author.id];
            if (!user || user.money < amount) return message.reply('❌ Uang kamu tidak cukup!');
            if (!amount || amount <= 0) return message.reply('Masukkan jumlah yang benar!');

            const win = Math.random() < 0.45;
            if (win) {
                user.money += amount;
                message.reply(`🎰 Menang! Kamu dapat **${amount}**. Saldo: ${user.money}`);
            } else {
                user.money -= amount;
                message.reply(`💸 Kalah! Kamu kehilangan **${amount}**. Saldo: ${user.money}`);
            }
            data.economy[message.author.id] = user;
            await saveData(data);
            return;
        }

        // === UPGRADE LOGIKA DECK: TARUHAN COIN !BIT ===
        if (command === 'bit') {
            const lawan = message.mentions.members.first();
            const jumlah = parseInt(args[1]);
            
            if (!lawan || !jumlah || jumlah <= 0) return message.reply('Format: !bit @user [jumlah_taruhan]');
            if (lawan.id === message.author.id) return message.reply('Gak bisa lawan diri sendiri!');

            const deckPenantang = data.economy?.[message.author.id]?.deck || [];
            if (deckPenantang.length === 0) return message.reply('✖️ Deck lu kosong! Pasang kartu andalan dulu pake `!setdeck [ID]`.');

            const deckLawan = data.economy?.[lawan.id]?.deck || [];
            if (deckLawan.length === 0) return message.reply(`✖️ <@${lawan.id}> belum menyusun deck aktifnya, tidak bisa diajak judi bit.`);

            if (activeDuels[lawan.id]) return message.reply('Lawan sedang ditantang orang lain, tunggu ya!');
            activeDuels[lawan.id] = { penantang: message.author.id, jumlah: jumlah };
            message.channel.send(`⚔️ ${lawan}, kamu ditantang oleh ${message.author} bertaruh judi deck sebesar **$${jumlah}**! Ketik \`!confirm\` atau \`!reject\` dalam 1 menit.`);
            return setTimeout(() => {
                if (activeDuels[lawan.id] && activeDuels[lawan.id].penantang === message.author.id) {
                    delete activeDuels[lawan.id];
                    message.channel.send(`⏳ Tantangan taruhan dari ${message.author} untuk ${lawan} kedaluwarsa.`);
                }
            }, 60000);
        }

        // === UPGRADE LOGIKA DECK: CONFIRM TARUHAN (HITUNG POWER DECK) ===
        if (command === 'confirm') {
            const duel = activeDuels[message.author.id];
            if (!duel) return message.reply('Kamu tidak sedang ditantang!');
            
            const idLawan = message.author.id; 
            const idPenantang = duel.penantang; 

            const deckLawan = data.economy?.[idLawan]?.deck || [];
            const deckPenantang = data.economy?.[idPenantang]?.deck || [];

            if (deckLawan.length === 0) return message.reply('✖️ Gak bisa mulai, deck aktif lu kosong! Atur dulu lewat `!setdeck`.');

            // 1. Kalkulasi Deck Penantang
            let powerPenantang = 0;
            deckPenantang.forEach(id => {
                const k = data.economy[idPenantang].cards.find(c => c.id === id);
                if (k) powerPenantang += hitungPowerKartu(k.rarity);
            });

            // 2. Kalkulasi Deck Lawan
            let powerLawan = 0;
            deckLawan.forEach(id => {
                const k = data.economy[idLawan].cards.find(c => c.id === id);
                if (k) powerLawan += hitungPowerKartu(k.rarity);
            });

            const menangId = powerPenantang > powerLawan ? idPenantang : idLawan;
            const kalahId = menangId === idLawan ? idPenantang : idLawan;

            if ((data.economy[idPenantang]?.money || 0) < duel.jumlah || (data.economy[idLawan]?.money || 0) < duel.jumlah) {
                delete activeDuels[message.author.id];
                return message.channel.send('✖️ Pertarungan dibatalkan karena salah satu pihak kehabisan uang sebelum tanding.');
            }

            data.economy[menangId].money += duel.jumlah;
            data.economy[kalahId].money -= duel.jumlah;
            await saveData(data);

            let battleText = `🏆 **JUDI BIT DECK KARTU SELESAI!** 🏆\n\n`;
            battleText += `⚔️ **Deck Penantang (<@${idPenantang}>)**: Total Power \`${powerPenantang} PT\`\n`;
            battleText += `🛡️ **Deck Lawan (<@${idLawan}>)**: Total Power \`${powerLawan} PT\`\n\n`;
            battleText += `👑 Selamat untuk <@${menangId}> karena formasi deck lu menang unggul dan berhak merampas koin taruhan sebesar **$${duel.jumlah}**!`;

            message.channel.send(battleText);
            delete activeDuels[message.author.id];
            return;
        }

        if (command === 'givecash') {
            const penerima = message.mentions.members.first();
            const jumlah = parseInt(args[1]);
            if (!penerima || !jumlah) return message.reply('Format: !givecash @user [jumlah]');
            if (!data.economy) data.economy = {};
            if (!data.economy[message.author.id] || data.economy[message.author.id].money < jumlah) return message.reply('Uang tidak cukup!');
            data.economy[message.author.id].money -= jumlah;
            if (!data.economy[penerima.id]) data.economy[penerima.id] = { money: 0, lastWork: 0 };
            data.economy[penerima.id].money += jumlah;
            await saveData(data);
            return message.reply(`✅ Berhasil mengirim ${jumlah} ke ${penerima}!`);
        }

        if (command === 'leaderboard') {
            if (!data.economy) data.economy = {};
            const sorted = Object.entries(data.economy)
                .sort((a, b) => (b[1].money || 0) - (a[1].money || 0))
                .slice(0, 5);
            let text = '🏆 **Top 5 Orang Terkaya**:\n';
            for (let i = 0; i < sorted.length; i++) {
                text += `${i+1}. <@${sorted[i][0]}>: **${sorted[i][1].money || 0}**\n`;
            }
            return message.reply(text);
        }
    }
});

// --- EVENT JOIN & LEAVE ---
client.on('guildMemberAdd', async (member) => { 
    const data = await fetchData(); 
    const serverData = data.serverSettings?.[member.guild.id];
    const welcomeId = serverData ? serverData.welcomeId : null;

    if (welcomeId) {
        const ch = member.guild.channels.cache.get(welcomeId);
        if (ch) ch.send(`Welcome imoet ${member}! ✨`);
    }
});

client.on('guildMemberRemove', async (member) => { 
    const data = await fetchData(); 
    const serverData = data.serverSettings?.[member.guild.id];
    const leaveId = serverData ? serverData.leaveId : null;

    if (leaveId) {
        const ch = member.guild.channels.cache.get(leaveId);
        if (ch) ch.send(`Dadah ${member.user.tag}, sampai jumpa lagi! 😢`);
    }
});

client.login(process.env.DISCORD_TOKEN);
