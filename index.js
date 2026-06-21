require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder, ChannelType } = require('discord.js');
const axios = require('axios');
const cron = require('node-cron');
const { google } = require('googleapis');
const express = require('express'); 
const bodyParser = require('body-parser'); 
const { initVoiceMaster, handleVoiceMasterCommands } = require('./voiceMaster'); 
const { handleDonationCommands, handleSaweriaWebhook } = require('./donation'); 
const { createCustomImage } = require('./welcomeImage'); 
const { handleAntiSpam, handleAntiPhising } = require('./securityManager'); 
const { handleGameCommands } = require('./gameManager'); 

// 👇 BARU: Mengambil logika AI Gemini dari aiManager.js
const { handleAIChat } = require('./aiManager'); 

const BIN_ID = '6a2f39cdda38895dfec0a8ab'; 
const MASTER_KEY = process.env.JSONBIN_KEY;
const GUILD_ID = '746583847734345741';
let isDatabaseLoaded = false;

// Variabel Global untuk Sistem Cooldown
if (!global.commandCooldowns) {
    global.commandCooldowns = new Map();
}

async function fetchData() {
    try {
        const res = await axios.get(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, { headers: { 'X-Master-Key': MASTER_KEY } });
        isDatabaseLoaded = true;
        return res.data.record || {};
    } catch (e) { 
        console.error("Gagal memuat database saat startup:", e.message);
        throw e; 
    }
}

async function saveData(data) {
    if (!isDatabaseLoaded || !data || Object.keys(data).length === 0) {
        console.error("⚠️ [Auto-Save] Pembatalan backup: Data RAM kosong atau database gagal dimuat saat boot.");
        return;
    }
    try {
        await axios.put(`https://api.jsonbin.io/v3/b/${BIN_ID}`, data, { headers: { 'X-Master-Key': MASTER_KEY, 'Content-Type': 'application/json' } });
        console.log("💾 [Auto-Save] Data RAM berhasil dicadangkan ke JSONBin.");
    } catch (e) { console.error("Gagal simpan ke JSONBin:", e.message); }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates 
    ]
});

const notifiedVideosCache = new Set();
const messageCounts = new Map();
const securityDisabledGuilds = new Set();
let globalDbCache = {};

const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

function convertChannelIdToUploadsPlaylistId(channelId) {
    if (channelId.startsWith('UC')) return 'UU' + channelId.substring(2);
    return channelId;
}

async function checkYouTubeLiveStreams(discordClient) {
    console.log(`[${new Date().toLocaleString()}] Memulai pengecekan berkala live stream YouTube...`);
    try {
        const channels = globalDbCache.ytChannels || [];
        if (channels.length === 0) return;

        for (const channelId of channels) {
            try {
                const playlistId = convertChannelIdToUploadsPlaylistId(channelId);
                const playlistResponse = await youtube.playlistItems.list({ playlistId: playlistId, part: 'snippet', maxResults: 1 });
                const items = playlistResponse.data.items;
                if (!items || items.length === 0) continue;

                const latestPlaylistItem = items[0];
                const videoId = latestPlaylistItem.snippet.resourceId.videoId;
                const channelName = latestPlaylistItem.snippet.channelTitle;
                const title = latestPlaylistItem.snippet.title;

                if (notifiedVideosCache.has(videoId)) continue;

                const videoResponse = await youtube.videos.list({ id: videoId, part: 'snippet' });
                const videoItems = videoResponse.data.items;
                if (!videoItems || videoItems.length === 0) continue;

                const liveBroadcastContent = videoItems[0].snippet.liveBroadcastContent;

                if (liveBroadcastContent === 'live') {
                    console.log(`🚨 [Live Terdeteksi] ${channelName} sedang LIVE!`);
                    notifiedVideosCache.add(videoId);

                    for (const guildId in globalDbCache.serverSettings) {
                        const logChannelId = globalDbCache.serverSettings[guildId].ytLogChannel;
                        if (logChannelId) {
                            const channel = discordClient.channels.cache.get(logChannelId) || await discordClient.channels.fetch(logChannelId).catch(() => null);
                            if (channel) {
                                channel.send(`@everyone 🚨 **Ada yang lagi live nihh, jangan lupa mampir yaa...**\n🎥 **${title}**\n🔗 https://www.youtube.com/watch?v=${videoId}`);
                            }
                        }
                    }
                }
            } catch (err) { console.error(`[YouTube Error] Gagal memproses channel ID ${channelId}:`, err.message); }
        }
    } catch (err) { console.error('[YouTube Error] Gagal menjalankan rutinitas pengecekan live stream:', err.message); }
}

