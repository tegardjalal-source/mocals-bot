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
const activeDuels = {};

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

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // 1. AMBIL DATA DI PALING ATAS
    let data = await fetchData(); 

    // --- COMMAND SETUP WELCOME & LEAVE ---
    if (message.content.startsWith('!setwelcome') && message.member.permissions.has('Administrator')) {
        const ch = message.mentions.channels.first();
        if (!ch) return message.reply('Tag channel-nya! Contoh: !setwelcome #welcome');
        if (!data.serverSettings) data.serverSettings = {};
        if (!data.serverSettings[message.guild.id]) data.serverSettings[message.guild.id] = {};
        
        data.serverSettings[message.guild.id].welcomeId = ch.id;
        await saveData(data);
        return message.reply(`✅ Channel welcome berhasil diatur ke ${ch}`);
    }

    if (message.content.startsWith('!setleave') && message.member.permissions.has('Administrator')) {
        const ch = message.mentions.channels.first();
        if (!ch) return message.reply('Tag channel-nya! Contoh: !setleave #leave');
        if (!data.serverSettings) data.serverSettings = {};
        if (!data.serverSettings[message.guild.id]) data.serverSettings[message.guild.id] = {};
        
        data.serverSettings[message.guild.id].leaveId = ch.id;
        await saveData(data);
        return message.reply(`✅ Channel leave berhasil diatur ke ${ch}`);
    }
    
    // --- COMMAND TEST WELCOME & LEAVE ---
    if (message.content.startsWith('!testwelcome') && message.member.permissions.has('Administrator')) {
        client.emit('guildMemberAdd', message.member);
        return message.reply('✅ Simulasi event `guildMemberAdd` telah dijalankan.');
    }

    if (message.content.startsWith('!testleave') && message.member.permissions.has('Administrator')) {
        client.emit('guildMemberRemove', message.member);
        return message.reply('✅ Simulasi event `guildMemberRemove` telah dijalankan.');
    }

    // --- LOGIKA XP & COMMAND LAINNYA ---
    // Pastikan tidak ada lagi deklarasi 'let data' di bawah sini
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

    if (message.content === '!coinflip') {
        const hasil = Math.random() < 0.5 ? 'Kepala (Heads)' : 'Ekor (Tails)';
        message.reply(`🪙 Hasil coin flip adalah: **${hasil}**`);
    }
    
    if (message.content.startsWith('!remind')) {
        const args = message.content.split(' ');
        const waktu = parseInt(args[1]);
        const pesan = args.slice(2).join(' ');
        if (!waktu || !pesan) return message.reply('Remind buat apatu?? Contoh: !remind 60 belajar (60 itu 1 menit yah)');
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
        const args = message.content.split(' ');
        const tgl = args[1];

        // Regex untuk memastikan format DD-MM (contoh: 10-05, 01-12)
        const dateRegex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])$/;

        // Pengecekan: kalau tgl kosong ATAU formatnya gak sesuai regex
        if (!tgl || !dateRegex.test(tgl)) {
            return message.reply('❌ Format salah! Gunakan format `DD-MM`. Contoh: `!sethbd 10-05`');
    }

        if (!data.hbd) data.hbd = {};
        data.hbd[message.author.id] = tgl;
        
        await saveData(data);
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

  if (message.content.startsWith('!mocalschanbc') && message.member.permissions.has('Administrator')) {
    // 1. Ambil channel yang ditag
    const targetChannel = message.mentions.channels.first();
    
    // 2. Ambil pesan broadcast (teks setelah tag channel)
    // slice(14) adalah panjang "!mocalschanbc ", kita ambil sisanya
    const broadcastMsg = message.content.slice(14).replace(/<#[0-9]+>/, '').trim();

    if (!targetChannel || !broadcastMsg) {
        return message.reply('Format salah! Contoh: !mocalschanbc #announcement Pesan kamu');
    }

    // 3. Kirim ke channel yang sama ID-nya di semua server
    let successCount = 0;
    client.guilds.cache.forEach(guild => {
        const channel = guild.channels.cache.get(targetChannel.id);
        if (channel) {
            channel.send(`📢 **Broadcast**: ${broadcastMsg}`).catch(console.error);
            successCount++;
        }
    
    });

    message.reply(`✅ Pesan berhasil dibroadcast ke ${successCount} server!`);     
}

    // --- EKONOMI: FONDASI & COMMANDS ---
    if (!data.economy) data.economy = {};

    // !bal (Cek saldo sendiri)
    if (message.content === '!money') {
        const user = data.economy[message.author.id] || { money: 0 };
        message.reply(`💰 Saldo kamu saat ini: **${user.money}**`);
    }

    // !reject (Menolak tantangan duel)
    if (message.content === '!reject') {
        const duel = activeDuels[message.author.id];
        if (!duel) return message.reply('Kamu tidak sedang ditantang!');
        
        delete activeDuels[message.author.id];
        message.channel.send(`🚫 ${message.author} menolak tantangan duel!`);
    }

    // !work
if (message.content === '!work') {
    // Pastikan pakai lastWork
    const user = data.economy[message.author.id] || { money: 0, lastWork: 0 };
    const now = Date.now();
    if (now - user.lastWork < 300000) {
        return message.reply('⏳ Kamu capek! Istirahat dulu 5 menit.');
    }
    
    const reward = Math.floor(Math.random() * 500) + 100;
    user.money += reward;
    user.lastWork = now; 
    data.economy[message.author.id] = user;
    await saveData(data);
    message.reply(`💼 Kamu bekerja dan mendapatkan **${reward}**!`);
}

    // !gamble [jumlah]
    if (message.content.startsWith('!gamble')) {
        const amount = parseInt(message.content.split(' ')[1]);
        const user = data.economy[message.author.id];
        if (!user || user.money < amount) return message.reply('❌ Uang kamu tidak cukup!');
        if (!amount || amount <= 0) return message.reply('Masukkan jumlah yang benar!');

        const win = Math.random() < 0.45;
        if (win) {
            user.money += amount;
            message.reply(`🎰 Menang! Kamu dapat **${amount}**. Saldo: ${user.money}`);
        } else {
            user.money -= amount;
            message.reply(`💸 Kalah! Kamu kehilangan **${amount}**. Saldo: ${user.money}`);
        }
        data.economy[message.author.id] = user;
        await saveData(data);
    }

    // !bit @user [jumlah]
    if (message.content.startsWith('!bit')) {
        const args = message.content.split(' ');
        const lawan = message.mentions.members.first();
        const jumlah = parseInt(args[2]);
        
        if (!lawan || !jumlah) return message.reply('Format: !bit @user [jumlah]');
        if (lawan.id === message.author.id) return message.reply('Gak bisa lawan diri sendiri!');
        
        // Cek apakah lawan sudah punya tantangan lain
        if (activeDuels[lawan.id]) return message.reply('Lawan sedang ditantang orang lain, tunggu ya!');

        activeDuels[lawan.id] = { penantang: message.author.id, jumlah: jumlah };
        message.channel.send(`⚔️ ${lawan}, kamu ditantang oleh ${message.author} sebesar **${jumlah}**! Ketik \`!confirm\` atau \`!reject\` dalam 1 menit.`);

        // Fitur pembatalan otomatis (Timeout 60 detik)
        setTimeout(() => {
            if (activeDuels[lawan.id] && activeDuels[lawan.id].penantang === message.author.id) {
                delete activeDuels[lawan.id];
                message.channel.send(`⏳ Tantangan dari ${message.author} untuk ${lawan} telah dibatalkan karena tidak direspons.`);
            }
        }, 60000); // 60.000 ms = 60 detik
    }

    // !confirm
    if (message.content === '!confirm') {
        const duel = activeDuels[message.author.id];
        if (!duel) return message.reply('Kamu tidak sedang ditantang!');
        const menangId = Math.random() < 0.5 ? message.author.id : duel.penantang;
        const kalahId = menangId === message.author.id ? duel.penantang : message.author.id;
        if (!data.economy[menangId]) data.economy[menangId] = { money: 0 };
        if (!data.economy[kalahId]) data.economy[kalahId] = { money: 0 };
        data.economy[menangId].money += duel.jumlah;
        data.economy[kalahId].money -= duel.jumlah;
        await saveData(data);
        message.channel.send(`🏆 Pertarungan selesai! Pemenangnya adalah <@${menangId}> dan mendapatkan **${duel.jumlah}**!`);
        delete activeDuels[message.author.id];
    }

    // !givecash @user [jumlah]
    if (message.content.startsWith('!givecash')) {
        const penerima = message.mentions.members.first();
        const jumlah = parseInt(message.content.split(' ')[2]);
        if (!penerima || !jumlah) return message.reply('Format: !givecash @user [jumlah]');
        if (!data.economy[message.author.id] || data.economy[message.author.id].money < jumlah) return message.reply('Uang tidak cukup!');
        data.economy[message.author.id].money -= jumlah;
        if (!data.economy[penerima.id]) data.economy[penerima.id] = { money: 0, lastWork: 0 };
        data.economy[penerima.id].money += jumlah;
        await saveData(data);
        message.reply(`✅ Berhasil mengirim ${jumlah} ke ${penerima}!`);
    }

    // !leaderboard
    if (message.content === '!leaderboard') {
        const sorted = Object.entries(data.economy)
            .sort((a, b) => b[1].money - a[1].money)
            .slice(0, 5);
        let text = '🏆 **Top 5 Orang Terkaya**:\n';
        for (let i = 0; i < sorted.length; i++) {
            text += `${i+1}. <@${sorted[i][0]}>: **${sorted[i][1].money}**\n`;
        }
        message.reply(text);
    }
    
});

