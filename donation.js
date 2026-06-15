const { ChannelType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

/**
 * Logika Handler Perintah Teks Donasi (Manual)
 */
async function handleDonationCommands(message, command, args, globalDbCache) {
    if (!globalDbCache.vipUsers) globalDbCache.vipUsers = {};
    if (!globalDbCache.donationConfig) globalDbCache.donationConfig = { logChannelId: null, vipRoleId: null };

    // ─── PERINTAH PUBLIC: !donate ───
    if (command === 'donate') {
        const linkSaweria = "https://saweria.co/USERNAME_SAWERIA_KAMU"; // 🌟 GANTI DENGAN LINK SAWERIAMU!

        const donateEmbed = new EmbedBuilder()
            .setColor('#ff66a3')
            .setTitle('🌸 Dukung Mocals Chan Tetap Hidup! (Bayar Hostinger)')
            .setDescription(
                `Halo **${message.author.username}**!\n\n` +
                `Biar Mocals Chan bisa terus nemenin kalian mabar 24/7, bot ini butuh biaya sewa server di **Hostinger**. 🥺\n\n` +
                `👉 **Link Saweria (QRIS, Dana, OVO, GoPay, dll):**\n` +
                `[**Klik Disini Untuk Donasi via Saweria**](${linkSaweria})\n\n` +
                `💡 **PENTING UNTUK AUTO-VIP:**\n` +
                `Saat mengisi pesan di Saweria, **WAJIB sertakan ID Discord kamu** agar bot bisa otomatis memberikan pangkat VIP dan mendeteksi akunmu!\n` +
                `*Contoh Pesan: "Sewa hosting ya min! ID: 29384729384729384"*`
            )
            .setFooter({ text: 'Terima kasih banyak atas dukungan kalian! ❤️' })
            .setTimestamp();

        return message.reply({ embeds: [donateEmbed] });
    }

    // ─── PERINTAH ADMIN: !donationlogset #channel ───
    if (command === 'donationlogset') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('✖️ Khusus Administrator.');
        }
        const targetChannel = message.mentions.channels.first();
        if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
            return message.reply('✖️ Format salah! Tag Text Channel tujuannya.');
        }
        globalDbCache.donationConfig.logChannelId = targetChannel.id;
        return message.reply(`✅ **Sukses!** Channel <#${targetChannel.id}> resmi jadi tempat log Saweria.`);
    }

    // ─── PERINTAH ADMIN: !viproleset @role ───
    if (command === 'viproleset') {
        if (!message.member.permissions.has('Administrator')) return message.reply('✖️ Admin Only.');
        const targetRole = message.mentions.roles.first();
        if (!targetRole) return message.reply('✖️ Tag rolenya!');
        globalDbCache.donationConfig.vipRoleId = targetRole.id;
        return message.reply(`✅ **Sukses!** Role otomatis VIP diatur ke **${targetRole.name}**.`);
    }
}

/**
 * 🚀 LOGIKA CORE WEBHOOK SAWERIA (OTOMATIS TANPA COMMAND)
 * Fungsi ini dipicu otomatis oleh Express ketika Saweria mengirim data donasi asli.
 */
async function handleSaweriaWebhook(client, donationData, globalDbCache, saveData) {
    try {
        const { msg, name, amount } = donationData;
        console.log(`[Saweria] Menerima data donasi dari ${name} sebesar Rp ${amount}`);

        if (!globalDbCache.vipUsers) globalDbCache.vipUsers = {};
        const config = globalDbCache.donationConfig || {};

        // 1. Ekstrak ID Discord dari kolom pesan menggunakan Regex angka (17-19 digit)
        const idMatch = msg.match(/\d{17,19}/);
        let targetMember = null;
        let userId = null;

        // Ambil objek Guild/Server utama bot kamu
        const GUILD_ID = '746583847734345741'; // ID Server kamu
        const guild = client.guilds.cache.get(GUILD_ID);

        if (guild && idMatch) {
            userId = idMatch[0];
            targetMember = await guild.members.fetch(userId).catch(() => null);
        }

        // 2. Hitung jumlah hari VIP berdasarkan nominal uang (Contoh: Rp 1.000 = 1 Hari VIP)
        const jumlahHari = Math.floor(amount / 1000);

        let rewardStatusText = "Status VIP gagal diaktifkan otomatis karena ID Discord tidak valid/tidak ditemukan di kolom pesan Saweria. Silakan hubungi admin untuk klaim manual!";
        const waktuSekarang = Date.now();

        // 3. Jika ID Discord donatur valid dan mereka ada di server
        if (targetMember && userId && jumlahHari > 0) {
            const durasiMilidetik = jumlahHari * 24 * 60 * 60 * 1000;
            let waktuSelesaiBaru = waktuSekarang + durasiMilidetik;

            if (globalDbCache.vipUsers[userId] && globalDbCache.vipUsers[userId].expireAt > waktuSekarang) {
                waktuSelesaiBaru = globalDbCache.vipUsers[userId].expireAt + durasiMilidetik;
            }

            // Simpan status ke RAM database
            globalDbCache.vipUsers[userId] = {
                username: targetMember.user.username,
                expireAt: waktuSelesaiBaru
            };

            const tanggalSelesai = new Date(waktuSelesaiBaru).toLocaleDateString('id-ID', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            // Berikan Role VIP fisik di Discord secara otomatis
            if (config.vipRoleId) {
                await targetMember.roles.add(config.vipRoleId).catch(console.error);
            }

            rewardStatusText = `👑 **Reward VIP Otomatis Aktif:**\n• Akun: <@${userId}>\n• Durasi Tambahan: **${jumlahHari} Hari**\n• Berlaku Sampai: **${tanggalSelesai}**\n\n*Koin harian, kerja, & role VIP kamu sudah otomatis diperbarui oleh Mocals Chan!*`;
            
            // Simpan perubahan ke JSONBin cloud secara instan
            await saveData(globalDbCache);
        }

        // 4. KIRIM ANNOUNCEMENT REALTIME KE CHANNEL LOG DONASI
        const logChannel = guild?.channels.cache.get(config.logChannelId);
        if (logChannel) {
            const saweriaEmbed = new EmbedBuilder()
                .setColor('#f3a41d') // Warna khas Saweria kuning jingga
                .setTitle('🔔 NOTIFIKASI REALTIME SAWERIA DETECTED!')
                .setThumbnail(targetMember ? targetMember.user.displayAvatarURL({ dynamic: true }) : 'https://i.imgur.com/8N7V0w9.png')
                .setDescription(
                    `💸 **Donasi Baru Masuk Melalui Saweria!** 💸\n\n` +
                    `• **Dari**: \`${name}\`\n` +
                    `• **Jumlah**: \`Rp ${amount.toLocaleString('id-ID')}\`\n` +
                    `• **Pesan**: *"${msg}"*\n\n` +
                    `───────────────────\n` +
                    `${rewardStatusText}`
                )
                .setFooter({ text: 'Yuk bantu donasi sewa Hostinger dengan mengetik !donate' })
                .setTimestamp();

            await logChannel.send({ content: targetMember ? `🎉 Terima kasih banyak <@${userId}>!` : `🎉 Terima kasih banyak \`${name}\`!`, embeds: [saweriaEmbed] });
        }

    } catch (error) {
        console.error('❌ [Error Webhook Saweria Processing]:', error.message);
    }
}

module.exports = { handleDonationCommands, handleSaweriaWebhook };
