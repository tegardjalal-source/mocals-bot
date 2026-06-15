const { ChannelType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

/**
 * Logika Perintah Admin
 */
async function handleDonationCommands(message, command, args, globalDbCache) {
    if (!globalDbCache.donationConfig) globalDbCache.donationConfig = { logChannelId: null };

    if (command === 'donationlogset') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('✖️ Admin Only.');
        const targetChannel = message.mentions.channels.first();
        if (!targetChannel) return message.reply('✖️ Tag channel log-nya!');
        globalDbCache.donationConfig.logChannelId = targetChannel.id;
        return message.reply(`✅ Channel <#${targetChannel.id}> siap menerima notif donasi!`);
    }
}

/**
 * LOGIKA WEBHOOK: FIXED MAPPING DATA
 */
async function handleSaweriaWebhook(client, donationData, globalDbCache, saveData) {
    try {
        // Mapping field yang benar dari JSON Saweria
        const name = donationData.donator_name || "Anonim";
        const amount = donationData.amount_raw || 0;
        const msg = donationData.message || "-";
        
        // PENGAMAN: Pastikan amount berupa angka agar toLocaleString() tidak crash
        const parsedAmount = parseInt(amount) || 0;
        
        console.log(`[Donation] Menerima donasi dari ${name} sebesar Rp ${parsedAmount}`);

        const config = globalDbCache.donationConfig || {};
        
        // Ambil guild dan channel
        const GUILD_ID = '746583847734345741';
        const guild = client.guilds.cache.get(GUILD_ID);
        
        if (!guild) {
            console.error('❌ [Error] Guild tidak ditemukan oleh bot!');
            return;
        }

        const logChannel = guild.channels.cache.get(config.logChannelId);

        if (!logChannel) {
            console.error('⚠️ [Error] Channel log donasi belum di-set di server! Gunakan perintah !donationlogset');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#f3a41d')
            .setTitle('💸 DONASI BARU MASUK!')
            .addFields(
                { name: '👤 Donatur', value: `\`${name}\``, inline: true },
                { name: '💰 Nominal', value: `\`Rp ${parsedAmount.toLocaleString('id-ID')}\``, inline: true },
                { name: '💬 Pesan', value: `*${msg}*`, inline: false }
            )
            .setFooter({ text: 'Admin, jangan lupa kasih role donatur secara manual ya! ✨' })
            .setTimestamp();

        await logChannel.send({ content: "🎉 **Terima kasih atas dukungannya!**", embeds: [embed] });
        console.log(`✅ [Saweria] Notifikasi dari ${name} sukses terkirim ke Discord.`);

    } catch (error) {
        console.error('❌ [Error Webhook]:', error.message);
    }
}

module.exports = { handleDonationCommands, handleSaweriaWebhook };