// --- EVENT JOIN & LEAVE ---

// Event Member Add (Welcome)
client.on('guildMemberAdd', async (member) => { 
    const data = await fetchData(); 
    const serverData = data.serverSettings?.[member.guild.id];
    const welcomeId = serverData ? serverData.welcomeId : null;

    if (welcomeId) {
        const ch = member.guild.channels.cache.get(welcomeId);
        if (ch) {
            ch.send(`Welcome imoet ${member}! ✨`);
        } else {
            console.log(`DEBUG: Channel dengan ID ${welcomeId} tidak ditemukan.`);
        }
    }
});

// Event Member Remove (Leave)
client.on('guildMemberRemove', async (member) => { 
    const data = await fetchData(); 
    const serverData = data.serverSettings?.[member.guild.id];
    const leaveId = serverData ? serverData.leaveId : null;

    if (leaveId) {
        const ch = member.guild.channels.cache.get(leaveId);
        if (ch) {
            ch.send(`Dadah ${member.user.tag}, sampai jumpa lagi! 😢`);
        } else {
            console.log(`DEBUG: Channel dengan ID ${leaveId} untuk leave tidak ditemukan.`);
        }
    }
});

console.log(process.env.DISCORD_TOKEN);
client.login(process.env.DISCORD_TOKEN);