async function updateBotStatus() {
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return;
        const members = await guild.members.fetch({ withPresences: true });
        const onlineCount = members.filter(m => !m.user.bot && m.presence && ['online', 'idle', 'dnd'].includes(m.presence.status)).size;
        const totalHumans = members.filter(m => !m.user.bot).size;
        
        client.user.setActivity(`🍀 𝙊𝙣𝙡𝙞𝙣𝙚: ${onlineCount} | 🍁 𝙊𝙛𝙛𝙡𝙞𝙣𝙚: ${totalHumans - onlineCount}`, { type: ActivityType.Custom });
    } catch (e) {}
}

async function sendUpdateLog(guild, content) {
    const logChannelId = globalDbCache.serverSettings?.[guild.id]?.logChannelId;
    if (!logChannelId) return;
    const channel = guild.channels.cache.get(logChannelId) || await guild.channels.fetch(logChannelId).catch(() => null);
    if (channel) channel.send({ embeds: [new EmbedBuilder().setColor(0x00FF00).setTitle('🚀 Update Fitur Bot').setDescription(content).setTimestamp()] });
}

client.once('ready', async () => {
    try {
        console.log(`${client.user.tag} sudah siap beraksi!`);
        globalDbCache = await fetchData();
        console.log("📦 Seluruh data dari JSONBin sukses dimuat ke RAM Bot.");

        if (globalDbCache.serverSettings) {
            for (const guildId in globalDbCache.serverSettings) {
                if (globalDbCache.serverSettings[guildId].securityDisabled === true) securityDisabledGuilds.add(guildId);
            }
        }

        initVoiceMaster(client, globalDbCache);
        await checkYouTubeLiveStreams(client);
        
        setInterval(async () => await checkYouTubeLiveStreams(client), 300000);
        await updateBotStatus();
        setInterval(updateBotStatus, 5 * 60 * 1000); 

        setInterval(async () => {
            await saveData(globalDbCache);
        }, 3600000);
    } catch (err) {
        console.error("Bot gagal inisialisasi karena database error. Proses dihentikan.");
        process.exit(1);
    }
});

cron.schedule('0 0 * * *', async () => {
    console.log("🔄 Jam 00:00: Mengeksekusi rutinitas harian di semua server...");
    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }).replace(/\//g, '-'); 
    const waktuSekarang = Date.now();

    for (const [guildId, guild] of client.guilds.cache) {
        try {
            if (globalDbCache.vipUsers) {
                const savedVipRoleId = globalDbCache.donationConfig?.vipRoleId;
                for (const userId in globalDbCache.vipUsers) {
                    const userVipData = globalDbCache.vipUsers[userId];
                    if (userVipData.expireAt < waktuSekarang) {
                        const expiredMember = await guild.members.fetch(userId).catch(() => null);
                        if (expiredMember && savedVipRoleId && expiredMember.roles.cache.has(savedVipRoleId)) {
                            await expiredMember.roles.remove(savedVipRoleId).catch(console.error);
                            console.log(`🗑️ [VIP Expired] Role VIP dicopot otomatis dari ${userVipData.username}`);
                        }
                        delete globalDbCache.vipUsers[userId];
                    }
                }
            }

            if (globalDbCache.hbd) {
                for (const userId in globalDbCache.hbd) {
                    if (globalDbCache.hbd[userId] === today) {
                        const member = await guild.members.fetch(userId).catch(() => null);
                        if (member) {
                            const hbdRoleId = globalDbCache.serverSettings?.[guildId]?.hbdRoleId; 
                            if (hbdRoleId) await member.roles.add(hbdRoleId).catch(console.error);
                            
                            const targetChannelId = globalDbCache.serverSettings?.[guildId]?.hbdChannelId;
                            const channel = targetChannelId 
                                ? (guild.channels.cache.get(targetChannelId) || await guild.channels.fetch(targetChannelId).catch(() => null)) 
                                : (guild.systemChannel || guild.channels.cache.find(c => c.type === ChannelType.GuildText));
                            
                            if (channel) channel.send(`🎉 Selamat ulang tahun <@${userId}>! Semoga harimu menyenangkan! 🎂`);
                        }
                    }
                }
            }
        } catch (serverErr) { console.error(`Gagal rutinitas harian ${guild.name}:`, serverErr.message); }
    }
});

