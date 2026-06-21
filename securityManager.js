// securityManager.js
const { EmbedBuilder } = require('discord.js');

// 1. Fungsi Anti-Spam (Dipindahkan dari index.js)
async function handleAntiSpam(message, messageCounts, securityDisabledGuilds) {
    const guildId = message.guild.id;
    const userId = message.author.id;

    // Jika server mematikan keamanan atau user adalah Admin, lewati pengecekan
    if (securityDisabledGuilds.has(guildId)) return;
    if (message.member?.permissions.has('Administrator') || message.member?.permissions.has('ManageMessages')) return;

    const now = Date.now();
    const LIMIT = 3;        
    const TIME_WINDOW = 8000; 

    if (!messageCounts.has(userId)) {
        messageCounts.set(userId, []);
    }

    const timestamps = messageCounts.get(userId);
    timestamps.push(now);

    const recentMessages = timestamps.filter(ts => now - ts < TIME_WINDOW);
    messageCounts.set(userId, recentMessages);

    if (recentMessages.length > LIMIT) {
        try {
            const fetchedMessages = await message.channel.messages.fetch({ limit: 50 });
            const messagesToDelete = fetchedMessages.filter(m => m.author.id === userId);

            if (messagesToDelete.size > 0) {
                await message.channel.bulkDelete(messagesToDelete, true).catch(() => null);
            }

            const warnExpiryTime = global.userWarnsCache.get(userId);
            
            if (!warnExpiryTime || now > warnExpiryTime) {
                const limaMenit = 5 * 60 * 1000; 
                global.userWarnsCache.set(userId, now + limaMenit); 

                const warnEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('⚠️ PERINGATAN ANTI-SPAM')
                    .setDescription(`Halo <@${userId}>, kamu terdeteksi mengetik terlalu cepat! Sesi pesanmu telah dibersihkan.\n\n**Peringatan ini hanya berlaku selama 5 menit**. Jangan diulangi ya, kalau kamu tetap nekat spam dalam waktu dekat, kamu akan **ditendang (kick)** dari server! 🤫`)
                    .setTimestamp();

                message.channel.send({ content: `<@${userId}>`, embeds: [warnEmbed] });
                messageCounts.delete(userId); 

            } else {
                if (message.member && message.member.kickable) {
                    await message.member.kick('Spam berlebihan di dalam masa pengawasan 5 menit.');
                    
                    const antiSpamEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🚨 TINDAKAN AUTO-MODERASI')
                        .setDescription(`**${message.author.tag}** telah ditendang dari server karena mengabaikan peringatan bot dan tetap melakukan spamming!`)
                        .setTimestamp();
                    
                    message.channel.send({ embeds: [antiSpamEmbed] });
                }

                messageCounts.delete(userId); 
                global.userWarnsCache.delete(userId);
            }
        } catch (err) {
            console.error('Gagal memproses eksekusi sistem anti-spam:', err);
        }
    }
}

// 2. Fungsi BARU: Anti-Link Phising / Scam
async function handleAntiPhising(message) {
    if (message.member?.permissions.has('Administrator')) return; // Abaikan jika admin

    // Daftar kata kunci atau domain scam yang sering dipakai hacker
    const scamLinks = [
        'discord-nitro-free', 
        'freediscordnitro', 
        'steam-free-gift', 
        'discord.xyz',
        '@everyone free nitro'
    ];

    const content = message.content.toLowerCase();
    
    // Cek apakah pesan mengandung link berbahaya
    const isScam = scamLinks.some(link => content.includes(link));

    if (isScam) {
        try {
            await message.delete(); // Hapus pesan langsung
            
            const scamEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🛡️ ANCAMAN KEAMANAN DICEGAH')
                .setDescription(`Pesan dari <@${message.author.id}> dihapus karena terdeteksi sebagai link Phising/Scam berbahaya. Tolong jangan klik link sembarangan!`)
                .setTimestamp();
            
            message.channel.send({ embeds: [scamEmbed] });

            // Opsional: Timeout user selama 1 jam agar tidak bisa kirim link lagi
            if (message.member.moderatable) {
                await message.member.timeout(60 * 60 * 1000, 'Terdeteksi mengirim link scam/phising.');
            }
        } catch (err) {
            console.error("Gagal menghapus pesan phising:", err);
        }
    }
}

// Ekspor fungsi agar bisa dipanggil di index.js
module.exports = { handleAntiSpam, handleAntiPhising };
