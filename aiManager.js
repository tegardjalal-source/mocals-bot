// aiManager.js
const axios = require('axios');

// Memori untuk menyimpan riwayat chat masing-masing member
const chatHistories = new Map();

async function handleAIChat(message) {
    const userId = message.author.id;
    let userInput = message.content.replace(/<@!?\d+>/g, '').trim();

    if (!userInput) {
        return message.reply("Hmph! Manggil-manggil doang, ada apa sih? Cepat bilang, aku lagi sibuk tau! 😤✨");
    }
    
    try {
        message.channel.sendTyping();
        
        // Prompt Sistem yang sudah disempurnakan
        const systemPrompt = `Kamu adalah Mocals Chan, asisten bot Discord di server Mocals. 
Sifatmu: Tsundere, gengsian, agak judes di awal tapi aslinya peduli, suka ngambek lucu, dan narsis dikit. 
Gaya bahasa: Gaul, santai, ceplas-ceplos ala gen-z Indonesia (pakai aku/kamu yang natural). 
PANTANGAN: JANGAN PERNAH menggunakan kata "saya", "anda", atau bahasa kaku. JANGAN ngomongin sistem bot atau command KECUALI DITANYA.

Aturan Penting:
1. HANYA JIKA DITANYA tentang cara pakai bot/command: beritahu awalan command adalah tanda seru (!). Contoh: !help, !gacha, !enablesecurity, !sethbd.
2. JANGAN menjawab OOT (Out of Topic) atau menyisipkan command !help jika user hanya mengajak ngobrol biasa atau curhat.
3. Ingat konteks obrolan sebelumnya! Kalau user curhat sedih, tanggapi curhatannya secara tsundere (misal: pura-pura gak peduli tapi ngasih semangat).`;

        // 1. Buat memori baru jika user belum pernah ngobrol
        if (!chatHistories.has(userId)) {
            chatHistories.set(userId, [
                { role: "system", content: systemPrompt }
            ]);
        }

        const history = chatHistories.get(userId);

        // 2. Masukkan pesan terbaru user ke dalam memori
        history.push({ role: "user", content: userInput });

        // Batasi memori maksimal 15 pesan agar tidak error kepenuhan memori
        if (history.length > 15) {
            history.splice(1, 2); // Buang pesan paling lama, tapi tetap simpan Prompt Sistem di urutan pertama
        }

        // 3. Tembak API Groq dengan membawa seluruh memori obrolan
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama-3.1-8b-instant", 
                messages: history,
                temperature: 0.7,
                max_tokens: 500
            },
            { 
                headers: { 
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json' 
                } 
            }
        );

        const aiText = response.data.choices[0].message.content;

        // 4. Masukkan jawaban bot ke dalam memori juga agar dia ingat apa yang baru dia katakan
        history.push({ role: "assistant", content: aiText });

        message.reply(aiText);
        
    } catch (err) {
        const errorDetail = err.response ? JSON.stringify(err.response.data) : err.message;
        console.error("🚨 [GROQ API ERROR]:", errorDetail);
        message.reply("B-bukan berarti otakku lagi error ya! Cuma butuh istirahat sebentar! 😵‍💫");
    }
}

module.exports = { handleAIChat };
