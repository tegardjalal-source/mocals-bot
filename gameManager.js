const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { jalankanGacha } = require('./gachaEngine');

const activeDuels = {}; // Cache khusus untuk sistem duel

function hitungPowerKartu(rarity) {
    const basePower = { 'SSR': 100, 'SR': 70, 'R': 40, 'C': 20 };
    const bonusHoki = Math.floor(Math.random() * 16); 
    return (basePower[rarity] || 20) + bonusHoki;
}

// FUNGSI UTAMA HANDLER GAME
async function handleGameCommands(message, command, args, globalDbCache) {
    const guildId = message.guild.id;

    const gachaTiers = {
        'gacha': { name: 'Normal', price: 500, text: 'bebas apa aja' },
        'gachaluck': { name: 'Luck', price: 3500, text: 'minimal Rare (R)' },
        'gachasuperluck': { name: 'Super Luck', price: 15000, text: 'minimal Super Rare (SR)' },
        'gachamegaluck': { name: 'Mega Luck', price: 75000, text: 'WAJIB Maha-Langka (SSR)' }
    };

    if (gachaTiers[command]) {
        const config = gachaTiers[command];
        const userId = message.author.id;

        if (!globalDbCache.economy) globalDbCache.economy = {};
        if (!globalDbCache.economy[userId]) globalDbCache.economy[userId] = { money: 0, lastWork: 0, cards: [], deck: [] };
        const userWallet = globalDbCache.economy[userId];

        if (userWallet.money < config.price) {
            message.reply(`✖️ Dompet lu kering! Opsy gacha **!${command}** butuh dana hoki sebesar **$${config.price.toLocaleString('id-ID')}**, tabungan lu cuma ada **$${userWallet.money.toLocaleString('id-ID')}**.`);
            return true;
        }

        const loadingMsg = await message.reply(`🔮 Menghubungi bursa MyAnimeList... Menyalakan ritual **${config.name} Roll** (${config.text})...`);

        try {
            const jenisEngine = command === 'gacha' ? 'biasa' : command.replace('gacha', '');
            const hasil = await jalankanGacha(jenisEngine); 

            if (!hasil || !hasil.sukses) {
                loadingMsg.edit(`✖️ Gagal menarik takdir karakter dari MyAnimeList. Saldo lu aman tidak terpotong, coba lagi ya!`);
                return true;
            }

            userWallet.money -= config.price;
            if (!userWallet.cards) userWallet.cards = [];
            
            const sudahPunya = userWallet.cards.find(c => c.id === hasil.id);
            if (sudahPunya) {
                sudahPunya.count = (sudahPunya.count || 1) + 1;
            } else {
                userWallet.cards.push({ id: hasil.id, name: hasil.name, rarity: hasil.rarity, count: 1 });
            }

            const warnaRarity = { 'SSR': '#ff0055', 'SR': '#ffaa00', 'R': '#00aaff', 'C': '#aaaaaa' };
            const cardEmbed = new EmbedBuilder()
                .setTitle(`🎉 GACHA BERHASIL! [${hasil.rarity}]`)
                .setDescription(`<@${userId}> sukses memanggil karakter dari ritual **${config.name} Gacha**!`)
                .addFields(
                    { name: 'Nama Karakter', value: `**${hasil.name}**`, inline: true },
                    { name: 'Rarity', value: `✨ **${hasil.rarity}**`, inline: true },
                    { name: '🆔 ID MAL Karakter', value: `\`${hasil.id}\``, inline: true },
                    { name: '❤️ Total Penggemar', value: `👤 **${(hasil.malRank || 0).toLocaleString('id-ID')} User**`, inline: true },
                    { name: 'Sisa Uangmu', value: `💰 **$${userWallet.money.toLocaleString('id-ID')}**`, inline: false }
                )
                .setImage(hasil.image)
                .setColor(warnaRarity[hasil.rarity] || '#ffffff')
                .setURL(hasil.url)
                .setFooter({ text: "Mocals Chan Multi-Luck Gacha Engine • Powered by MyAnimeList" });

            loadingMsg.edit({ content: "✨ Takdir waifu/husbando hoki lu telah mendarat! ✨", embeds: [cardEmbed] });
        } catch (error) {
            console.error("Error Core Gacha:", error);
            loadingMsg.edit("✖️ Terjadi kesalahan teknis internal dalam memproses transaksi gacha server.");
        }
        return true;
    }

    if (command === 'setdeck') {
        const cardId = parseInt(args[0]);
        const userId = message.author.id;

        if (!cardId) { message.reply('✖️ Format salah! Gunakan: `!setdeck [ID_MAL]`\nContoh: `!setdeck 21`'); return true; }

        if (!globalDbCache.economy) globalDbCache.economy = {};
        if (!globalDbCache.economy[userId]) globalDbCache.economy[userId] = { money: 0, cards: [], deck: [] };
        const userWallet = globalDbCache.economy[userId];
        if (!userWallet.deck) userWallet.deck = [];

        const punyaKartu = userWallet.cards.find(c => c.id === cardId);
        if (!punyaKartu) { message.reply('✖️ Lu kagak punya kartu karakter dengan ID MAL tersebut di album lu!'); return true; }

        if (userWallet.deck.includes(cardId)) {
            userWallet.deck = userWallet.deck.filter(id => id !== cardId);
            message.reply(`✅ Kartu **${punyaKartu.name}** berhasil dilepas dari deck aktif lu.`);
            return true;
        }

        if (userWallet.deck.length >= 3) {
            message.reply('✖️ Deck lu penuh! Maksimal cuma boleh bawa **3 kartu**. Lepas salah satu kartu dulu lewat `!setdeck [ID]` baru pasang yang baru.');
            return true;
        }

        userWallet.deck.push(cardId);
        message.reply(`✅ **${punyaKartu.name}** [${punyaKartu.rarity}] berhasil dipasang ke deck tempur lu! (${userWallet.deck.length}/3)`);
        return true;
    }

    if (command === 'deck') {
        const userId = message.author.id;
        const userWallet = globalDbCache.economy?.[userId];
        const activeDeck = userWallet?.deck || [];

        if (activeDeck.length === 0) {
            message.reply('📭 Deck aktif lu masih kosong melompong. Pasang waifu/husbando andalan lu pake perintah `!setdeck [ID_MAL]`!');
            return true;
        }

        let deckText = `🃏 **DECK TEMPUR AKTIF LU (${activeDeck.length}/3)** 🃏\n\n`;
        let totalBasePower = 0;

        activeDeck.forEach((id, index) => {
            const rincianKartu = userWallet.cards.find(c => c.id === id);
            if (rincianKartu) {
                deckText += `**${index + 1}. ${rincianKartu.name}** [\`${rincianKartu.rarity}\`] *(ID: \`${id}\`)*\n`;
                totalBasePower += rincianKartu.rarity === 'SSR' ? 100 : rincianKartu.rarity === 'SR' ? 70 : rincianKartu.rarity === 'R' ? 40 : 20;
            }
        });

        const deckEmbed = new EmbedBuilder()
            .setColor('#00ffbb')
            .setTitle(`⚔️ Strategi Deck: ${message.author.username}`)
            .setDescription(deckText + `\n📈 *Estimasi Base Power Deck: **${totalBasePower} PT***`)
            .setFooter({ text: 'Ketik !setdeck [ID_MAL] pada kartu yang sama untuk mencopotnya.' });

        message.reply({ embeds: [deckEmbed] });
        return true;
    }

    if (command === 'sellcard') {
        const cardId = parseInt(args[0]);
        const hargaJual = parseInt(args[1]);
        const userId = message.author.id;

        if (!cardId || isNaN(hargaJual) || hargaJual <= 0) {
            message.reply('✖️ Format salah! Gunakan: `!sellcard [ID_MAL] [Harga]`\nContoh: `!sellcard 31254 1500`'); return true;
        }

        if (!globalDbCache.economy) globalDbCache.economy = {};
        if (!globalDbCache.economy[userId]) globalDbCache.economy[userId] = { money: 0, cards: [] };
        const userWallet = globalDbCache.economy[userId];

        if (!userWallet.cards || userWallet.cards.length === 0) {
            message.reply('✖️ Lu belum punya kartu karakter sama sekali untuk dijual.'); return true;
        }

        const indexKartu = userWallet.cards.findIndex(c => c.id === cardId);
        if (indexKartu === -1) {
            message.reply('✖️ Kartu dengan ID MAL tersebut gak ada di inventori lu.'); return true;
        }

        const kartu = userWallet.cards[indexKartu];

        if (kartu.count > 1) {
            kartu.count -= 1;
        } else {
            userWallet.cards.splice(indexKartu, 1);
        }

        if (!globalDbCache.market) globalDbCache.market = [];
        const listingId = Date.now().toString().slice(-6); 

        globalDbCache.market.push({ listingId: listingId, sellerId: userId, sellerName: message.author.username, id: kartu.id, name: kartu.name, rarity: kartu.rarity, price: hargaJual });

        const sellEmbed = new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('🛒 KARTU BERHASIL DIPASARKAN!')
            .setDescription(`<@${userId}> memasang kartu ke toko market bursa!`)
            .addFields(
                { name: '📦 Nama Karakter', value: `**${kartu.name}** (${kartu.rarity})`, inline: true },
                { name: '🆔 ID MAL Karakter', value: `\`${kartu.id}\``, inline: true },
                { name: '🎫 Kode Listing Toko', value: `\`${listingId}\``, inline: true },
                { name: '💰 Value Harga', value: `**$${hargaJual}**`, inline: false }
            )
            .setFooter({ text: 'Gunakan "!buycard [Kode_Listing]" untuk membeli kartu ini!' });

        message.reply({ embeds: [sellEmbed] });
        return true;
    }

    if (command === 'marketlist') {
        if (!globalDbCache.market || globalDbCache.market.length === 0) {
            message.reply('📭 Bursa pasar kartu saat ini lagi kosong melompong. Belum ada yang jualan nih!'); return true;
        }
        let marketText = '';
        globalDbCache.market.forEach((item, index) => {
            marketText += `**${index + 1}. ${item.name}** [${item.rarity}]\n┣ 🆔 ID MAL: \`${item.id}\`\n┣ 👤 Penjual: <@${item.sellerId}>\n┣ 💰 Harga: **$${item.price.toLocaleString('id-ID')}**\n┗ 🎫 Kode Beli: \`!buycard ${item.listingId}\`\n\n`;
        });
        if (marketText.length > 3900) { marketText = marketText.substring(0, 3850) + '\n*...dan beberapa kartu lainnya tidak termuat karena bursa pasar terlalu penuh!*'; }

        const marketListEmbed = new EmbedBuilder().setColor('#ffaa00').setTitle('🛒 BURSA PASAR KARTU ANIME (FOR SALE)').setDescription(marketText).setTimestamp().setFooter({ text: 'Mocals Chan Marketplace • Segera borong waifu idamanmu! ✨' });
        message.reply({ embeds: [marketListEmbed] });
        return true;
    }

    if (command === 'buycard') {
        const listingId = args[0];
        const buyerId = message.author.id;
        if (!listingId) { message.reply('✖️ Masukkan kode listing toko! Format: `!buycard [Kode_Listing]`'); return true; }
        if (!globalDbCache.market || globalDbCache.market.length === 0) { message.reply('✖️ Bursa pasar kartu saat ini lagi kosong.'); return true; }
        
        const marketIndex = globalDbCache.market.findIndex(item => item.listingId === listingId);
        if (marketIndex === -1) { message.reply('✖️ Kode listing toko tidak ditemukan atau kartu sudah laku terjual.'); return true; }
        const itemGacha = globalDbCache.market[marketIndex];
        if (itemGacha.sellerId === buyerId) { message.reply('✖️ Lu gak bisa beli kartu bikinan lu sendiri kocak!'); return true; }

        if (!globalDbCache.economy) globalDbCache.economy = {};
        if (!globalDbCache.economy[buyerId]) globalDbCache.economy[buyerId] = { money: 0, cards: [] };
        const buyerWallet = globalDbCache.economy[buyerId];

        if (buyerWallet.money < itemGacha.price) { message.reply(`✖️ Duit lu kurang! Harga kartu ini **$${itemGacha.price}**, tabungan lu cuma **$${buyerWallet.money}**.`); return true; }

        buyerWallet.money -= itemGacha.price;
        if (!globalDbCache.economy[itemGacha.sellerId]) globalDbCache.economy[itemGacha.sellerId] = { money: 0, cards: [] };
        globalDbCache.economy[itemGacha.sellerId].money += itemGacha.price;

        if (!buyerWallet.cards) buyerWallet.cards = [];
        const sudahPunya = buyerWallet.cards.find(c => c.id === itemGacha.id);
        if (sudahPunya) { sudahPunya.count = (sudahPunya.count || 1) + 1; } else { buyerWallet.cards.push({ id: itemGacha.id, name: itemGacha.name, rarity: itemGacha.rarity, count: 1 }); }

        globalDbCache.market.splice(marketIndex, 1);
        const buyEmbed = new EmbedBuilder().setColor('#00ff55').setTitle('🤝 TRANSAKSI MARKET BERHASIL!').setDescription(`<@${buyerId}> telah membeli kartu milik **${itemGacha.sellerName}**!`)
            .addFields({ name: '🛒 Karakter Dibeli', value: `**${itemGacha.name}** [${itemGacha.rarity}]`, inline: true }, { name: '💸 Dana Terpotong', value: `**$${itemGacha.price}**`, inline: true }, { name: '💰 Sisa Uangmu', value: `**$${buyerWallet.money}**`, inline: false });
        message.reply({ embeds: [buyEmbed] });
        return true;
    }

    if (command === 'buybm') {
        const listingId = args[0];
        const buyerId = message.author.id;
        if (!listingId) { message.reply('✖️ Masukkan kode listing pasar gelap! Format: `!buybm [Kode_Listing]`'); return true; }
        if (!globalDbCache.blackMarketServers || !globalDbCache.blackMarketServers[guildId] || globalDbCache.blackMarketServers[guildId].length === 0) { message.reply('✖️ Penyelundup sedang bersembunyi. Black Market kosong saat ini.'); return true; }

        const bmIndex = globalDbCache.blackMarketServers[guildId].findIndex(item => item.listingId === listingId);
        if (bmIndex === -1) { message.reply('✖️ Kode listing pasar gelap salah atau kartu tersebut sudah diborong orang lain!'); return true; }
        const itemBM = globalDbCache.blackMarketServers[guildId][bmIndex];

        if (!globalDbCache.economy) globalDbCache.economy = {};
        if (!globalDbCache.economy[buyerId]) globalDbCache.economy[buyerId] = { money: 0, cards: [] };
        const buyerWallet = globalDbCache.economy[buyerId];

        if (buyerWallet.money < itemBM.price) { message.reply(`✖️ Duit haram lu kurang! Harganya **$${itemBM.price}**, dompet lu cuma ada **$${buyerWallet.money}**.`); return true; }

        buyerWallet.money -= itemBM.price;
        if (!buyerWallet.cards) buyerWallet.cards = [];
        const sudahPunya = buyerWallet.cards.find(c => c.id === itemBM.id);
        if (sudahPunya) { sudahPunya.count = (sudahPunya.count || 1) + 1; } else { buyerWallet.cards.push({ id: itemBM.id, name: itemBM.name, rarity: itemBM.rarity, count: 1 }); }

        globalDbCache.blackMarketServers[guildId].splice(bmIndex, 1);
        const bmBuyEmbed = new EmbedBuilder().setColor('#1a1a1a').setTitle('🕵️‍♂️ TRANSAKSI GELAP SELESAI!').setDescription(`<@${buyerId}> berhasil menyelundupkan kartu dari Black Market secara ilegal!`)
            .addFields({ name: '📦 Kartu Selundupan', value: `**${itemBM.name}** [${itemBM.rarity}]`, inline: true }, { name: '💸 Dana Terpotong', value: `**$${itemBM.price}**`, inline: true }, { name: '💰 Sisa Uangmu', value: `**$${buyerWallet.money}**`, inline: false });
        message.reply({ embeds: [bmBuyEmbed] });
        return true;
    }

    if (command === 'testbm') {
        if (!message.member.permissions.has('Administrator')) { message.reply('✖️ Perintah ini rahasia! Hanya bisa digunakan oleh **Administrator** server.'); return true; }
        const loadingBM = await message.reply("⏳ Menghubungi pasar gelap... Sedang menyelundupkan 6 barang baru dari MyAnimeList...");
        
        if (!globalDbCache.blackMarketServers) globalDbCache.blackMarketServers = {};
        globalDbCache.blackMarketServers[guildId] = [];
        for (let i = 0; i < 5; i++) {
            const kartu = await jalankanGacha('biasa'); 
            if (kartu && kartu.sukses) {
                globalDbCache.blackMarketServers[guildId].push({ listingId: `BM-${Math.floor(1000 + Math.random() * 9000)}`, id: kartu.id, name: kartu.name, rarity: kartu.rarity, price: Math.floor(Math.random() * 900) + 300, isPremium: false });
            }
            await new Promise(resolve => setTimeout(resolve, 1300));
        }

        const kartuSpesial = await jalankanGacha('megaluck'); 
        if (kartuSpesial && kartuSpesial.sukses) {
            globalDbCache.blackMarketServers[guildId].push({ listingId: `BM-PREM`, id: kartuSpesial.id, name: kartuSpesial.name, rarity: kartuSpesial.rarity, price: Math.floor(Math.random() * 2000) + 1500, isPremium: true });
        }

        const targetChannelId = globalDbCache.serverSettings?.[guildId]?.bmChannelId;
        const destChannel = targetChannelId ? (message.guild.channels.cache.get(targetChannelId) || await message.guild.channels.fetch(targetChannelId).catch(() => message.channel)) : message.channel;

        let bmText = '🚨 **BLACK MARKET TELAH DI-RESET! (TEST MODE)** 🚨\n*Penyelundup kartu ilegal telah datang membawa barang dagangan baru:*\n\n';
        globalDbCache.blackMarketServers[guildId].forEach((item) => {
            bmText += item.isPremium ? `🔥 **[PREMIUM ITEM] ${item.name}** [${item.rarity}]\n` : `📦 **${item.name}** [${item.rarity}]\n`;
            bmText += `┣ 💰 Harga Ilegal: **$${item.price}**\n┗ 🎫 Perintah Beli: \`!buybm ${item.listingId}\`\n\n`;
        });

        const bmEmbed = new EmbedBuilder().setColor('#2f3136').setTitle('🕵️‍♂️ BURSA RAHASIA: BLACK MARKET KARTU').setDescription(bmText).setTimestamp();
        await loadingBM.delete().catch(() => null);
        destChannel.send({ content: "@everyone 🛡️ **[SIMULASI] Lapak bursa rahasia Black Market berhasil dibuka secara paksa!**", embeds: [bmEmbed] });
        return true;
    }

    if (command === 'topcollector') {
        if (!globalDbCache.economy) globalDbCache.economy = {};
        const rarityOrder = { 'SSR': 1, 'SR': 2, 'R': 3, 'C': 4 };

        const listCollector = Object.entries(globalDbCache.economy).map(([id, profile]) => {
                let totalKartu = 0, top5Cards = [];
                if (profile.cards && Array.isArray(profile.cards)) {
                    totalKartu = profile.cards.reduce((acc, curr) => acc + (curr.count || 1), 0);
                    top5Cards = [...profile.cards].sort((a, b) => (rarityOrder[a.rarity] || 5) - (rarityOrder[b.rarity] || 5)).slice(0, 5);
                }
                return { userId: id, total: totalKartu, top5: top5Cards };
            }).filter(u => u.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);

        if (listCollector.length === 0) { message.reply('📭 Belum ada kolektor kartu anime di server ini.'); return true; }

        let descriptionText = '';
        const trophy = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅', '🏅', '🏅', '🏅', '🏅'];

        listCollector.forEach((user, index) => {
            const topCardsText = user.top5.map(c => `**${c.name}** (\`${c.rarity}\`)`).join(', ');
            descriptionText += `${trophy[index]} **Peringkat ${index + 1}** • <@${user.userId}>\n┣ Total Koleksi: **${user.total} Kartu**\n┗ **Top 5**: ${topCardsText || 'Belum memiliki koleksi'}\n\n`;
        });

        const collectorEmbed = new EmbedBuilder().setColor('#00aaff').setTitle('🏆 HALL OF FAME: TOP 10 ANIME CARD COLLECTORS').setDescription(descriptionText).setTimestamp().setFooter({ text: 'Mocals Chan Gacha League • Terus kumpulkan waifumu! ✨' });
        message.reply({ embeds: [collectorEmbed] });
        return true;
    }

    if (command === 'collection') {
        const targetMember = message.mentions.members.first() || message.member;
        if (!globalDbCache.economy) globalDbCache.economy = {};
        const targetWallet = globalDbCache.economy[targetMember.id];

        if (!targetWallet || !targetWallet.cards || targetWallet.cards.length === 0) { message.reply(`📭 ${targetMember.user.username} belum memiliki koleksi kartu karakter anime sama sekali.`); return true; }

        const rarityOrder = { 'SSR': 1, 'SR': 2, 'R': 3, 'C': 4 };
        const sortedCards = [...targetWallet.cards].sort((a, b) => (rarityOrder[a.rarity] || 5) - (rarityOrder[b.rarity] || 5));

        let collectionText = '';
        sortedCards.forEach((kartu, index) => { collectionText += `**${index + 1}. ${kartu.name}** • \`${kartu.rarity}\` • x${kartu.count || 1} *(ID: \`${kartu.id}\`)*\n`; });
        if (collectionText.length > 3900) { collectionText = collectionText.substring(0, 3850) + '\n*...dan beberapa kartu lainnya tidak termuat karena lemari koleksi penuh!*'; }

        const collectionEmbed = new EmbedBuilder().setColor('#00ffbb').setTitle(`🗂️ Album Koleksi Anime: ${targetMember.user.username}`).setDescription(collectionText).setThumbnail(targetMember.user.displayAvatarURL()).setTimestamp().setFooter({ text: `Mocals Chan Album League • Diminta oleh ${message.author.username}` });
        message.reply({ embeds: [collectionEmbed] });
        return true;
    }

    if (command === 'charinfo') {
        const charName = args.join(' ');
        if (!charName) { message.reply('✖️ Format salah! Gunakan: `!charinfo [Nama Karakter]`\nContoh: `!charinfo Lelouch Lamperouge`'); return true; }
        const loadingMsg = await message.reply('🔍 Sedang mengontak database MyAnimeList... Mohon tunggu...');

        try {
            const response = await axios.get(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(charName)}&limit=1`);
            const charData = response.data?.data?.[0];
            if (!charData) { loadingMsg.edit(`✖️ Karakter dengan nama **${charName}** gagal ditemukan di MyAnimeList.`); return true; }

            const name = charData.name, kanjiName = charData.name_kanji ? ` (${charData.name_kanji})` : '', url = charData.url;
            const imageUrl = charData.images?.jpg?.image_url || 'https://i.imgur.com/8N7V0w9.png';
            const favorites = charData.favorites ? charData.favorites.toLocaleString('id-ID') : '0';
            
            let about = charData.about || 'Tidak ada info biografi tertulis tentang karakter ini.';
            if (about.length > 1800) { about = about.substring(0, 1795) + '... *(baca selengkapnya di situs MAL)*'; }

            const charEmbed = new EmbedBuilder().setColor('#ff69b4').setTitle(`👤 Profil Karakter: ${name}${kanjiName}`).setURL(url).setDescription(about).setThumbnail(imageUrl).addFields({ name: '🆔 ID MAL Karakter', value: `\`${charData.mal_id}\``, inline: true }, { name: '❤️ Total Penggemar', value: `👤 **${favorites} User**`, inline: true }).setTimestamp().setFooter({ text: 'Mocals Chan Database Wiki • Powered by MyAnimeList' });
            loadingMsg.edit({ content: '✨ Data karakter berhasil ditemukan! ✨', embeds: [charEmbed] });
        } catch (error) {
            console.error('Error nyari charinfo MAL:', error.message);
            if (error.response && error.response.status === 429) { loadingMsg.edit('✖️ Server MyAnimeList sedang membatasi permintaan (Rate Limit). Sembari menunggu cooldown, silakan coba lagi beberapa saat lagi!'); return true; }
            loadingMsg.edit('✖️ Terjadi gangguan koneksi internet saat menghubungi server MyAnimeList.');
        }
        return true;
    }

    if (command === 'money') {
        if (!globalDbCache.economy) globalDbCache.economy = {};
        const user = globalDbCache.economy[message.author.id] || { money: 0 };
        message.reply(`💰 Saldo kamu saat ini: **$${(user.money || 0).toLocaleString('id-ID')}**`);
        return true;
    }

    if (command === 'reject') {
        const duel = activeDuels[message.author.id];
        if (!duel) { message.reply('Kamu tidak sedang ditantang!'); return true; }
        
        if (globalDbCache.economy[duel.penantang]) { globalDbCache.economy[duel.penantang].money += duel.jumlah; }
        delete activeDuels[message.author.id];
        message.channel.send(`🚫 ${message.author} menolak tantangan duel!`);
        return true;
    }

    if (command === 'work') {
        if (!globalDbCache.economy) globalDbCache.economy = {};
        if (!globalDbCache.economy[message.author.id]) globalDbCache.economy[message.author.id] = { money: 0, lastWork: 0, cards: [], deck: [] };
        const user = globalDbCache.economy[message.author.id];
        const now = Date.now();
        
        if (now - (user.lastWork || 0) < 300000) { message.reply('⏳ Kamu capek! Istirahat dulu 5 menit.'); return true; }
        
        const reward = Math.floor(Math.random() * 500) + 100;
        user.money = (user.money || 0) + reward;
        user.lastWork = now; 
        globalDbCache.economy[message.author.id] = user;
        message.reply(`💼 Kamu bekerja dan mendapatkan **$${reward}**!`);
        return true;
    }

    if (command === 'gamble') {
        const amount = parseInt(args[0]);
        if (!globalDbCache.economy) globalDbCache.economy = {};
        if (!globalDbCache.economy[message.author.id]) globalDbCache.economy[message.author.id] = { money: 0, lastWork: 0, cards: [], deck: [] };
        const user = globalDbCache.economy[message.author.id];
        
        if (!amount || amount <= 0 || isNaN(amount)) { message.reply('Masukkan jumlah taruhan yang benar!'); return true; }
        if (user.money < amount) { message.reply('❌ Uang kamu tidak cukup!'); return true; }

        const win = Math.random() < 0.45;
        if (win) {
            user.money += amount;
            message.reply(`🎰 Menang! Kamu dapat **$${amount}**. Saldo: $${user.money}`);
        } else {
            user.money -= amount;
            message.reply(`💸 Kalah! Kamu kehilangan **$${amount}**. Saldo: $${user.money}`);
        }
        globalDbCache.economy[message.author.id] = user;
        return true;
    }

    if (command === 'givecash') {
        const penerima = message.mentions.members.first();
        const jumlah = parseInt(args[1]);
        if (!penerima || !jumlah || jumlah <= 0 || isNaN(jumlah)) { message.reply('Format: !givecash @user [jumlah]'); return true; }
        if (!globalDbCache.economy) globalDbCache.economy = {};
        if (!globalDbCache.economy[message.author.id] || globalDbCache.economy[message.author.id].money < jumlah) { message.reply('Uang tidak cukup!'); return true; }
        
        globalDbCache.economy[message.author.id].money -= jumlah;
        if (!globalDbCache.economy[penerima.id]) globalDbCache.economy[penerima.id] = { money: 0, lastWork: 0, cards: [], deck: [] };
        globalDbCache.economy[penerima.id].money += jumlah;
        message.reply(`✅ Berhasil mengirim ${jumlah} ke ${penerima}!`);
        return true;
    }

    if (command === 'leaderboard') {
        if (!globalDbCache.economy) globalDbCache.economy = {};
        const sorted = Object.entries(globalDbCache.economy).sort((a, b) => (b[1].money || 0) - (a[1].money || 0)).slice(0, 5);
        let text = '🏆 **Top 5 Orang Terkaya**:\n';
        for (let i = 0; i < sorted.length; i++) { text += `${i+1}. <@${sorted[i][0]}>: **$${(sorted[i][1].money || 0).toLocaleString('id-ID')}**\n`; }
        message.reply(text);
        return true;
    }

    if (command === 'duel') {
        const lawan = message.mentions.members.first();
        if (!lawan) { message.reply('Tag dulu lawanmu!'); return true; }
        if (lawan.user.bot) { message.reply('Bot tidak bisa diajak duel! 🤖'); return true; }
        if (lawan.id === message.author.id) { message.reply('Masa duel sama diri sendiri? 😅'); return true; }

        const deckPenantang = globalDbCache.economy?.[message.author.id]?.deck || [];
        if (deckPenantang.length === 0) { message.reply('✖️ Lu belum nyusun deck tempur lu! Atur dulu waifu andalan lu pake \`!setdeck [ID]\`.'); return true; }

        const deckLawan = globalDbCache.economy?.[lawan.id]?.deck || [];
        if (deckLawan.length === 0) { message.reply(`✖️ Gak bisa ditantang! <@${lawan.id}> belum menyusun deck aktifnya.`); return true; }

        let powerPenantang = 0, powerLawan = 0;
        deckPenantang.forEach(id => { const k = globalDbCache.economy[message.author.id].cards.find(c => c.id === id); if (k) powerPenantang += hitungPowerKartu(k.rarity); });
        deckLawan.forEach(id => { const k = globalDbCache.economy[lawan.id].cards.find(c => c.id === id); if (k) powerLawan += hitungPowerKartu(k.rarity); });

        const pemenang = powerPenantang > powerLawan ? message.author.username : lawan.user.username;
        const pecundang = pemenang === message.author.username ? lawan.user.username : message.author.username;

        message.channel.send(`⚔️ **${message.author.username}** menantang **${lawan.user.username}** untuk adu formasi deck kartu!`);
        setTimeout(() => message.channel.send(`💥 *JLEB! Efek sinergi bertubrukan, angka kalkulator perang bergulir...*`), 1500);
        setTimeout(() => { message.channel.send(`🏆 **Hasil Pertandingan Album:**\n┣ 📊 Power Deck **${message.author.username}**: \`${powerPenantang} PT\`\n┣ 📊 Power Deck **${lawan.user.username}**: \`${powerLawan} PT\`\n\n👑 Selamat **${pemenang}** berhasil menggilas formasi deck milik **${pecundang}**!`); }, 3500);
        return true;
    }

    if (command === 'bit') {
        const lawan = message.mentions.members.first();
        const jumlah = parseInt(args[1]);
        
        if (!lawan || !jumlah || jumlah <= 0 || isNaN(jumlah)) { message.reply('Format: !bit @user [jumlah_taruhan]'); return true; }
        if (lawan.id === message.author.id) { message.reply('Gak bisa lawan diri sendiri!'); return true; }

        const deckPenantang = globalDbCache.economy?.[message.author.id]?.deck || [];
        if (deckPenantang.length === 0) { message.reply('✖️ Deck lu kosong! Pasang kartu andalan dulu pake \`!setdeck [ID]\`.'); return true; }

        const deckLawan = globalDbCache.economy?.[lawan.id]?.deck || [];
        if (deckLawan.length === 0) { message.reply(`✖️ <@${lawan.id}> belum menyusun deck aktifnya, tidak bisa diajak judi bit.`); return true; }

        if ((globalDbCache.economy[message.author.id]?.money || 0) < jumlah) { message.reply('✖️ Saldo dompet lu kagak cukup buat naruh taruhan segitu!'); return true; }
        if ((globalDbCache.economy[lawan.id]?.money || 0) < jumlah) { message.reply('✖️ Saldo musuh lu gak cukup buat ngelayanin taruhan segitu!'); return true; }

        if (activeDuels[lawan.id]) { message.reply('Lawan sedang ditantang orang lain, tunggu ya!'); return true; }

        globalDbCache.economy[message.author.id].money -= jumlah;
        activeDuels[lawan.id] = { penantang: message.author.id, jumlah: jumlah };
        message.channel.send(`⚔️ ${lawan}, kamu ditantang oleh ${message.author} bertaruh judi deck sebesar **$${jumlah}**! Ketik \`!confirm\` atau \`!reject\` dalam 1 menit.`);
        
        setTimeout(() => {
            if (activeDuels[lawan.id] && activeDuels[lawan.id].penantang === message.author.id) {
                if (globalDbCache.economy[message.author.id]) globalDbCache.economy[message.author.id].money += jumlah;
                delete activeDuels[lawan.id];
                message.channel.send(`⏳ Tantangan taruhan dari ${message.author} untuk ${lawan} kedaluwarsa.`);
            }
        }, 60000);
        return true;
    }

    if (command === 'confirm') {
        const duel = activeDuels[message.author.id];
        if (!duel) { message.reply('Kamu tidak sedang ditantang!'); return true; }
        
        const idLawan = message.author.id; 
        const idPenantang = duel.penantang; 

        if ((globalDbCache.economy[idLawan]?.money || 0) < duel.jumlah) {
            globalDbCache.economy[idPenantang].money += duel.jumlah;
            delete activeDuels[message.author.id];
            message.channel.send('✖️ Pertarungan dibatalkan karena saldo penantang/lawan tidak mencukupi saat laga dimulai.');
            return true;
        }

        globalDbCache.economy[idLawan].money -= duel.jumlah;

        const deckLawan = globalDbCache.economy?.[idLawan]?.deck || [];
        const deckPenantang = globalDbCache.economy?.[idPenantang]?.deck || [];

        let powerPenantang = 0, powerLawan = 0;
        deckPenantang.forEach(id => { const k = globalDbCache.economy[idPenantang].cards.find(c => c.id === id); if (k) powerPenantang += hitungPowerKartu(k.rarity); });
        deckLawan.forEach(id => { const k = globalDbCache.economy[idLawan].cards.find(c => c.id === id); if (k) powerLawan += hitungPowerKartu(k.rarity); });

        const menangId = powerPenantang > powerLawan ? idPenantang : idLawan;
        const kalahId = menangId === idLawan ? idPenantang : idLawan;

        globalDbCache.economy[menangId].money += (duel.jumlah * 2);

        let battleText = `🏆 **JUDI BIT DECK KARTU SELESAI!** 🏆\n\n⚔️ **Deck Penantang (<@${idPenantang}>)**: Total Power \`${powerPenantang} PT\`\n🛡️ **Deck Lawan (<@${idLawan}>)**: Total Power \`${powerLawan} PT\`\n\n👑 Selamat untuk <@${menangId}> karena formasi deck lu menang unggul dan berhak membawa pulang total hadiah **$${duel.jumlah * 2}**!`;

        message.channel.send(battleText);
        delete activeDuels[message.author.id];
        return true;
    }

    return false; // Return false jika command tidak ditemukan di dalam gameManager
}

module.exports = { handleGameCommands };
