// youtubeManager.js
const { google } = require('googleapis');

const { YOUTUBE_API_KEY } = process.env;

if (!YOUTUBE_API_KEY) {
    console.error('⚠️ [YouTube] YOUTUBE_API_KEY belum diisi di file .env!');
}

const notifiedVideosCache = new Set();
const youtube = google.youtube({
    version: 'v3',
    auth: YOUTUBE_API_KEY
});

function convertChannelIdToUploadsPlaylistId(channelId) {
    if (channelId.startsWith('UC')) return 'UU' + channelId.substring(2);
    return channelId;
}

// ─── FUNGSI PENGECEKAN LIVE (Sudah Sinkron dgn !setchannelnotif) ───
async function checkYouTubeLiveStreams(discordClient, globalDbCache) {
    // console.log(`[${new Date().toLocaleString()}] Memulai pengecekan live stream YouTube...`);

    try {
        const channels = globalDbCache.ytChannels || [];
        if (channels.length === 0) return;

        for (const channelId of channels) {
            try {
                const playlistId = convertChannelIdToUploadsPlaylistId(channelId);
                const playlistResponse = await youtube.playlistItems.list({
                    playlistId: playlistId,
                    part: 'snippet',
                    maxResults: 1
                });

                const items = playlistResponse.data.items;
                if (!items || items.length === 0) continue;

                const latestPlaylistItem = items[0];
                const videoId = latestPlaylistItem.snippet.resourceId.videoId;
                const channelName = latestPlaylistItem.snippet.channelTitle;
                const title = latestPlaylistItem.snippet.title;

                const videoResponse = await youtube.videos.list({
                    id: videoId,
                    part: 'snippet'
                });

                const videoItems = videoResponse.data.items;
                if (!videoItems || videoItems.length === 0) continue;

                if (videoItems[0].snippet.liveBroadcastContent === 'live') {
                    if (!notifiedVideosCache.has(videoId)) {
                        console.log(`🚨 [Live Terdeteksi] ${channelName} sedang LIVE!`);
                        notifiedVideosCache.add(videoId);

                        // 👇 INI FITUR SINKRONISASINYA: Kirim ke channel yang di-set via !setchannelnotif
                        if (globalDbCache.serverSettings) {
                            for (const guildId in globalDbCache.serverSettings) {
                                // Mengambil data ytLogChannel dari database (hasil dari command !setchannelnotif)
                                const logChannelId = globalDbCache.serverSettings[guildId].ytLogChannel;
                                
                                if (logChannelId) {
                                    const guild = discordClient.guilds.cache.get(guildId);
                                    if (guild) {
                                        const notifChannel = guild.channels.cache.get(logChannelId);
                                        if (notifChannel) {
                                            notifChannel.send(`@everyone 🚨 **Ada yang lagi live nihh, jangan lupa mampir yaa...**\n🎥 **${title || channelName}**\n🔗 https://www.youtube.com/watch?v=${videoId}`);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`[YouTube Error] Gagal memproses channel ID ${channelId}:`, err.message);
            }
        }
    } catch (err) {
        console.error('[YouTube Error] Gagal menjalankan pengecekan:', err.message);
    }
}

// ─── PENGATURAN COMMAND ───
module.exports = {
    startPolling: (client, globalDbCache) => {
        if (!YOUTUBE_API_KEY) return;
        
        checkYouTubeLiveStreams(client, globalDbCache); 
        
        const intervalMs = parseInt(process.env.POLL_INTERVAL_MS, 10) || 300000; // Cek setiap 5 menit
        setInterval(() => {
            checkYouTubeLiveStreams(client, globalDbCache);
        }, intervalMs);
    },

    handleCommands: async (message, globalDbCache, saveData) => {
        const isYoutubeCommand = message.content.startsWith('!addchannel') ||
                                 message.content.startsWith('!removechannel') ||
                                 message.content === '!listchannels';

        if (!isYoutubeCommand) return false;

        // Bikin array database kosong jika belum ada
        if (!globalDbCache.ytChannels) {
            globalDbCache.ytChannels = [];
            await saveData(globalDbCache);
        }

        const channels = globalDbCache.ytChannels;

        // 1. COMMAND: !addchannel
        if (message.content.startsWith('!addchannel ')) {
            if (!message.member.permissions.has('Administrator')) {
                message.reply('✖️ Gagal: Command ini **Hanya untuk Administrator**.');
                return true;
            }

            const channelId = message.content.split(' ')[1]?.trim();
            if (!channelId || !channelId.startsWith('UC') || channelId.length !== 24) {
                message.reply('Gagal! Format salah. Gunakan: `!addchannel <ID_Channel_YouTube>`\nContoh: `!addchannel UCNG8hTCy0cLCeL2QEV0Fz-g`');
                return true;
            }
            if (channels.includes(channelId)) {
                message.reply(`Channel \`${channelId}\` sudah ada di dalam daftar pantauan.`);
                return true;
            }
            
            channels.push(channelId);
            await saveData(globalDbCache); // Simpan ke JSONBin Cloud
            message.reply(`✅ Berhasil menambahkan ID channel \`${channelId}\` ke dalam daftar pantauan bot!`);
            return true;
        }

        // 2. COMMAND: !removechannel
        if (message.content.startsWith('!removechannel ')) {
            if (!message.member.permissions.has('Administrator')) {
                message.reply('✖️ Gagal: Command ini **Hanya untuk Administrator**.');
                return true;
            }

            const channelId = message.content.split(' ')[1]?.trim();
            const index = channels.indexOf(channelId);
            if (index === -1) {
                message.reply(`Channel \`${channelId}\` tidak ditemukan di dalam daftar.`);
                return true;
            }
            
            channels.splice(index, 1);
            await saveData(globalDbCache); // Simpan ke JSONBin Cloud
            message.reply(`✅ Berhasil menghapus ID channel \`${channelId}\` dari daftar pantauan bot.`);
            return true;
        }

        // 3. COMMAND: !listchannels
        if (message.content === '!listchannels') {
            if (channels.length === 0) {
                message.reply('Belum ada channel YouTube yang dipantau oleh bot.');
                return true;
            }
            
            // Kasih efek ngetik karena bot butuh waktu narik data dari Google
            message.channel.sendTyping();
            
            let replyMsg = '**📺 Daftar Channel YouTube yang Dipantau:**\n\n';
            
            try {
                // Menarik data nama channel sekaligus dari YouTube API (Sangat hemat kuota)
                const ytResponse = await youtube.channels.list({
                    id: channels.join(','),
                    part: 'snippet',
                    maxResults: 50
                });

                const ytItems = ytResponse.data.items || [];
                const nameMap = {};
                
                // Memasangkan ID dengan Nama Channel aslinya
                ytItems.forEach(item => {
                    nameMap[item.id] = item.snippet.title;
                });

                // Merakit pesan balasan
                channels.forEach((id, i) => {
                    const channelName = nameMap[id] || "Nama Tidak Ditemukan";
                    replyMsg += `**${i + 1}. ${channelName}**\n🆔 \`${id}\`\n🔗 <https://www.youtube.com/channel/${id}>\n\n`;
                });
                
                message.reply(replyMsg);
            } catch (error) {
                console.error("🚨 [YouTube API] Gagal mengambil nama channel:", error.message);
                
                // Fallback (Pencegahan): Kalau API Google lagi error, tetap tampilkan ID-nya
                channels.forEach((id, i) => {
                    replyMsg += `**${i + 1}. Unknown Channel**\n🆔 \`${id}\`\n🔗 <https://www.youtube.com/channel/${id}>\n\n`;
                });
                message.reply(replyMsg + "\n*(⚠️ Gagal memuat nama channel karena gangguan API)*");
            }
            return true;
        }

        return true;
    }
};
