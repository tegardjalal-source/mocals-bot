require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder } = require('discord.js');

const axios = require('axios');
const BIN_ID = '6a19995121f9ee59d299ebec'; // ID dari website JSONBin
const MASTER_KEY = process.env.JSONBIN_KEY; 

async function fetchData() {
    try {
        const res = await axios.get(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, { headers: { 'X-Master-Key': MASTER_KEY } });
        return res.data.record;
    } catch (e) { return {}; }
}

async function saveData(data) {
    try {
        await axios.put(`https://api.jsonbin.io/v3/b/${BIN_ID}`, data, { headers: { 'X-Master-Key': MASTER_KEY, 'Content-Type': 'application/json' } });
    } catch (e) { console.error("Gagal simpan:", e); }
}

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

// --- FUNGSI-FUNGSI ---
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

async function sendUpdateLog(guild, content) {
    const data = await fetchData();
    const logChannelId = data.serverSettings?.[guild.id]?.logChannelId;
    
    if (!logChannelId) return;
    const channel = guild.channels.cache.get(logChannelId);
    if (channel) {
        channel.send({
            embeds: [new EmbedBuilder().setColor(0x00FF00).setTitle('🚀 Update Fitur Bot').setDescription(content).setTimestamp()]
        });
    }
}

client.once('ready', async () => {
    console.log(`${client.user.tag} sudah siap beraksi!`);
    
    // Memaksa bot mengambil data member ke cache
    const guild = client.guilds.cache.get(GUILD_ID);
    if (guild) {
        await guild.members.fetch().catch(console.error);
        console.log("Data member berhasil dimuat ke cache.");
    }

    updateBotStatus();
    setInterval(updateBotStatus, 60000);
});

const cron = require('node-cron');

// Fungsi ini berjalan otomatis setiap jam 00:00 pagi
cron.schedule('0 0 * * *', async () => {
    const data = await fetchData(); // <-- GANTI DARI fs.readFileSync
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;

    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }).replace('/', '-'); 

    for (const userId in data.hbd) {
        if (data.hbd[userId] === today) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                // 1. Kasih Role HBD
                const hbdRoleId = '1509897738215624744'; // Ganti dengan ID role yang benar
                await member.roles.add(hbdRoleId).catch(console.error);

                // 2. Kirim Ucapan
                const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0);
                if (channel) {
                    channel.send(`🎉 Selamat ulang tahun @${member.user.username}! Semoga harimu menyenangkan! 🎂`);
                }
            }
        }
    }
});

