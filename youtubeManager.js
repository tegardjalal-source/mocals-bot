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

// FUNGSI PENGECEKAN (Sekarang mengambil data dari globalDbCache)
async function checkYouTubeLiveStreams(discordClient, globalDbCache) {
    console.log(`[${new Date().toLocaleString()}] Memulai pengecekan live stream YouTube...`);

    try {
        let channel;
        for (const guild of discordClient.guilds.cache.values()) {
            const found = guild.channels.cache.find(ch =>
                (ch.name === '📢promotion📢' || ch.name === 'promotion') && ch.isTextBased()
            );
            if (found) {
                channel = found;
                break;
            }
        }

        if (!channel) return;

        // Ambil daftar channel dari database cloud
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

                const videoResponse = await youtube.videos.list({
                    id: videoId,
                    part: 'snippet'
                });

                const videoItems = videoResponse.data.items;
                if (!videoItems || videoItems.length === 0) continue;

                if (videoItems[0].snippet.liveBroadcastContent === 'live') {
                    if (!notifiedVideosCache.has(videoId)) {
                        const message = `@everyone 🔴 **${channelName}** sedang LIVE!\nTonton di sini: https://www.youtube.com/watch?v=${videoId}`;
                        await channel.send(message);
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

module.exports = {
    // startPolling sekarang menerima globalDbCache
    startPolling: (client, globalDbCache) => {
        if (!YOUTUBE_API_KEY) return;
        
        checkYouTubeLiveStreams(client, globalDbCache); 
        
        const intervalMs = parseInt(process.env.POLL_INTERVAL_MS, 10) || 300000;
        setInterval(() => {
            checkYouTubeLiveStreams(client, globalDbCache);
        }, intervalMs);
    },

    // handleCommands sekarang menerima globalDbCache dan fungsi saveData dari index.js
    handleCommands: async (message, globalDbCache, saveData) => {
        const isYoutubeCommand = message.content.startsWith('!addchannel') ||
                                 message.content.startsWith('!removechannel') ||
                                 message.content === '!listchannels';

        if (!isYoutubeCommand) return false;

        const channelName = message.channel.name;
        if (channelName !== '🤖set-bot🤖' && channelName !== 'set-bot') {
            message.reply('Maaf, perintah ini hanya dapat dijalankan di channel bernama `🤖set-bot🤖`.');
            return true; 
        }

        // Kalau di database JSONBin belum ada ytChannels, buatin array kosong default
        if (!globalDbCache.ytChannels) {
            globalDbCache.ytChannels = [
                'UCNG8hTCy0cLCeL2QEV0Fz-g', // Nutssyolo
                'UCrJ1Se4ZIKTJWq09S8pRvjw', // Tegar
                'UCRyHYMNtiw8TmN-HnVvbiog'  // Dymax
            ];
            await saveData(globalDbCache); // Simpan ke cloud
        }

        const channels = globalDbCache.ytChannels;

        if (message.content.startsWith('!addchannel ')) {
            const channelId = message.content.split(' ')[1]?.trim();
            if (!channelId || !channelId.startsWith('UC') || channelId.length !== 24) {
                message.reply('Gagal! Format salah. Gunakan: `!addchannel <YouTube_Channel_ID>`');
                return true;
            }
            if (channels.includes(channelId)) {
                message.reply(`Channel \`${channelId}\` sudah ada di dalam daftar.`);
                return true;
            }
            
            channels.push(channelId);
            await saveData(globalDbCache); // Otomatis simpan ke Cloud
            message.reply(`Berhasil menambahkan channel \`${channelId}\` dan disimpan ke Cloud!`);
            return true;
        }

        if (message.content.startsWith('!removechannel ')) {
            const channelId = message.content.split(' ')[1]?.trim();
            const index = channels.indexOf(channelId);
            if (index === -1) {
                message.reply(`Channel \`${channelId}\` tidak ditemukan.`);
                return true;
            }
            
            channels.splice(index, 1);
            await saveData(globalDbCache); // Otomatis simpan ke Cloud
            message.reply(`Berhasil menghapus channel \`${channelId}\` dari Cloud.`);
            return true;
        }

        if (message.content === '!listchannels') {
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
