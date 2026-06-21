// youtubeManager.js
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const { YOUTUBE_API_KEY } = process.env;

if (!YOUTUBE_API_KEY) {
    console.error('⚠️ [YouTube] YOUTUBE_API_KEY belum diisi di file .env!');
}

const dbPath = path.join(__dirname, 'channels.json');
const notifiedVideosCache = new Set();

const youtube = google.youtube({
    version: 'v3',
    auth: YOUTUBE_API_KEY
});

// --- FUNGSI DATABASE LOKAL ---
function loadChannels() {
    try {
        if (!fs.existsSync(dbPath)) {
            const defaultChannels = [
                'UCNG8hTCy0cLCeL2QEV0Fz-g', // Nutssyolo
                'UCrJ1Se4ZIKTJWq09S8pRvjw', // Tegar
                'UCRyHYMNtiw8TmN-HnVvbiog'  // Dymax
            ];
            fs.writeFileSync(dbPath, JSON.stringify(defaultChannels, null, 4), 'utf8');
            return defaultChannels;
        }
        return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (err) {
        console.error('[YouTube DB] Gagal membaca channels.json:', err.message);
        return [];
    }
}

function saveChannels(channels) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(channels, null, 4), 'utf8');
    } catch (err) {
        console.error('[YouTube DB] Gagal menulis ke channels.json:', err.message);
    }
}

function convertChannelIdToUploadsPlaylistId(channelId) {
    if (channelId.startsWith('UC')) {
        return 'UU' + channelId.substring(2);
    }
    return channelId;
}

// --- FUNGSI UTAMA PENGECEKAN LIVE ---
async function checkYouTubeLiveStreams(discordClient) {
    console.log(`[${new Date().toLocaleString()}] Memulai pengecekan live stream YouTube...`);

    try {
        let channel;
        // Cari channel discord bernama promotion / 📢promotion📢
        for (const guild of discordClient.guilds.cache.values()) {
            const found = guild.channels.cache.find(ch =>
                (ch.name === '📢promotion📢' || ch.name === 'promotion') && ch.isTextBased()
            );
            if (found) {
                channel = found;
                break;
            }
        }

        if (!channel) {
            console.log(`[YouTube] Channel Discord "promotion" tidak ditemukan, abaikan pengecekan.`);
            return;
        }

        const channels = loadChannels();
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

                const videoResponse = await youtube.videos.list({
                    id: videoId,
                    part: 'snippet'
                });

                const videoItems = videoResponse.data.items;
                if (!videoItems || videoItems.length === 0) continue;

                const liveBroadcastContent = videoItems[0].snippet.liveBroadcastContent;

                if (liveBroadcastContent === 'live') {
                    if (!notifiedVideosCache.has(videoId)) {
                        const message = `@everyone 🔴 **${channelName}** sedang LIVE!\nTonton di sini: https://www.youtube.com/watch?v=${videoId}`;
                        await channel.send(message);
                        console.log(`[YouTube] Mengirim notifikasi live untuk ${channelName}`);
                        notifiedVideosCache.add(videoId);
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

// --- EXPORT FUNGSI AGAR BISA DIPAKAI DI INDEX.JS ---
module.exports = {
    // Fungsi untuk memulai loop pengecekan (dipanggil saat bot Ready)
    startPolling: (client) => {
        if (!YOUTUBE_API_KEY) return;
        
        checkYouTubeLiveStreams(client); // Cek pertama kali
        
        const intervalMs = parseInt(process.env.POLL_INTERVAL_MS, 10) || 300000; // Default 5 menit
        setInterval(() => {
            checkYouTubeLiveStreams(client);
        }, intervalMs);
        
        console.log(`[System] Polling YouTube diaktifkan setiap ${intervalMs / 1000 / 60} menit.`);
    },

    // Fungsi untuk menangani command !addchannel, !removechannel, !listchannels
    handleCommands: async (message) => {
        const isYoutubeCommand = message.content.startsWith('!addchannel') ||
                                 message.content.startsWith('!removechannel') ||
                                 message.content === '!listchannels';

        if (!isYoutubeCommand) return false; // Abaikan jika bukan command YouTube

        const channelName = message.channel.name;
        if (channelName !== '🤖set-bot🤖' && channelName !== 'set-bot') {
            message.reply('Maaf, perintah ini hanya dapat dijalankan di channel bernama `🤖set-bot🤖`.');
            return true; 
        }

        if (message.content.startsWith('!addchannel ')) {
            const channelId = message.content.split(' ')[1]?.trim();
            if (!channelId || !channelId.startsWith('UC') || channelId.length !== 24) {
                message.reply('Gagal! Format salah. Gunakan: `!addchannel <YouTube_Channel_ID>` (Diawali UC, 24 Karakter)');
                return true;
            }
            const channels = loadChannels();
            if (channels.includes(channelId)) {
                message.reply(`Channel \`${channelId}\` sudah ada di dalam daftar.`);
                return true;
            }
            channels.push(channelId);
            saveChannels(channels);
            message.reply(`Berhasil menambahkan channel \`${channelId}\`!`);
            return true;
        }

        if (message.content.startsWith('!removechannel ')) {
            const channelId = message.content.split(' ')[1]?.trim();
            const channels = loadChannels();
            const index = channels.indexOf(channelId);
            if (index === -1) {
                message.reply(`Channel \`${channelId}\` tidak ditemukan.`);
                return true;
            }
            channels.splice(index, 1);
            saveChannels(channels);
            message.reply(`Berhasil menghapus channel \`${channelId}\`.`);
            return true;
        }

        if (message.content === '!listchannels') {
            const channels = loadChannels();
            if (channels.length === 0) {
                message.reply('Belum ada channel YouTube yang dipantau.');
                return true;
            }
            let replyMsg = '**Daftar Channel YouTube yang Dipantau:**\n';
            channels.forEach((id, i) => {
                replyMsg += `${i + 1}. \`${id}\` (Link: <https://www.youtube.com/channel/${id}>)\n`;
            });
            message.reply(replyMsg);
            return true;
        }

        return true;
    }
};