// --- EVENT MESSAGE ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

   let data = await fetchData();
    
    // Logika XP & Leveling
    if (!data.messages) data.messages = {};
    data.messages[message.author.id] = (data.messages[message.author.id] || 0) + 1;
    if (!data.xp) data.xp = {};
    if (!data.xp[message.author.id]) data.xp[message.author.id] = { xp: 0, level: 1 };
    data.xp[message.author.id].xp += Math.floor(Math.random() * 6) + 5;

    let neededXP = data.xp[message.author.id].level * 100;
    if (data.xp[message.author.id].xp >= neededXP) {
        data.xp[message.author.id].level += 1;
        data.xp[message.author.id].xp = 0;
        message.channel.send(`🎉 Selamat ${message.author}, kamu naik ke **Level ${data.xp[message.author.id].level}**! ✨`);
    }
    await saveData(data);

    // --- COMMANDS ---
    if (message.content === '!ping') await message.reply('Pong! 🏓');
    if (message.content === '!halo') await message.reply(`Halo ${message.author}! Mocals Bot siap membantu. ✨`);
    if (message.content === '!gabutnih') await message.reply('SAMA, AKU JUGA GABUT😠😠😠😠');
    
    if (message.content === '!rank') {
        const userXP = data.xp[message.author.id] || { xp: 0, level: 1 };
        message.reply(`📊 **Status Mocals Bot**\nLevel: **${userXP.level}**\nXP: **${userXP.xp}**`);
    }

    if (message.content.startsWith('!duel')) {
        const lawan = message.mentions.members.first();
        if (!lawan) return message.reply('Tag dulu lawanmu!');
        if (lawan.user.bot) return message.reply('Bot tidak bisa diajak duel! 🤖');
        if (lawan.id === message.author.id) return message.reply('Masa duel sama diri sendiri? 😅');

        const menang = Math.random() < 0.5 ? message.author.username : lawan.user.username;
        const kalah = menang === message.author.username ? lawan.user.username : message.author.username;
        
        message.channel.send(`⚔️ **${message.author.username}** menantang **${lawan.user.username}** untuk duel maut!`);
        setTimeout(() => message.channel.send(`💥 JLEB! Pertarungan berlangsung sengit...`), 1500);
        setTimeout(() => message.channel.send(`🏆 Hasilnya: **${menang}** berhasil mengalahkan **${kalah}**!`), 3500);
    }

    if (message.content.startsWith('!8ball')) {
        const q = message.content.slice(7);
        const ans = ['Ya, tentu saja! ✨', 'Sepertinya tidak...', 'Mungkin nanti.', 'Jangan harap.', 'Tentu saja! 🍀', 'Tidak mungkin.'];
        message.reply(`🎱 **Pertanyaan**: ${q || 'kosong'}\n**Jawaban**: ${ans[Math.floor(Math.random() * ans.length)]}`);
    }

    if (message.content.startsWith('!remind')) {
        const args = message.content.split(' ');
        const waktu = parseInt(args[1]);
        const pesan = args.slice(2).join(' ');
        if (!waktu || !pesan) return message.reply('Contoh: !remind 10 Belajar');
        message.reply(`✅ Oke, diingatkan dalam ${waktu} detik.`);
        setTimeout(() => message.channel.send(`⏰ ${message.author}, pengingat: **${pesan}**`), waktu * 1000);
    }

    if (message.content.startsWith('!userinfo')) {
        const member = message.mentions.members.first() || message.member;
        const roles = member.roles.cache.filter(r => r.id !== message.guild.id).map(r => `<@&${r.id}>`).join(', ') || 'Tidak ada';
        
        // Menghitung berapa lama sudah bergabung
        const joinedDays = Math.floor((new Date() - member.joinedAt) / (1000 * 60 * 60 * 24 * 365));
        
        message.reply({
            embeds: [new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`👤 Informasi User: ${member.user.username}`)
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: 'ID', value: `\`${member.id}\``, inline: true },
                    { name: 'Bergabung di Server', value: `${joinedDays} years ago`, inline: true },
                    { name: 'Total Pesan', value: `\`${data.messages?.[member.id] || 0}\``, inline: true },
                    { name: 'Roles', value: roles }
                )
            ]
        });
    }

  if (message.content === '!serverinfo') {
        const { guild } = message;
        message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`🏠 Info Server: ${guild.name}`)
                    .addFields(
                        { name: 'Total Member', value: `\`${guild.memberCount}\``, inline: true },
                        { name: 'Dibuat pada', value: guild.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), inline: true }
                    )
            ]
        });
    }

    // COMMAND TEST HBD
    if (message.content === '!teshbd' && message.member.permissions.has('Administrator')) {
        const hbdRoleId = '1509897738215624744';
        
        // 1. Tambahkan role ke pengirim pesan sebagai simulasi
        if (!message.member.roles.cache.has(hbdRoleId)) {
            message.member.roles.add(hbdRoleId).catch(console.error);
        }

        // 2. Kirim pesan selamat ulang tahun
        message.channel.send(`🎉 (TEST) Selamat ulang tahun ${message.author}! Semoga harimu menyenangkan! 🎂`);

        // 3. Simulasi hapus role setelah 5 detik (biar kamu tidak perlu nunggu 24 jam)
        setTimeout(() => {
            message.member.roles.remove(hbdRoleId).catch(console.error);
            message.channel.send(`⏱️ (TEST) Role HBD telah dihapus dari ${message.author}.`);
        }, 5000); 
    }

    if (message.content.startsWith('!sethbd')) {
        const tgl = message.content.split(' ')[1];
        if (!tgl) return message.reply('Gunakan !sethbd DD-MM');
        if (!data.hbd) data.hbd = {};
        data.hbd[message.author.id] = tgl;
        
        await saveData(data); // <--- GANTI JADI INI
        message.reply('✅ Tanggal ultah disimpan!');
    }

    if (message.content.startsWith('!setupupdate') && message.member.permissions.has('Administrator')) {
        const ch = message.mentions.channels.first();
        if (!ch) return message.reply('Tag channel!');
        if (!data.serverSettings) data.serverSettings = {};
        data.serverSettings[message.guild.id] = { logChannelId: ch.id };
        
        await saveData(data); // <--- GANTI JADI INI
        message.reply(`✅ Log diatur ke ${ch}`);
    }
    
    if (message.content.startsWith('!postupdate') && message.member.permissions.has('Administrator')) {
        sendUpdateLog(message.guild, message.content.slice(12));
        message.reply('✅ Terkirim!');
    }
});

// Event Join/Leave
client.on('guildMemberAdd', async (member) => { 
    const data = await fetchData(); // Data sekarang diambil dari JSONBin
    
    // Mengambil data server berdasarkan ID server
    const serverData = data[member.guild.id];
    const welcomeId = serverData ? serverData.welcomeId : null;

    if (welcomeId) {
        const ch = member.guild.channels.cache.get(welcomeId);
        if (ch) {
            ch.send(`Welcome imoet ${member}! ✨`);
        } else {
            console.log(`DEBUG: Channel dengan ID ${welcomeId} tidak ditemukan di cache server.`);
        }
    } else {
        console.log(`DEBUG: Data welcomeId tidak ditemukan untuk server ${member.guild.id}.`);
    }
});

console.log(process.env.DISCORD_TOKEN);
client.login(process.env.DISCORD_TOKEN);