if (!global.userWarnsCache) global.userWarnsCache = new Map();

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const guildId = message.guild.id;

    await handleAntiPhising(message);
    await handleAntiSpam(message, messageCounts, securityDisabledGuilds);

    // 👇 SISTEM AI GEMINI TERBARU: Akan menyala kalau bot di-mention
    if (message.mentions.has(client.user.id) && !message.content.startsWith('!')) {
        await handleAIChat(message);
        return; 
    }

    const isCommand = message.content.startsWith('!');
    if (!isCommand) {
        if (!globalDbCache.messages) globalDbCache.messages = {};
        globalDbCache.messages[message.author.id] = (globalDbCache.messages[message.author.id] || 0) + 1;
        if (!globalDbCache.xp) globalDbCache.xp = {};
        if (!globalDbCache.xp[message.author.id]) globalDbCache.xp[message.author.id] = { xp: 0, level: 1 };
        
        globalDbCache.xp[message.author.id].xp += Math.floor(Math.random() * 6) + 5;
        let neededXP = globalDbCache.xp[message.author.id].level * 100;
        if (globalDbCache.xp[message.author.id].xp >= neededXP) {
            globalDbCache.xp[message.author.id].level += 1;
            globalDbCache.xp[message.author.id].xp = 0;
            message.channel.send(`🎉 Selamat ${message.author}, kamu naik ke **Level ${globalDbCache.xp[message.author.id].level}**! ✨`);
        }
        return; 
    }

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const cooldownTime = { 'gamble': 5000, 'gacha': 3000, 'gachaluck': 3000, 'gachasuperluck': 3000, 'gachamegaluck': 3000, 'sellcard': 4000, 'bit': 5000 };
    
    if (cooldownTime[command]) {
        const key = `${message.author.id}-${command}`;
        const now = Date.now();
        if (global.commandCooldowns.has(key)) {
            const expTime = global.commandCooldowns.get(key) + cooldownTime[command];
            if (now < expTime) {
                return message.reply(`⏳ Woy sabar! Tunggu **${((expTime - now) / 1000).toFixed(1)} detik** lagi buat pakai \`!${command}\` biar gak spam.`);
            }
        }
        global.commandCooldowns.set(key, now);
        setTimeout(() => global.commandCooldowns.delete(key), cooldownTime[command]);
    }

    try {
        const isGameHandled = await handleGameCommands(message, command, args, globalDbCache);
        if (isGameHandled) return; 
    } catch (err) {
        console.error("GameHandler Error:", err);
        return message.reply("✖️ Terjadi kesalahan saat memproses command permainan.");
    }

    if (command === 'help') {
        const helpEmbed = new EmbedBuilder().setColor(0x00FF00).setTitle('📚 Pusat Bantuan Mocals Chan').setDescription('Halo! Ini adalah daftar perintah lengkap yang bisa kamu gunakan di server:')
            .addFields(
                { name: 'ℹ️ Hiburan & Informasi', value: '`!ping`, `!halo`, `!gabutnih`, `!rank`, `!8ball`, `!coinflip`, `!remind`, `!userinfo`, `!serverinfo`, `!status`, `!info`', inline: false },
                { name: '💰 Ekonomi & Toko Pasar', value: '`!money`, `!work`, `!gamble`, `!leaderboard`, `!givecash`', inline: false },
                { name: '⚔️ Duel Formasi Deck & Taruhan', value: '`!setdeck [ID_MAL]` (Pasang/copot kartu), `!deck` (Cek deck), `!duel @user` (Latihan), `!bit @user [jumlah]` (Taruhan koin), `!confirm`, `!reject`', inline: false },
                { name: '🎂 Ulang Tahun', value: '`!sethbd DD-MM`', inline: false },
                { name: '🔮 Gacha Multi-Luck & Album Kartu', value: '`!gacha`, `!gachaluck`, `!gachasuperluck`, `!gachamegaluck`, `!gachainfo`, `!collection`, `!charinfo`, `!topcollector`', inline: false },
                { name: '🛒 Bursa Pasar & Black Market', value: '`!sellcard [ID] [Harga]` - Jual kartu.\n`!marketlist` - Etalase toko.\n`!buycard [Kode]`, `!buybm [Kode]`', inline: false },
                { name: '📺 Pemantau YouTube Live', value: '`!addchannel`, `!removechannel`, `!listchannels`', inline: false },
                { name: '💳 Sistem Donasi VIP', value: '`!donate` - Info donasi Saweria.\n`!checkvip` - Cek status masa aktif VIP milikmu.', inline: false },
                { name: '🎨 Kustomisasi Welcome/Leave', value: '`!setwelcomebg [URL]`, `!setleavebg [URL]` (Admin Only)', inline: false }
            );

        if (message.member.permissions.has('Administrator')) {
            helpEmbed.addFields({
                name: '🛠️ Perintah Khusus Administrator (Rahasia)',
                value: '`!bmchannelset`, `!testbm`, `!setchannelnotif`, `!testyt`, `!setwelcome`, `!setleave`, `!testwelcome`, `!testleave`, `!setupupdate`, `!postupdate`, `!mocalschanbc`, `!enablesecurity`, `!disablesecurity`, `!sethbdrole @role`, `!sethbdchannel #channel`, `!donationlogset #channel`, `!viproleset @role`, `!addvip @user [hari]`',
                inline: false
            });
            helpEmbed.setColor('#ff0000'); 
        }
        return message.reply({ embeds: [helpEmbed] });
    }

    if (command === 'status') {
        const statusEmbed = new EmbedBuilder().setColor(0x00FF00).setTitle('🤖 Status Mocals Chan')
            .addFields({ name: '🌐 Latency', value: `${client.ws.ping}ms`, inline: true }, { name: '⏳ Uptime', value: `${(process.uptime() / 60).toFixed(0)} menit`, inline: true }, { name: '👥 Total Member', value: `${message.guild.memberCount}`, inline: true }, { name: '💻 Versi Node', value: process.version, inline: true }).setTimestamp();
        return message.reply({ embeds: [statusEmbed] });
    }

    if (command === 'info') {
        const infoEmbed = new EmbedBuilder().setColor(0x00FF00).setTitle('🌸 Tentang Mocals Chan').setDescription('Hai! Aku Mocals Chan, asisten ceria yang siap menemanimu di server ini.')
            .addFields({ name: '🛠️ Kemampuan', value: 'Membantu urusan ekonomi, hiburan, hingga pengingat waktu.', inline: false }, { name: '✨ Dibuat dengan', value: 'Node.js & Discord.js', inline: true }).setThumbnail(client.user.displayAvatarURL());
        return message.reply({ embeds: [infoEmbed] });
    }

    if (command === 'gachainfo') {
        const infoEmbed = new EmbedBuilder().setColor(0xFF69B4).setTitle('🔮 Panduan Gacha Multi-Luck & Bursa Pasar').setDescription('Hai! Ini adalah tarif harga serta jaminan kasta gacha keberuntungan Mocals Chan:')
            .addFields(
                { name: '🎲 Pilihan Kategori Gacha', value: `🔴 \`!gacha\` - **$500** | Bebas (\`C\`, \`R\`, \`SR\`, \`SSR\`)\n🟢 \`!gachaluck\` - **$3.500** | Min. Rare (**\`R\`**)\n🔵 \`!gachasuperluck\` - **$15.000** | Min. Super Rare (**\`SR\`**)\n🔥 \`!gachamegaluck\` - **$75.000** | **Wajib \`SSR\`!**`, inline: false },
                { name: '🗂️ Manajemen Deck', value: '`!collection`, `!setdeck [ID]`, `!deck`, `!topcollector`', inline: false },
                { name: '🛒 Bursa Pasar', value: '`!sellcard [ID] [Harga]`, `!marketlist`, `!buycard`, `!buybm`', inline: false }
            );
        return message.reply({ embeds: [infoEmbed] });
    }

    if (command === 'bmchannelset') {
        if (!message.member.permissions.has('Administrator')) return message.reply('✖️ Khusus Administrator.');
        const ch = message.mentions.channels.first();
        if (!ch) return message.reply('✖️ Format: `!bmchannelset #channel`');
        if (!globalDbCache.serverSettings) globalDbCache.serverSettings = {};
        if (!globalDbCache.serverSettings[guildId]) globalDbCache.serverSettings[guildId] = {};
        globalDbCache.serverSettings[guildId].bmChannelId = ch.id;
        return message.reply(`✅ Lapak Black Market diatur ke ${ch}.`);
    }

    if (command === 'sethbdrole') {
        if (!message.member.permissions.has('Administrator')) return message.reply('✖️ Khusus Administrator.');
        const role = message.mentions.roles.first();
        if (!role) return message.reply('✖️ Format: `!sethbdrole @Role`');
        if (!globalDbCache.serverSettings) globalDbCache.serverSettings = {};
        if (!globalDbCache.serverSettings[guildId]) globalDbCache.serverSettings[guildId] = {};
        globalDbCache.serverSettings[guildId].hbdRoleId = role.id;
        return message.reply(`✅ Role HBD diatur ke **${role.name}**.`);
    } 

    if (command === 'sethbdchannel') {
        if (!message.member.permissions.has('Administrator')) return message.reply('✖️ Khusus Administrator.');
        const ch = message.mentions.channels.first();
        if (!ch) return message.reply('✖️ Format: `!sethbdchannel #channel`');
        if (!globalDbCache.serverSettings) globalDbCache.serverSettings = {};
        if (!globalDbCache.serverSettings[guildId]) globalDbCache.serverSettings[guildId] = {};
        globalDbCache.serverSettings[guildId].hbdChannelId = ch.id;
        saveData(globalDbCache); 
        return message.reply(`✅ Channel ultah diatur ke ${ch}.`);
    }

    if (command === 'enablesecurity') {
        if (!message.member.permissions.has('Administrator')) return message.reply('✖️ Khusus Administrator.');
        if (!globalDbCache.serverSettings) globalDbCache.serverSettings = {};
        if (!globalDbCache.serverSettings[guildId]) globalDbCache.serverSettings[guildId] = {};
        globalDbCache.serverSettings[guildId].securityDisabled = false;
        securityDisabledGuilds.delete(guildId); 
        return message.reply('✅ **Sistem Keamanan Aktif!** Fitur Anti-Spam sekarang berjalan penuh.');
    }

    if (command === 'disablesecurity') {
        if (!message.member.permissions.has('Administrator')) return message.reply('✖️ Khusus Administrator.');
        if (!globalDbCache.serverSettings) globalDbCache.serverSettings = {};
        if (!globalDbCache.serverSettings[guildId]) globalDbCache.serverSettings[guildId] = {};
        globalDbCache.serverSettings[guildId].securityDisabled = true;
        securityDisabledGuilds.add(guildId); 
        return message.reply('⚠️ **Sistem Keamanan Dimatikan!** Fitur Anti-Spam telah dinonaktifkan (Anti-Scam tetap nyala).');
    }

    if (command === 'setchannelnotif') {
        if (!message.member.permissions.has('Administrator')) return message.reply('✖️ Khusus Administrator.');
        const ch = message.mentions.channels.first();
        if (!ch) return message.reply('Tag channel-nya!');
        if (!globalDbCache.serverSettings) globalDbCache.serverSettings = {};
        if (!globalDbCache.serverSettings[guildId]) globalDbCache.serverSettings[guildId] = {};
        globalDbCache.serverSettings[guildId].ytLogChannel = ch.id;
        return message.reply(`✅ Channel notif live diatur ke ${ch}`);
    }

    if (command === 'addchannel') {
        const id = args[0];
        if (!id) return message.reply('Masukkan ID channel YT!');
        if (!globalDbCache.ytChannels) globalDbCache.ytChannels = [];
        if (globalDbCache.ytChannels.includes(id)) return message.reply('Channel sudah ada!');
        globalDbCache.ytChannels.push(id);
        return message.reply(`✅ Channel ${id} ditambahkan!`);
    }

    if (command === 'listchannels') {
        const channels = globalDbCache.ytChannels || [];
        if (channels.length === 0) return message.reply('Belum ada channel YT.');
        return message.reply(`📺 **Daftar Channel Dipantau (${channels.length})**`);
    }

    if (command === 'testyt') {
        if (!message.member.permissions.has('Administrator')) return message.reply('✖️ Khusus Administrator.');
        message.reply('🔄 Memulai simulasi pengecekan YouTube...');
        await checkYouTubeLiveStreams(client);
        return message.channel.send('✅ Pengecekan manual selesai.');
    }

    if (command === 'removechannel') {
        const id = args[0];
        if (!globalDbCache.ytChannels) return message.reply('List kosong!');
        globalDbCache.ytChannels = globalDbCache.ytChannels.filter(c => c !== id);
        return message.reply(`✅ Channel dihapus.`);
    }

    if (command === 'setwelcome' || command === 'setleave') {
        if (!message.member.permissions.has('Administrator')) return message.reply('✖️ Admin Only.');
        const ch = message.mentions.channels.first();
        if (!ch) return message.reply('Tag channel-nya!');
        if (!globalDbCache.serverSettings) globalDbCache.serverSettings = {};
        if (!globalDbCache.serverSettings[guildId]) globalDbCache.serverSettings[guildId] = {};
        if (command === 'setwelcome') globalDbCache.serverSettings[guildId].welcomeId = ch.id;
        else globalDbCache.serverSettings[guildId].leaveId = ch.id;
        return message.reply(`✅ Channel berhasil diatur ke ${ch}`);
    }

    if (command === 'setwelcomebg' || command === 'setleavebg') {
        if (!message.member.permissions.has('Administrator')) return message.reply('✖️ Admin Only.');
        const url = args[0];
        if (!url || !url.startsWith('http')) return message.reply('✖️ Format salah! Masukkan URL gambar.');
        if (!globalDbCache.serverSettings) globalDbCache.serverSettings = {};
        if (!globalDbCache.serverSettings[guildId]) globalDbCache.serverSettings[guildId] = {};
        if (command === 'setwelcomebg') globalDbCache.serverSettings[guildId].welcomeBgUrl = url;
        else globalDbCache.serverSettings[guildId].leaveBgUrl = url;
        return message.reply(`✅ Background berhasil diatur!`);
    }
    
    if (command === 'testwelcome' || command === 'testleave') {
        if (!message.member.permissions.has('Administrator')) return message.reply('✖️ Admin Only.');
        client.emit(command === 'testwelcome' ? 'guildMemberAdd' : 'guildMemberRemove', message.member);
        return message.reply('✅ Simulasi dijalankan.');
    }

    if (command === 'setupupdate') {
        if (!message.member.permissions.has('Administrator')) return message.reply('✖️ Admin Only.');
        const ch = message.mentions.channels.first();
        if (!ch) return message.reply('Tag channel!');
        if (!globalDbCache.serverSettings) globalDbCache.serverSettings = {};
        if (!globalDbCache.serverSettings[guildId]) globalDbCache.serverSettings[guildId] = {};
        globalDbCache.serverSettings[guildId].logChannelId = ch.id;
        return message.reply(`✅ Log update diatur ke ${ch}`);
    }
    
    if (command === 'postupdate') {
        if (!message.member.permissions.has('Administrator')) return;
        sendUpdateLog(message.guild, args.join(' '));
        return message.reply('✅ Terkirim!');
    }

    if (command === 'mocalschanbc') {
        if (!message.member.permissions.has('Administrator')) return message.reply('✖️ Admin Only.');
        const targetChannel = message.mentions.channels.first();
        const broadcastMsg = message.content.slice(14).replace(/<#[0-9]+>/, '').trim();
        if (!targetChannel || !broadcastMsg) return message.reply('Format salah!');

        let successCount = 0;
        client.guilds.cache.forEach(guild => {
            const channel = guild.channels.cache.get(targetChannel.id);
            if (channel) { channel.send(`📢 **Broadcast**: ${broadcastMsg}`).catch(console.error); successCount++; }
        });
        return message.reply(`✅ Broadcast ke ${successCount} server!`);      
    }

    if (command === 'ping') return message.reply('Pong! 🏓');
    if (command === 'halo') return message.reply(`Halo ${message.author}! Mocals Bot siap membantu. ✨`);
    if (command === 'gabutnih') return message.reply('SAMA, AKU JUGA GABUT😠😠😠😠');
    
    if (command === 'rank') {
        const userXP = globalDbCache.xp?.[message.author.id] || { xp: 0, level: 1 };
        return message.reply(`📊 **Status Mocals Bot**\nLevel: **${userXP.level}**\nXP: **${userXP.xp}**`);
    }

    if (command === '8ball') {
        const ans = ['Ya, tentu saja! ✨', 'Sepertinya tidak...', 'Moking nanti.', 'Jangan harap.', 'Tentu saja! 🍀', 'Tidak mungkin.'];
        return message.reply(`🎱 **Jawaban**: ${ans[Math.floor(Math.random() * ans.length)]}`);
    }

    if (command === 'coinflip') {
        return message.reply(`🪙 Hasil coin flip: **${Math.random() < 0.5 ? 'Kepala (Heads)' : 'Ekor (Tails)'}**`);
    }
    
    if (command === 'remind') {
        const waktu = parseInt(args[0]);
        const pesan = args.slice(1).join(' ');
        if (!waktu || !pesan) return message.reply('Contoh: !remind 60 belajar');
        message.reply(`✅ Diingatkan dalam ${waktu} detik.`);
        return setTimeout(() => message.channel.send(`⏰ ${message.author}, pengingat: **${pesan}**`), waktu * 1000);
    }

    if (command === 'userinfo') {
        const member = message.mentions.members.first() || message.member;
        const roles = member.roles.cache.filter(r => r.id !== message.guild.id).map(r => `<@&${r.id}>`).join(', ') || 'Tidak ada';
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x00FF00).setTitle(`👤 User: ${member.user.username}`).setThumbnail(member.user.displayAvatarURL()).addFields({ name: 'ID', value: `\`${member.id}\``, inline: true }, { name: 'Total Pesan', value: `\`${globalDbCache.messages?.[member.id] || 0}\``, inline: true }, { name: 'Roles', value: roles })] });
    }

    if (command === 'serverinfo') {
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x0099FF).setTitle(`🏠 Server: ${message.guild.name}`).addFields({ name: 'Total Member', value: `\`${message.guild.memberCount}\``, inline: true })] });
    }

    if (command === 'teshbd') {
        if (!message.member.permissions.has('Administrator')) return;
        const hbdRoleId = globalDbCache.serverSettings?.[guildId]?.hbdRoleId;
        if (!hbdRoleId) return message.reply('❌ Role HBD belum diset!');
        
        if (!message.member.roles.cache.has(hbdRoleId)) message.member.roles.add(hbdRoleId).catch(console.error);
        message.channel.send(`🎉 (TEST) Selamat ulang tahun ${message.author}!`);
        return setTimeout(() => { message.member.roles.remove(hbdRoleId).catch(console.error); }, 5000);
    }

    if (command === 'sethbd') {
        const tgl = args[0];
        if (!tgl || !/^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])$/.test(tgl)) return message.reply('❌ Format: \`!sethbd DD-MM\` (Contoh: \`!sethbd 10-05\`)');
        if (!globalDbCache.hbd) globalDbCache.hbd = {};
        globalDbCache.hbd[message.author.id] = tgl;
        return message.reply('✅ Tanggal ultah disimpan!');
    }

    await handleVoiceMasterCommands(message, command, args, globalDbCache);
    await handleDonationCommands(message, command, args, globalDbCache);

    const triggerSaveCommands = ['createjoin', 'addvip', 'donationlogset', 'viproleset', 'setwelcomebg', 'setleavebg', 'setwelcome', 'setleave', 'bmchannelset', 'setchannelnotif', 'setupupdate', 'sethbdrole', 'sethbdchannel'];
    if (triggerSaveCommands.includes(command)) {
        try { await saveData(globalDbCache); console.log(`💾 [Auto-Save] Data (${command}) dicadangkan.`); } catch (err) {}
    }
});

