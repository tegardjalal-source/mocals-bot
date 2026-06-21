const { ChannelType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

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

        // Ambil daftar Voice Hub dari database RAM
        const registeredHubs = globalDbCache.voiceHubs || [];
        
        // [BUG FIX 1]: Siapkan array database untuk mengingat room (Anti-Amnesia saat bot restart)
        if (!globalDbCache.dynamicVoices) globalDbCache.dynamicVoices = [];

        // ─── 1. JIKA USER MASUK KE SALAH SATU VOICE HUB ───
        if (newState.channelId && registeredHubs.includes(newState.channelId)) {
            try {
                // Buat Voice Channel baru secara otomatis
                const roomBaru = await newState.guild.channels.create({
                    name: `🔊 Room ${member.user.username}`,
                    type: ChannelType.GuildVoice,
                    parent: newState.channel.parentId, // Samakan kategori dengan Hub
                    permissionOverwrites: [
                        {
                            id: member.id,
                            allow: [
                                PermissionFlagsBits.ManageChannels, 
                                PermissionFlagsBits.MoveMembers, 
                                PermissionFlagsBits.MuteMembers, 
                                PermissionFlagsBits.DeafenMembers
                            ], // Hak Owner
                        },
                        {
                            // Pastikan bot tetap punya hak akses mengelola room ini
                            id: client.user.id,
                            allow: [
                                PermissionFlagsBits.ManageChannels, 
                                PermissionFlagsBits.MoveMembers, 
                                PermissionFlagsBits.Connect, 
                                PermissionFlagsBits.ViewChannel
                            ]
                        }
                    ],
                });

                // [BUG FIX 2]: Anti "Hit-and-Run" Ghost Channel
                // Cek apakah user keburu keluar voice/pindah sebelum room selesai dibuat
                if (!member.voice.channel || member.voice.channelId !== newState.channelId) {
                    await roomBaru.delete().catch(() => null);
                    return;
                }

                // Catat ID channel privat ke Database Bot
                globalDbCache.dynamicVoices.push(roomBaru.id);

                // Pindahkan user ke room privat barunya
                await member.voice.setChannel(roomBaru);
                console.log(`👤 [Voice Master] Room privat dinamis berhasil dibuat untuk ${member.user.username}`);

                // Kirim Embed Sapaan
                const sapaanEmbed = new EmbedBuilder()
                    .setColor('#00ffbb')
                    .setTitle(`👑 Selamat Datang di Room Privat Milikmu!`)
                    .setDescription(
                        `Halo ${member}! Room privat ini dikontrol penuh olehmu.\n\n` +
                        `**Command Khusus Owner Room:**\n` +
                        `🔹 \`!limitvoice [angka]\` - Mengatur batas maksimal slot (0-99).\n` +
                        `🔹 \`!namevoice [nama]\` - Mengubah nama room privatmu.\n` +
                        `🔹 \`!kickvoice @user\` - Menendang user lain keluar dari room.`
                    )
                    .setTimestamp();

                await roomBaru.send({ content: `${member}`, embeds: [sapaanEmbed] }).catch(() => null);

            } catch (err) {
                console.error('❌ [Voice Master Error] Gagal mengeksekusi pembuatan room:', err.message);
            }
        }

        // ─── 2. JIKA USER KELUAR DARI ROOM PRIVAT TEMPORER ───
        if (oldState.channelId && globalDbCache.dynamicVoices.includes(oldState.channelId)) {
            const channelLama = oldState.guild.channels.cache.get(oldState.channelId);
            
            // Hapus jika room benar-benar sudah tidak ada isinya
            if (channelLama && channelLama.members.size === 0) {
                try {
                    await channelLama.delete();
                    
                    // Hapus dari ingatan cache database
                    globalDbCache.dynamicVoices = globalDbCache.dynamicVoices.filter(id => id !== oldState.channelId);
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

    // ─── PERINTAH ADMIN 1: !createjoin #channel ATAU !createjoin [ID_ANGKA] ───
    if (command === 'createjoin') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('✖️ Perintah ini rahasia! Hanya bisa digunakan oleh **Administrator** server.');
        }

        let targetChannel = message.mentions.channels.first();
        const inputId = args[0];

        if (!targetChannel && inputId) {
            targetChannel = message.guild.channels.cache.get(inputId);
        }

        if (!targetChannel || targetChannel.type !== ChannelType.GuildVoice) {
            return message.reply('✖️ Format salah! Silakan tag Voice Channel atau masukkan ID mentahnya.\nContoh 1: `!createjoin #Buat-Room`\nContoh 2: `!createjoin 1515871624866566274`');
        }

        if (!globalDbCache.voiceHubs) globalDbCache.voiceHubs = [];
        if (globalDbCache.voiceHubs.includes(targetChannel.id)) {
            return message.reply(`✖️ Voice Channel ${targetChannel} sudah ada di dalam daftar pantauan!`);
        }

        globalDbCache.voiceHubs.push(targetChannel.id);
        return message.reply(`✅ Berhasil! ${targetChannel} sekarang aktif menjadi Hub **Create to Join**.`);
    }

    // ─── PERINTAH ADMIN 2: !removevoice [ID_ANGKA] ───
    if (command === 'removevoice') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('✖️ Perintah ini rahasia! Hanya bisa digunakan oleh **Administrator** server.');
        }

        const inputId = args[0];
        if (!inputId) {
            return message.reply('✖️ Format salah! Masukkan ID Voice Channel Hub yang ingin dihapus dari list.\nContoh: `!removevoice 1515871624866566274`');
        }

        if (!globalDbCache.voiceHubs || globalDbCache.voiceHubs.length === 0) {
            return message.reply('✖️ Daftar pantauan Voice Hub di server ini memang sedang kosong.');
        }

        if (!globalDbCache.voiceHubs.includes(inputId)) {
            return message.reply('✖️ ID Voice Channel tersebut tidak ditemukan di dalam daftar pantauan bot!');
        }

        globalDbCache.voiceHubs = globalDbCache.voiceHubs.filter(id => id !== inputId);
        return message.reply(`🗑️ Berhasil! Voice Hub dengan ID \`${inputId}\` telah dihapus dari daftar pantauan bot.`);
    }

    // ─── PERINTAH ADMIN 3: !checkcreatelist ───
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

    // ─── PERINTAH PUBLIC PRODAK: PROTEKSI KEPEMILIKAN ROOM PRIVAT ───
    const voiceMasterCommands = ['limitvoice', 'namevoice', 'kickvoice'];
    if (voiceMasterCommands.includes(command)) {
        const voiceChannel = message.member.voice.channel;

        // Cek apakah user berada di voice channel privat buatan bot menggunakan sinkronisasi Database DB
        if (!voiceChannel || !(globalDbCache.dynamicVoices || []).includes(voiceChannel.id)) {
            return message.reply('✖️ Kamu harus berada di dalam **Room Privat buatanmu sendiri** untuk menggunakan perintah ini!');
        }

        // Cek apakah user adalah Owner sejati dari room tersebut
        if (!voiceChannel.permissionsFor(message.member).has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('✖️ Kamu bukan pemilik room privat ini, tidak berhak mengaturnya!');
        }

        // ─── PERINTAH PUBLIC 1: !limitvoice [angka] ───
        if (command === 'limitvoice') {
            const limitAngka = parseInt(args[0]);
            if (isNaN(limitAngka) || limitAngka < 0 || limitAngka > 99) {
                return message.reply('✖️ Masukkan angka limit yang valid antara **0 sampai 99**!\n*(Angka 0 berarti tanpa batas/unlimited).*');
            }

            try {
                await voiceChannel.setUserLimit(limitAngka);
                return message.reply(`✅ Batas kuota room berhasil diubah menjadi **${limitAngka === 0 ? 'Tanpa Batas (Unlimited)' : limitAngka + ' Orang'}**.`);
            } catch (err) {
                return message.reply('✖️ Gagal mengubah limit room karena keterbatasan izin bot.');
            }
        }

        // ─── PERINTAH PUBLIC 2: !namevoice [nama_baru] ───
        if (command === 'namevoice') {
            const namaBaru = args.join(' ');
            if (!namaBaru) {
                return message.reply('✖️ Format salah! Masukkan nama baru untuk room kamu.\nContoh: `!namevoice Room Mabar Wifi`');
            }
            if (namaBaru.length > 30) {
                return message.reply('✖️ Nama room terlalu panjang! Maksimal cuma boleh **30 karakter**.');
            }

            try {
                await voiceChannel.setName(`🔊 ${namaBaru}`);
                return message.reply(`✅ Nama room privat kamu berhasil diubah menjadi: **🔊 ${namaBaru}**`);
            } catch (err) {
                return message.reply('✖️ Gagal mengubah nama room. Discord membatasi pergantian nama channel terlalu sering (Rate limit). Coba lagi beberapa menit kemudian!');
            }
        }

        // ─── PERINTAH PUBLIC 3: !kickvoice @user ───
        if (command === 'kickvoice') {
            const targetMember = message.mentions.members.first();
            if (!targetMember) {
                return message.reply('✖️ Format salah! Silakan tag member yang ingin ditendang keluar.\nContoh: `!kickvoice @NamaUser`');
            }

            if (targetMember.voice.channelId !== voiceChannel.id) {
                return message.reply('✖️ User tersebut tidak sedang berada di dalam room privat kamu!');
            }
            if (targetMember.id === message.author.id) {
                return message.reply('✖️ Kamu tidak bisa menendang dirimu sendiri kocak!');
            }

            try {
                // Menendang user dari voice dengan melempar mereka ke null channel
                await targetMember.voice.setChannel(null);
                return message.reply(`🚨 Berhasil! <@${targetMember.id}> telah ditendang keluar dari room privat kamu.`);
            } catch (err) {
                return message.reply('✖️ Gagal menendang user. Pastikan Role milik Mocals Bot berada di posisi tinggi dan punya izin `Move Members`.');
            }
        }
    }
}

module.exports = { initVoiceMaster, handleVoiceMasterCommands };
