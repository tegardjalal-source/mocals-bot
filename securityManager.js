// securityManager.js
const { EmbedBuilder } = require('discord.js');
const Tesseract = require('tesseract.js'); // 👈 Memanggil library pembaca gambar

// ==========================================
// 1. FUNGSI ANTI-SPAM TEKS CEPAT
// ==========================================
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
// 2. FUNGSI EKSEKUSI HUKUMAN (HELPER)
// ==========================================
async function executePunishment(message, reason) {
    try {
        await message.delete().catch(() => null); // Hapus pesan berbahaya
        
        const scamEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🛡️ ANCAMAN KEAMANAN DICEGAH')
            .setDescription(`Pesan dari <@${message.author.id}> dihapus otomatis oleh sistem.\n**Catatan Log:** ${reason}`)
            .setTimestamp();
        
        message.channel.send({ embeds: [scamEmbed] });

        // Otomatis Timeout user selama 1 jam agar tidak bisa ngirim lagi
        if (message.member && message.member.moderatable) {
            await message.member.timeout(60 * 60 * 1000, reason);
        }
    } catch (err) {
        console.error("Gagal mengeksekusi penghapusan phising:", err);
    }
}


// ==========================================
// 3. FUNGSI ANTI-PHISING & OCR GAMBAR
// ==========================================
async function handleAntiPhising(message) {
    if (message.member?.permissions.has('Administrator')) return;

    // Kata kunci penipuan yang sering dipakai hacker
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
        // Jika nge-ping 3 orang atau lebih DAN cuma ngirim gambar, langsung sikat tanpa ampun
        return executePunishment(message, 'Terdeteksi Spam Pola Hacker (Tag Massal + Gambar).');
    }

    // --- C. CEK MASS MENTION ---
    if (message.mentions.users.size > 4) {
        return executePunishment(message, 'Terdeteksi melakukan Mass Mention (Spam Tag).');
    }

    // --- D. CEK TULISAN DI DALAM GAMBAR (OCR TESSERACT) ---
    if (message.attachments.size > 0) {
        // Saring attachment agar bot cuma mengecek file berbentuk gambar
        const imageAttachments = message.attachments.filter(att => att.contentType && att.contentType.startsWith('image/'));
        
        for (const [id, attachment] of imageAttachments) {
            try {
                // Tesseract akan membaca gambar dan mengeluarkan tulisan di dalamnya
                const { data: { text } } = await Tesseract.recognize(attachment.url, 'eng');
                const imageText = text.toLowerCase();

                // Cek apakah ada kata kunci scam di dalam gambar tersebut
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

// Ekspor fungsi agar bisa dipakai di index.js
module.exports = { handleAntiSpam, handleAntiPhising };
