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

// Pengaman file settings.json
if (!fs.existsSync('./settings.json')) {
    fs.writeFileSync('./settings.json', JSON.stringify({}, null, 2));
}

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

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Gunakan 'else if' agar bot hanya memproses satu kondisi saja
    if (message.content === '!ping') {
        await message.reply('Pong! 🏓');
    } 
    else if (message.content === '!halo') {
        await message.reply(`Halo ${message.author}! Mocals Bot siap membantu. ✨`);
    } 
    else if (message.content === '!flip') {
        const hasil = Math.random() < 0.5 ? 'Kepala (Heads) 🪙' : 'Ekor (Tails) 🪙';
        message.reply(`Hasil koin: **${hasil}**!`);
    }
    else if (message.content === '!teswelcome') {
        client.emit('guildMemberAdd', message.member);
    }
    else if (message.content === '!tesbye') {
        client.emit('guildMemberRemove', message.member);
    }
    else if (message.content.startsWith('!welcomeuserset')) {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('Tag channel-nya! Contoh: !welcomeuserset #welcome');
        let data = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
        data[message.guild.id] = { welcomeId: channel.id };
        fs.writeFileSync('./settings.json', JSON.stringify(data, null, 2));
        message.reply(`✅ Channel welcome diatur ke ${channel}`);
    }
});

// Event Join/Leave tetap sama...
// (Pastikan tidak ada duplikasi client.on di tempat lain dalam file ini)

client.login(process.env.DISCORD_TOKEN);
