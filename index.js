require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const GUILD_ID = '746583847734345741';

// Fungsi Update Status Bot
async function updateBotStatus() {
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return;
        const members = await guild.members.fetch({ withPresences: true });
        const onlineCount = members.filter(m => !m.user.bot && m.presence && ['online', 'idle', 'dnd'].includes(m.presence.status)).size;
        const totalHumans = members.filter(m => !m.user.bot).size;
        const offlineCount = totalHumans - onlineCount;
        client.user.setActivity(`🍀 𝕺𝖓𝖑𝖎𝖓𝖊: ${onlineCount} | 🍁 𝕺𝖋𝖋𝖑𝖎𝖓𝖊: ${offlineCount}`, { type: ActivityType.Custom });
    } catch (e) { console.error('Gagal update status:', e); }
}

client.once('ready', () => {
    console.log(`${client.user.tag} sudah siap beraksi!`);
    
    // Fitur Auto-Backup
    if (fs.existsSync('./settings.json')) {
        fs.copyFileSync('./settings.json', './settings.backup.json');
        console.log('✅ Backup data berhasil dibuat!');
    }
    
    updateBotStatus();
    setInterval(updateBotStatus, 60000);
});

// Perintah Bot
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // --- LOGIKA XP/LEVELING ---
    let data = fs.existsSync('./settings.json') ? JSON.parse(fs.readFileSync('./settings.json', 'utf8')) : {};
    if (!data.xp) data.xp = {};
    if (!data.xp[message.author.id]) data.xp[message.author.id] = { xp: 0, level: 1 };

    // Tambah XP acak antara 5-10
    data.xp[message.author.id].xp += Math.floor(Math.random() * 6) + 5;

    // Level Up setiap 100 XP
    let neededXP = data.xp[message.author.id].level * 100;
    if (data.xp[message.author.id].xp >= neededXP) {
        data.xp[message.author.id].level += 1;
        data.xp[message.author.id].xp = 0;
        message.channel.send(`🎉 Selamat ${message.author}, kamu naik ke **Level ${data.xp[message.author.id].level}**! ✨`);
    }
    fs.writeFileSync('./settings.json', JSON.stringify(data, null, 2));

    // Command Dasar
    if (message.content === '!ping') await message.reply('Pong! 🏓');
    if (message.content === '!halo') await message.reply(`Halo ${message.author}! Mocals Bot siap membantu. ✨`);

    // Command Rank
    if (message.content === '!rank') {
        const userXP = data.xp[message.author.id] || { xp: 0, level: 1 };
        message.reply(`📊 **Status Mocals Bot**\nLevel: **${userXP.level}**\nXP: **${userXP.xp}**`);
    }

    if (message.content === '!perkenalan_dong') await message.reply(`Halo semuanya! 👋 Kenalin, namaku Mocals chan.

Kehadiranku di sini memiliki satu misi utama: membantu membuat server Mocals menjadi tempat yang lebih seru, nyaman, dan tertata rapi bagi kita semua.

Sebagai bot yang masih bayi dalam dunia bot, aku ingin jujur bahwa saat ini kemampuanku masih terbatas. Aku ibarat seorang murid yang sedang rajin-rajinnya belajar. Mungkin terkadang aku melakukan kesalahan atau belum bisa memenuhi semua keinginan kalian, tapi jangan khawatir!

Aku berkomitmen untuk terus berkembang setiap harinya. Seiring berjalannya waktu, aku akan terus diperbarui, belajar fitur-fitur baru, dan menjadi jauh lebih mahir untuk melayani kebutuhan khusus di server ini.

Untuk saat ini, kalian bisa mencoba memanggilku dengan perintah !halo. Terima kasih banyak sudah menerimaku di sini. Mari kita tumbuh bersama dan jadikan server ini semakin keren! 🚀`);

    // Minigame Flip
    if (message.content === '!flip') {
        const hasil = Math.random() < 0.5 ? 'Kepala (Heads) 🪙' : 'Ekor (Tails) 🪙';
        message.reply(`Hasil koin: **${hasil}**!`);
    }

    // FITUR BROADCAST (Hanya untuk Admin)
    if (message.content.startsWith('!mocalschanbc')) {
        // Cek apakah pengirim adalah Admin
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('❌ Maaf, hanya Administrator yang bisa menggunakan fitur ini.');
        }

        const args = message.content.split(' ');
        const targetChannel = message.mentions.channels.first();
        const pesan = args.slice(2).join(' '); // Mengambil teks setelah tag channel

        if (!targetChannel) return message.reply('Format salah! Contoh: `!mocalschanbc #channel Halo semuanya!`');
        if (!pesan) return message.reply('Tulis pesan yang ingin di-broadcast!');

        // Kirim pesan ke channel target
        targetChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('📢 Pengumuman Penting')
                    .setDescription(pesan)
                    .setFooter({ text: `Dikirim oleh: ${message.author.username}` })
            ]
        }).catch(err => {
            console.error(err);
            message.reply('Gagal mengirim pesan, pastikan bot punya izin akses ke channel tersebut!');
        });

        message.reply(`✅ Pesan berhasil dikirim ke ${targetChannel}!`);
    }

   // FITUR MOCALS DUEL (PERBAIKAN)
    if (message.content.startsWith('!duel')) {
        const lawan = message.mentions.members.first();
        
        if (!lawan) return message.reply('Tag dulu siapa yang mau kamu ajak duel! Contoh: `!duel @user`');
        if (lawan.user.bot) return message.reply('Bot tidak bisa diajak duel! 🤖');
        if (lawan.id === message.author.id) return message.reply('Masa duel sama diri sendiri? Aneh banget! 😅');

        // Mengambil nama yang benar
        const namaPenantang = message.author.username;
        const namaLawan = lawan.user.username; // Perbaikan di sini
        
        const chance = Math.random();
        const menang = chance < 0.5 ? namaPenantang : namaLawan;
        const kalah = menang === namaPenantang ? namaLawan : namaPenantang;
        
        message.channel.send(`⚔️ **${namaPenantang}** menantang **${namaLawan}** untuk duel maut!`);
        
        setTimeout(() => {
            message.channel.send(`💥 JLEB! Pertarungan berlangsung sengit...`);
        }, 1500);

        setTimeout(() => {
            message.channel.send(`🏆 Hasilnya: **${menang}** berhasil mengalahkan **${kalah}** dengan serangan telak!`);
        }, 3500);
    }
    
    // FITUR 8-BALL
    if (message.content.startsWith('!8ball')) {
        const pertanyaan = message.content.slice(7);
        if (!pertanyaan) return message.reply('Tanya sesuatu dong! Contoh: !8ball apakah aku keren?');
        const jawaban = [
            'Ya, tentu saja! ✨',
            'Sepertinya tidak...',
            'Mungkin suatu hari nanti.',
            'Jangan berharap banyak.',
            'Tanya lagi nanti ya.',
            'Tentu saja, itu pasti terjadi! 🍀',
            'Tidak mungkin itu terjadi.'
        ];
        const hasil = jawaban[Math.floor(Math.random() * jawaban.length)];
        message.reply(`🎱 **Pertanyaan**: ${pertanyaan}\n**Jawaban**: ${hasil}`);
    }

    // FITUR REMINDER 
    if (message.content.startsWith('!remind')) {
        const args = message.content.split(' ');
        const waktu = parseInt(args[1]); // dalam detik
        const pesan = args.slice(2).join(' ');

        if (!waktu || !pesan) return message.reply('Format salah! Contoh: !remind 10 Belajar coding');
        
        message.reply(`✅ Oke, aku akan mengingatkanmu dalam ${waktu} detik: "${pesan}"`);
        
        setTimeout(() => {
            message.channel.send(`⏰ ${message.author}, pengingatmu: **${pesan}**`);
        }, waktu * 1000);
    }

   // FITUR USER INFO (DENGAN ROLE & JUMLAH PESAN)
    if (message.content.startsWith('!userinfo')) {
        const member = message.mentions.members.first() || message.member;
        
        // Ambil data pesan
        const messageCount = data.messages?.[member.id] || 0;
        
        const roles = member.roles.cache
            .filter(r => r.id !== message.guild.id)
            .map(r => `<@&${r.id}>`)
            .join(', ') || 'Tidak ada role';

        message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle(`👤 Informasi User: ${member.user.username}`)
                    .setThumbnail(member.user.displayAvatarURL())
                    .addFields(
                        { name: 'ID', value: `\`${member.user.id}\``, inline: true },
                        { name: 'Bergabung di Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                        { name: 'Total Pesan', value: `\`${messageCount}\``, inline: true }, // Menambahkan statistik pesan
                        { name: 'Roles', value: roles, inline: false }
                    )
            ]
        });
    }

    // FITUR SERVER INFO
    if (message.content === '!serverinfo') {
        const { guild } = message;
        message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`🏠 Info Server: ${guild.name}`)
                    .addFields(
                        { name: 'Total Member', value: `\`${guild.memberCount}\``, inline: true },
                        { name: 'Dibuat pada', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true }
                    )
            ]
        });
    }

    // Command Tes & Setup
    if (message.content === '!teswelcome') client.emit('guildMemberAdd', message.member);
    if (message.content === '!tesbye') client.emit('guildMemberRemove', message.member);

    if (message.content.startsWith('!welcomeuserset')) {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('Tag channel-nya! Contoh: !welcomeuserset #welcome');
        data[message.guild.id] = { welcomeId: channel.id };
        fs.writeFileSync('./settings.json', JSON.stringify(data, null, 2));
        message.reply(`✅ Channel welcome diatur ke ${channel}`);
    }
});

// Event Join/Leave
client.on('guildMemberAdd', (m) => {
    const data = fs.existsSync('./settings.json') ? JSON.parse(fs.readFileSync('./settings.json', 'utf8')) : {};
    const channel = m.guild.channels.cache.get(data[m.guild.id]?.welcomeId);
    if (channel) channel.send(`Welcome imoet ${m}! ✨`);
});

client.on('guildMemberRemove', (m) => {
    const data = fs.existsSync('./settings.json') ? JSON.parse(fs.readFileSync('./settings.json', 'utf8')) : {};
    const channel = m.guild.channels.cache.get(data[m.guild.id]?.welcomeId);
    if (channel) channel.send(`Yah... ${m.user.tag} sudah keluar.`);
});

console.log(process.env.DISCORD_TOKEN);
client.login(process.env.DISCORD_TOKEN);
