const { ChannelType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

/**
 * Logika Perintah Admin
 */
async function handleDonationCommands(message, command, args, globalDbCache) {
    if (!globalDbCache.donationConfig) globalDbCache.donationConfig = { logChannelId: null };

    // Set channel log donasi
    if (command === 'donationlogset') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('✖️ Admin Only.');
        const targetChannel = message.mentions.channels.first();
        if (!targetChannel) return message.reply('✖️ Tag channel log-nya!');
        globalDbCache.donationConfig.logChannelId = targetChannel.id;
        return message.reply(`✅ Channel <#${targetChannel.id}> siap menerima notif donasi!`);
    }
}

/**
 * LOGIKA WEBHOOK: Cuma kirim notif, tidak ada auto-role
 */
async function handleSaweriaWebhook(client, donationData, globalDbCache, saveData) {
    try {
        const { name, amount, msg } = donationData;
        const config = globalDbCache.donationConfig || {};
        
        // Ambil channel log
        const GUILD_ID = '746583847734345741';
        const guild = client.guilds.cache.get(GUILD_ID);
        const logChannel = guild?.channels.cache.get(config.logChannelId);

        if (!logChannel) return console.log('⚠️ Channel log belum di-set!');

        const embed = new EmbedBuilder()
            .setColor('#f3a41d')
            .setTitle('💸 DONASI BARU MASUK!')
            .addFields(
                { name: '👤 Donatur', value: `\`${name}\``, inline: true },
                { name: '💰 Nominal', value: `\`Rp ${amount.toLocaleString('id-ID')}\``, inline: true },
                { name: '💬 Pesan', value: `*${msg || '-'}*`, inline: false }
            )
            .setFooter({ text: 'Admin, jangan lupa kasih role donatur secara manual ya! ✨' })
            .setTimestamp();

        await logChannel.send({ content: "🎉 **Terima kasih atas dukungannya!**", embeds: [embed] });
        console.log(`✅ [Saweria] Notifikasi dari ${name} sukses terkirim.`);

    } catch (error) {
        console.error('❌ [Error Webhook]:', error.message);
    }
}

module.exports = { handleDonationCommands, handleSaweriaWebhook };
