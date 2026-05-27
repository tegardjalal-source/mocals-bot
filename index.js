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
    if (fs.existsSync('./settings.json')) {
        fs.copyFileSync('./settings.json', './settings.backup.json');
    }
    updateBotStatus();
    setInterval(updateBotStatus, 60000);
});

// SINI PUSAT PERINTAH (Hanya satu blok client.on ini)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    let data = fs.existsSync('./settings.json') ? JSON.parse(fs.readFileSync('./settings.json', 'utf8')) : {};
    
    // --- FITUR MENTION BOT ---
    if (message.mentions.has(client.user.id)) {
        const responses = [
            "Apaan sih tag-tag? Aku lagi sibuk! 🙄",
            "Ada apa panggil-panggil? Lagi mau curhat ya? 💅",
            "Iya, iya, aku denger kok. Gak usah di-tag terus bisa nggak? 😒",
            "Eh, ada aku ya? Sori, tadi lagi ngelamun. Kenapa?",
            "Tumben banget nge-tag. Mau minta apa nih? 🤨"
        ];
        return message.reply(responses[Math.floor(Math.random() * responses.length)]);
    }

    // --- LOGIKA XP/LEVELING ---
    if (!data.xp) data.xp = {};
    if (!data.xp[message.author.id]) data.xp[message.author.id] = { xp: 0, level: 1 };
    data.xp[message.author.id].xp += Math.floor(Math.random() * 6) + 5;
    let neededXP = data.xp[message.author.id].level * 100;
    if (data.xp[message.author.id].xp >= neededXP) {
        data.xp[message.author.id].level += 1;
        data.xp[message.author.id].xp = 0;
        message.channel.send(`🎉 Selamat ${message.author}, kamu naik ke **Level ${data.xp[message.author.id].level}**! ✨`);
    }
    fs.writeFileSync('./settings.json', JSON.stringify(data, null, 2));

    // --- COMMANDS ---
    if (message.content === '!ping') await message.reply('Pong! 🏓');
    if (message.content === '!halo') await message.reply(`Halo ${message.author}! Mocals Bot siap membantu. ✨`);
    if (message.content === '!rank') {
        const userXP = data.xp[message.author.id] || { xp: 0, level: 1 };
        message.reply(`📊 **Status Mocals Bot**\nLevel: **${userXP.level}**\nXP: **${userXP.xp}**`);
    }

    if (message.content.startsWith('!duel')) {
        const lawan = message.mentions.members.first();
        if (!lawan) return message.reply('Tag dulu siapa yang mau kamu ajak duel!');
        if (lawan.user.bot) return message.reply('Bot tidak bisa diajak duel! 🤖');
        if (lawan.id === message.author.id) return message.reply('Masa duel sama diri sendiri? 😅');
        
        message.channel.send(`⚔️ **${message.author.username}** menantang **${lawan.user.username}** untuk duel maut!`);
        setTimeout(() => {
            const menang = Math.random() < 0.5 ? message.author.username : lawan.user.username;
            const kalah = menang === message.author.username ? lawan.user.username : message.author.username;
            message.channel.send(`🏆 Hasilnya: **${menang}** berhasil mengalahkan **${kalah}**!`);
        }, 2000);
    }

    if (message.content.startsWith('!mocalschanbc')) {
        if (!message.member.permissions.has('Administrator')) return message.reply('❌ Khusus Admin!');
        const targetChannel = message.mentions.channels.first();
        const pesan = message.content.split(' ').slice(2).join(' ');
        if (!targetChannel || !pesan) return message.reply('Format: !mocalschanbc #channel pesan');
        targetChannel.send(pesan).then(() => message.reply('✅ Terkirim!'));
    }

    // (Sisa fitur lainnya seperti !8ball, !userinfo, !serverinfo taruh di bawah sini...)
});

client.on('guildMemberAdd', (m) => {
    const data = fs.existsSync('./settings.json') ? JSON.parse(fs.readFileSync('./settings.json', 'utf8')) : {};
    const channel = m.guild.channels.cache.get(data[m.guild.id]?.welcomeId);
    if (channel) channel.send(`Welcome imoet ${m}! ✨`);
});

client.login(process.env.DISCORD_TOKEN);
