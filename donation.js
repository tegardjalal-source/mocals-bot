const { ChannelType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

/**
 * Logika Handler Perintah Donasi dan Sistem VIP
 * @param {import('discord.js').Message} message 
 * @param {string} command 
 * @param {string[]} args 
 * @param {Object} globalDbCache 
 */
async function handleDonationCommands(message, command, args, globalDbCache) {
    // Pastikan database struktur VIP dan config sudah ada di memori RAM
    if (!globalDbCache.vipUsers) globalDbCache.vipUsers = {};
    if (!globalDbCache.donationConfig) globalDbCache.donationConfig = { logChannelId: null };

    // ─── PERINTAH PUBLIC 1: !donate ───
    if (command === 'donate') {
        const linkSaweria = "https://saweria.co/USERNAME_SAWERIA_KAMU"; // 🌟 GANTI DENGAN LINK SAWERIAMU!

        const donateEmbed = new EmbedBuilder()
            .setColor('#ff66a3')
            .setTitle('🌸 Dukung Mocals Chan Tetap Hidup! (Bayar Hostinger)')
            .setDescription(
                `Halo **${message.author.username}**!\n\n` +
                `Biar Mocals Chan bisa terus nemenin kalian mabar 24/7 tanpa pingsan, bot ini butuh biaya bulanan untuk sewa server di **Hostinger**. ` +
                `Setiap rupiah donasi dari kalian sangat berarti bagi kelangsungan hidup bot ini! 🥺\n\n` +
                `👉 **Link Saweria (QRIS, Dana, OVO, GoPay, dll):**\n` +
                `[**Klik Disini Untuk Donasi via Saweria**](${linkSaweria})\n\n` +
                `🎁 **Benefit Menjadi Donatur VIP Bot:**\n` +
                `🥇 Role Khusus Donatur Eksklusif di Server\n` +
                `💰 **Multiplier 2x Lipat** koin setiap kali mengetik \`!work\` atau \`!daily\`\n` +
                `🍀 Keberuntungan tambahan (Buff Luck) saat melakukan \`!gacha\`\n\n` +
                `📝 **Cara Klaim:**\n` +
                `Setelah transfer di Saweria, silakan kirim screenshot bukti transfernya ke **Admin/Owner Server** untuk diaktifkan status VIP-mu!`
            )
            .setFooter({ text: 'Terima kasih banyak atas dukungan kalian! ❤️' })
            .setTimestamp();

        return message.reply({ embeds: [donateEmbed] });
    }

    // ─── PERINTAH ADMIN 1: !donationlogset #channel ───
    if (command === 'donationlogset') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('✖️ Perintah rahasia! Hanya bisa digunakan oleh **Administrator**.');
        }

        // Ambil channel teks yang di-tag oleh admin
        const targetChannel = message.mentions.channels.first();
        if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
            return message.reply('✖️ Format salah! Silakan tag Text Channel tujuannya.\nContoh: `!donationlogset #💸-donation-log`');
        }

        // Simpan ID channel ke database RAM config
        globalDbCache.donationConfig.logChannelId = targetChannel.id;

        return message.reply(`✅ **Sukses!** Channel <#${targetChannel.id}> sekarang resmi menjadi tempat pengumuman donasi Mocals Chan.`);
    }

    // ─── PERINTAH ADMIN 2: !addvip @user [jumlah_hari] ───
    if (command === 'addvip') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('✖️ Perintah rahasia! Hanya bisa digunakan oleh **Administrator**.');
        }

        const targetMember = message.mentions.members.first();
        const jumlahHari = parseInt(args[1]);

        if (!targetMember || isNaN(jumlahHari) || jumlahHari <= 0) {
            return message.reply('✖️ Format salah! Gunakan perintah ini:\nContoh: `!addvip @NamaUser 30`');
        }

        const waktuSekarang = Date.now();
        const durasiMilidetik = jumlahHari * 24 * 60 * 60 * 1000;
        let waktuSelesaiBaru = waktuSekarang + durasiMilidetik;

        if (globalDbCache.vipUsers[targetMember.id] && globalDbCache.vipUsers[targetMember.id].expireAt > waktuSekarang) {
            waktuSelesaiBaru = globalDbCache.vipUsers[targetMember.id].expireAt + durasiMilidetik;
        }

        globalDbCache.vipUsers[targetMember.id] = {
            username: targetMember.user.username,
            expireAt: waktuSelesaiBaru
        };

        const tanggalSelesai = new Date(waktuSelesaiBaru).toLocaleDateString('id-ID', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        // AMBIL ID CHANNEL LOG DARI DATABASE YANG SUDAH DI-SET ADMIN
        const savedLogChannelId = globalDbCache.donationConfig.logChannelId;
        const logChannel = message.guild.channels.cache.get(savedLogChannelId);
        
        if (logChannel) {
            const announceEmbed = new EmbedBuilder()
                .setColor('#ffbb00')
                .setTitle('🎉 HERO SERVER DETECTED! NEW DONATION RECEIVED 🎉')
                .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
                .setDescription(
                    `✨ **Terima Kasih Banyak Atas Dukungannya!** ✨\n\n` +
                    `Pahlawan kita <@${targetMember.id}> baru saja melakukan donasi untuk kelangsungan server & pemeliharaan Mocals Chan di Hostinger! ❤️\n\n` +
                    `👑 **Reward Activated:**\n` +
                    `• Status: **VIP Donatur active!**\n` +
                    `• Durasi: **${jumlahHari} Hari**\n` +
                    `• Berlaku Sampai: **${tanggalSelesai}**\n\n` +
                    `*Koin harian & kerja milik <@${targetMember.id}> sekarang berlipat ganda 2x lebih banyak! Nikmati keistimewaanmu, bos! 💸*`
                )
                .setFooter({ text: 'Yuk dukung server kita tetap online dengan ketik !donate' })
                .setTimestamp();

            await logChannel.send({ content: `🔔 **Pemberitahuan Donasi:** Terima kasih <@${targetMember.id}>!`, embeds: [announceEmbed] });
        } else {
            console.log(`⚠️ [Warning Donation Log] Belum ada channel log donasi yang di-set, atau channel sudah dihapus.`);
        }

        return message.reply(`✅ **Sukses!** Status VIP <@${targetMember.id}> berhasil diaktifkan selama **${jumlahHari} hari**.`);
    }

    // ─── PERINTAH PUBLIC 2: !checkvip ───
    if (command === 'checkvip') {
        const vipData = globalDbCache.vipUsers[message.author.id];
        const waktuSekarang = Date.now();

        if (!vipData || vipData.expireAt < waktuSekarang) {
            return message.reply('❌ Kamu saat ini berstatus sebagai **Member Biasa**. Yuk dukung bot lewat perintah `!donate` untuk mendapatkan status VIP! ✨');
        }

        const sisaMilidetik = vipData.expireAt - waktuSekarang;
        const sisaHari = Math.ceil(sisaMilidetik / (1000 * 60 * 60 * 24));
        
        const tanggalSelesai = new Date(vipData.expireAt).toLocaleDateString('id-ID', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        return message.reply(`👑 **Status VIP Kamu Aktif!**\nSisa masa aktif VIP kamu adalah **${sisaHari} Hari lagi** (Berakhir pada: ${tanggalSelesai} WIB). Terima kasih sudah mendukung server ini!`);
    }
}

/**
 * Helper Fungsi: Mengecek apakah seorang user berstatus VIP Aktif
 * @param {string} userId 
 * @param {Object} globalDbCache 
 * @returns {boolean}
 */
function isUserVip(userId, globalDbCache) {
    if (!globalDbCache.vipUsers || !globalDbCache.vipUsers[userId]) return false;
    return globalDbCache.vipUsers[userId].expireAt > Date.now();
}

module.exports = { handleDonationCommands, isUserVip };
