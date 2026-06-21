// securityManager.js
const { EmbedBuilder } = require('discord.js');

// 1. Fungsi Anti-Spam
async function handleAntiSpam(message, messageCounts, securityDisabledGuilds) {
    const guildId = message.guild.id;
    const userId = message.author.id;

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
                    .setDescription(`Halo <@${userId}>, kamu terdeteksi mengetik terlalu cepat! Sesi pesanmu telah dibersihkan.\n\n**Peringatan ini hanya berlaku selama 5 menit**. Jangan diulangi ya! 🤫`)
                    .setTimestamp();

                message.channel.send({ content: `<@${userId}>`, embeds: [warnEmbed] });
                messageCounts.delete(userId); 

            } else {
                if (message.member && message.member.kickable) {
                    await message.member.kick('Spam berlebihan di dalam masa pengawasan 5 menit.');
                    
                    const antiSpamEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🚨 TINDAKAN AUTO-MODERASI')
                        .setDescription(`**${message.author.tag}** telah ditendang dari server karena tetap melakukan spamming!`)
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

// 2. Fungsi Anti-Phising & Anti-Scam Lanjutan
async function handleAntiPhising(message) {
    if (message.member?.permissions.has('Administrator')) return; // Abaikan jika admin

    // --- A. CEK KEYWORD TEKS ---
    const scamKeywords = [
        'discord-nitro-free', 'freediscordnitro', 'steam-free-gift', 'discord.xyz', 
        'free crypto', 'crypto casino', 'hesobia.com', 'hesobia', 
        'claim your reward', 'withdraw bonus', 'vyro project', 'beast games'
    ];
    const content = message.content.toLowerCase();
    const isTextScam = scamKeywords.some(keyword => content.includes(keyword));

    // --- B. CEK POLA HACKER (Kasus Gambar Crypto) ---
    // Hacker sering mengirim: [Ping User] + [Banyak Gambar] + [Tanpa teks asli]
    // Kita hapus semua mention dari teks untuk mengecek apakah ada teks sisa
    const textWithoutPings = message.content.replace(/<@!?\d+>/g, '').trim();
    
    // Jika ada yang di-tag AND gambarnya 2 atau lebih AND gak ada tulisan lain sama sekali
    const isSusImagePing = (message.mentions.users.size > 0) && (message.attachments.size >= 2) && (textWithoutPings.length === 0);

    // --- C. CEK MASS MENTION ---
    // Memblokir jika nge-tag lebih dari 4 orang sekaligus dalam 1 chat
    const isMassMention = message.mentions.users.size > 4;

    // --- EKSEKUSI PEMBLOKIRAN ---
    if (isTextScam || isSusImagePing || isMassMention) {
        try {
            await message.delete(); // Hapus pesan langsung
            
            let reason = 'Terdeteksi mengirim link Scam/Phising berbahaya.';
            if (isSusImagePing) reason = 'Terdeteksi mengirim spam gambar berbahaya (Pola Hacker: Ping + Gambar).';
            if (isMassMention) reason = 'Terdeteksi melakukan Mass Mention (Spam Tag).';

            const scamEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🛡️ ANCAMAN KEAMANAN DICEGAH')
                .setDescription(`Pesan dari <@${message.author.id}> dihapus otomatis oleh sistem.\n**Catatan Log:** ${reason}`)
                .setTimestamp();
            
            message.channel.send({ embeds: [scamEmbed] });

            // Otomatis Timeout user selama 1 jam agar tidak bisa ngirim lagi
            if (message.member.moderatable) {
                await message.member.timeout(60 * 60 * 1000, reason);
            }
        } catch (err) {
            console.error("Gagal mengeksekusi penghapusan phising:", err);
        }
    }
}

// Ekspor fungsi
module.exports = { handleAntiSpam, handleAntiPhising };
