// securityManager.js
const { EmbedBuilder } = require('discord.js');
const Tesseract = require('tesseract.js'); 

// ==========================================
// 1. FUNGSI ANTI-SPAM TEKS CEPAT
// ==========================================
async function handleAntiSpam(message, messageCounts, securityDisabledGuilds) {
    const guildId = message.guild.id;
    const userId = message.author.id;

    if (securityDisabledGuilds.has(guildId)) return;
    // Fitur spam ketik cepat tetap kebal untuk Admin, agar mereka bebas ngetik saat event/pengumuman
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


// ==========================================
// 2. FUNGSI EKSEKUSI HUKUMAN PHISING
// ==========================================
async function executePunishment(message, reason) {
    try {
        // 1. Hapus pesan scam-nya tanpa ampun (berlaku untuk semua, termasuk Owner)
        await message.delete().catch(() => null); 
        
        // 2. Cek apakah pelakunya Admin
        const isAdmin = message.member?.permissions.has('Administrator');
        
        // 3. Set durasi: 6 Jam untuk Admin (21600000 ms), 1 Jam untuk biasa (3600000 ms)
        const timeoutDuration = isAdmin ? (6 * 60 * 60 * 1000) : (1 * 60 * 60 * 1000); 
        
        let actionText = isAdmin 
            ? `🚨 **PERINGATAN DARURAT!** Akun Admin <@${message.author.id}> terindikasi diretas/mengirim link scam!` 
            : `Pesan dari <@${message.author.id}> dihapus otomatis oleh sistem.`;

        const scamEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🛡️ ANCAMAN KEAMANAN DICEGAH')
            .setDescription(`${actionText}\n**Catatan Log:** ${reason}`)
            .setTimestamp();
        
        await message.channel.send({ embeds: [scamEmbed] });

        // 4. Eksekusi Timeout
        if (message.member && message.member.moderatable) {
            await message.member.timeout(timeoutDuration, reason);
            if (isAdmin) {
                message.channel.send(`🔒 *Tindakan Pengamanan: Admin tersebut telah di-timeout selama 6 Jam untuk mencegah kerusakan lebih lanjut.*`);
            }
        } else if (isAdmin) {
            // Jika bot gagal timeout karena yang kena hack adalah Owner atau Role Adminnya lebih tinggi dari Bot
            message.channel.send(`⚠️ **SISTEM TERHALANG HAK AKSES:** Bot telah menghapus pesan scam-nya, tetapi **gagal** men-timeout <@${message.author.id}> karena posisinya di atas bot (Server Owner / Higher Role). Tolong admin lain segera cabut wewenangnya!`);
        }
    } catch (err) {
        console.error("Gagal mengeksekusi penghapusan phising:", err);
    }
}


// ==========================================
// 3. FUNGSI ANTI-PHISING & OCR GAMBAR
// ==========================================
async function handleAntiPhising(message) {
    // ❌ BARIS INI DIHAPUS: if (message.member?.permissions.has('Administrator')) return;
    // Sekarang Admin TIDAK KEBAL dari scan link/gambar penipuan!

    const scamKeywords = [
        'discord-nitro-free', 'freediscordnitro', 'steam-free-gift', 'discord.xyz', 
        'hesobia.com', 'hesobia', 'claim your reward', 'withdraw bonus', 
        'vyro project', 'beast games crypto'
    ];

    // --- A. CEK TEKS DI CHAT ---
    const content = message.content.toLowerCase();
    const isTextScam = scamKeywords.some(keyword => content.includes(keyword));

    if (isTextScam) {
        return executePunishment(message, 'Terdeteksi mengirim link Scam/Phising di teks.');
    }

    // --- B. CEK POLA HACKER (Cuma Ping + Gambar, tanpa ngomong apa-apa) ---
    const textWithoutPings = message.content.replace(/<@!?\d+>/g, '').trim();
    const isSusImagePing = (message.mentions.users.size > 0) && (message.attachments.size >= 1) && (textWithoutPings.length === 0);
    
    if (isSusImagePing && message.mentions.users.size >= 3) {
        return executePunishment(message, 'Terdeteksi Spam Pola Hacker (Tag Massal + Gambar).');
    }

    // --- C. CEK MASS MENTION ---
    if (message.mentions.users.size > 4) {
        return executePunishment(message, 'Terdeteksi melakukan Mass Mention (Spam Tag).');
    }

    // --- D. CEK TULISAN DI DALAM GAMBAR (OCR TESSERACT) ---
    if (message.attachments.size > 0) {
        const imageAttachments = message.attachments.filter(att => att.contentType && att.contentType.startsWith('image/'));
        
        for (const [id, attachment] of imageAttachments) {
            try {
                const { data: { text } } = await Tesseract.recognize(attachment.url, 'eng');
                const imageText = text.toLowerCase();

                const isImageScam = scamKeywords.some(keyword => imageText.includes(keyword));

                if (isImageScam) {
                    return executePunishment(message, 'Terdeteksi menyembunyikan kata kunci Scam/Phising di dalam Gambar (OCR).');
                }
            } catch (error) {
                console.error("Gagal memindai gambar dengan OCR:", error.message);
            }
        }
    }
}

module.exports = { handleAntiSpam, handleAntiPhising };
