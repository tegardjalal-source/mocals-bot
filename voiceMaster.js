const { ChannelType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Set memori internal untuk mencatat ID channel privat sementara buatan bot
const dynamicVoiceChannels = new Set();

/**
 * Inisialisasi Fitur Voice Master Dinamis
 * @param {import('discord.js').Client} client 
 * @param {Object} globalDbCache 
 */
function initVoiceMaster(client, globalDbCache) {
    
    // ─── EVENT DETEKSI OTOMATIS CREATE TO JOIN ───
    client.on('voiceStateUpdate', async (oldState, newState) => {
        const member = newState.member;
        if (!member || member.user.bot) return;

        // Ambil daftar Voice Hub yang didaftarkan Admin dari database RAM
        const registeredHubs = globalDbCache.voiceHubs || [];

        // JIKA USER MASUK KE SALAH SATU VOICE HUB YANG DIPANTAU
        if (newState.channelId && registeredHubs.includes(newState.channelId)) {
            try {
                // 1. Buat Voice Channel baru secara otomatis
                const roomBaru = await newState.guild.channels.create({
                    name: `🔊 Room ${member.user.username}`,
                    type: ChannelType.GuildVoice,
                    parent: newState.channel.parentId, // Otomatis menyamakan kategori dengan Hub-nya
                    permissionOverwrites: [
                        {
                            id: member.id,
                            allow: [
                                PermissionFlagsBits.ManageChannels, 
                                PermissionFlagsBits.MoveMembers, 
                                PermissionFlagsBits.MuteMembers, 
                                PermissionFlagsBits.DeafenMembers
                            ], // Berikan hak Owner Room privat
                        },
                    ],
                });

                // 2. Catat ID channel privat ke memori bot
                dynamicVoiceChannels.add(roomBaru.id);

                // 3. Pindahkan user ke room privat barunya
                await member.voice.setChannel(roomBaru);
                console.log(`👤 [Voice Master] Room privat dinamis berhasil dibuat untuk ${member.user.username}`);

                // 4. KIRIM EMBED SAPAAN & INSTRUKSI COMMAND
                const sapaanEmbed = new EmbedBuilder()
                    .setColor('#00ffbb')
                    .setTitle(`👑 Selamat Datang di Room Privat Milikmu!`)
                    .setDescription(
                        `Halo ${member}! Room privat ini dikontrol penuh olehmu.\n\n` +
                        `**Command Khusus Owner Room:**\n` +
                        `🔹 \`!limitvoice [angka]\` - Mengatur batas maksimal slot member di room kamu.\n` +
                        `*Contoh: \`!limitvoice 5\` (Maksimal 5 orang saja yang bisa masuk).*`
                    )
                    .setTimestamp();

                // Kirim ke text-chat internal milik Voice Channel tersebut (fitur bawaan Discord baru)
                await roomBaru.send({ content: `${member}`, embeds: [sapaanEmbed] });

            } catch (err) {
                console.error('❌ [Voice Master Error] Gagal mengeksekusi pembuatan room:', err.message);
            }
        }

        // JIKA USER KELUAR DARI ROOM PRIVAT TEMPORER (HAPUS JIKA KOSONG)
        if (oldState.channelId && dynamicVoiceChannels.has(oldState.channelId)) {
            const channelLama = oldState.guild.channels.cache.get(oldState.channelId);
            if (channelLama && channelLama.members.size === 0) {
                try {
                    await channelLama.delete();
                    dynamicVoiceChannels.delete(oldState.channelId); // Bersihkan cache memori
                    console.log(`🗑️ [Voice Master] Room privat kosong telah dibersihkan otomatis.`);
                } catch (err) {
                    console.error('❌ [Voice Master Error] Gagal menghapus room kosong:', err.message);
                }
            }
        }
    });
}

/**
 * Logika Handler untuk Perintah Teks Perintah Voice Master
 * @param {import('discord.js').Message} message 
 * @param {string} command 
 * @param {string[]} args 
 * @param {Object} globalDbCache 
 */
async function handleVoiceMasterCommands(message, command, args, globalDbCache) {
    const guildId = message.guild.id;

    // ─── PERINTAH ADMIN 1: !createjoin #channel ───
    if (command === 'createjoin') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('✖️ Perintah ini rahasia! Hanya bisa digunakan oleh **Administrator** server.');
        }

        // Ambil channel yang di-tag oleh admin (mentions)
        const targetChannel = message.mentions.channels.first();
        if (!targetChannel || targetChannel.type !== ChannelType.GuildVoice) {
            return message.reply('✖️ Format salah! Silakan tag Voice Channel tujuannya.\nContoh: `!createjoin #Buat-Room`');
        }

        if (!globalDbCache.voiceHubs) globalDbCache.voiceHubs = [];
        if (globalDbCache.voiceHubs.includes(targetChannel.id)) {
            return message.reply(`✖️ Voice Channel ${targetChannel} sudah ada di dalam daftar pantauan!`);
        }

        globalDbCache.voiceHubs.push(targetChannel.id);
        return message.reply(`✅ Berhasil! ${targetChannel} sekarang aktif menjadi Hub **Create to Join**.`);
    }

    // ─── PERINTAH ADMIN 2: !checkcreatelist ───
    if (command === 'checkcreatelist') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('✖️ Khusus Administrator server.');
        }

        const hubs = globalDbCache.voiceHubs || [];
        if (hubs.length === 0) {
            return message.reply('📭 Belum ada Voice Channel Hub yang terdaftar untuk sistem Create to Join.');
        }

        let listText = '🔊 **Daftar Voice Channel Hub (Create to Join):**\n\n';
        hubs.forEach((id, index) => {
            listText += `${index + 1}. <#${id}> ` + `*(ID: \`${id}\`)*\n`;
        });

        return message.reply(listText);
    }

    // ─── PERINTAH PUBLIC: !limitvoice [angka] ───
    if (command === 'limitvoice') {
        const voiceChannel = message.member.voice.channel;

        // Proteksi 1: Cek apakah user sedang berada di voice channel privat
        if (!voiceChannel || !dynamicVoiceChannels.has(voiceChannel.id)) {
            return message.reply('✖️ Kamu harus berada di dalam **Room Privat buatanmu sendiri** untuk menggunakan perintah ini!');
        }

        // Proteksi 2: Cek apakah dia punya hak kelola channel (artinya dia owner pembuat room privat tersebut)
        if (!voiceChannel.permissionsFor(message.member).has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('✖️ Kamu bukan pemilik room privat ini, tidak berhak mengatur limit!');
        }

        const limitAngka = parseInt(args[0]);
        if (isNaN(limitAngka) || limitAngka < 0 || limitAngka > 99) {
            return message.reply('✖️ Masukkan angka limit yang valid antara **0 sampai 99**!\n*(Angka 0 berarti tidak ada batas/unlimited).*');
        }

        try {
            // Ubah batas maksimal user di channel tersebut secara realtime
            await voiceChannel.setUserLimit(limitAngka);
            return message.reply(`✅ Batas kuota room berhasil diubah menjadi **${limitAngka === 0 ? 'Tanpa Batas (Unlimited)' : limitAngka + ' Orang'}**.`);
        } catch (err) {
            console.error(err);
            return message.reply('✖️ Gagal mengubah limit room karena keterbatasan izin bot.');
        }
    }
}

module.exports = { initVoiceMaster, handleVoiceMasterCommands };