client.on('guildMemberAdd', async (member) => { 
    const s = globalDbCache.serverSettings?.[member.guild.id];
    if (s?.welcomeId) {
        const ch = member.guild.channels.cache.get(s.welcomeId) || await member.guild.channels.fetch(s.welcomeId).catch(() => null);
        if (ch) {
            try {
                const attachment = await createCustomImage('welcome', member, s.welcomeBgUrl);
                ch.send({ content: `Welcome imoet ${member}! ✨`, files: [{ attachment, name: 'welcome.png' }] }).catch(console.error);
            } catch (err) { ch.send(`Welcome imoet ${member}! ✨`); }
        }
    }
});

client.on('guildMemberRemove', async (member) => { 
    const s = globalDbCache.serverSettings?.[member.guild.id];
    if (s?.leaveId) {
        const ch = member.guild.channels.cache.get(s.leaveId) || await member.guild.channels.fetch(s.leaveId).catch(() => null);
        if (ch) {
            try {
                const attachment = await createCustomImage('goodbye', member, s.leaveBgUrl);
                ch.send({ content: `Dadah ${member.user.tag}, sampai jumpa lagi! 😢`, files: [{ attachment, name: 'goodbye.png' }] }).catch(console.error);
            } catch (err) { ch.send(`Dadah ${member.user.tag}, sampai jumpa lagi! 😢`); }
        }
    }
});

const app = express();
app.use(express.json()); 

app.post('/saweria-webhook', async (req, res) => {
    if (req.body && req.body.amount_raw) await handleSaweriaWebhook(client, req.body, globalDbCache, saveData);
    return res.status(200).send({ status: 'Success received' });
});

const PORT_WEB = process.env.PORT || 3000;
app.listen(PORT_WEB, '0.0.0.0', () => console.log(`🚀 [Web Server Webhook] Aktif di port :${PORT_WEB}`));

// ─── SISTEM ANTI-CRASH ───
process.on('unhandledRejection', (reason) => console.error('🚨 [ANTI-CRASH] Unhandled Rejection:', reason));
process.on('uncaughtException', (err) => console.error('🚨 [ANTI-CRASH] Uncaught Exception:', err));
process.on('uncaughtExceptionMonitor', (err) => console.error('🚨 [ANTI-CRASH] Uncaught Exception Monitor:', err));

client.login(process.env.DISCORD_TOKEN);
