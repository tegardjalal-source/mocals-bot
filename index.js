require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
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

    // Minigame Flip (Tetap ada)
    if (message.content === '!flip') {
        const hasil = Math.random() < 0.5 ? 'Kepala (Heads) 🪙' : 'Ekor (Tails) 🪙';
        message.reply(`Hasil koin: **${hasil}**!`);
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
