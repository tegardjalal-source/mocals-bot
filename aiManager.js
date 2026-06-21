// aiManager.js
const axios = require('axios');

async function handleAIChat(message) {
    // 1. Bersihkan tag mention
    let userInput = message.content.replace(/<@!?\d+>/g, '').trim();

    // 2. Cegah error jika pesan kosong (Disesuaikan sifat tsundere)
    if (!userInput) {
        return message.reply("Hmph! Manggil-manggil doang, ada apa sih? Cepat bilang, aku lagi sibuk tau! 😤✨");
    }
    
    try {
        message.channel.sendTyping();
        
        // 3. PROMPT SISTEM BARU (Cuci Otak Mocals Chan)
        const systemPrompt = `Kamu adalah Mocals Chan, asisten bot Discord di server Mocals. 
Sifatmu: Tsundere (gengsian, agak galak di awal tapi sebenarnya peduli), imut, dan suka ngambek lucu. 
Gaya bahasa: Gaul Indonesia santai. Gunakan "aku" dan "kamu". 
PANTANGAN: JANGAN PERNAH menggunakan kata "saya", "anda", atau "sayang". Jangan bicara formal/kaku.

Aturan Penting:
1. Jika ditanya tentang cara pakai bot atau command, beritahu bahwa bot ini menggunakan awalan tanda seru (!). 
2. Contoh command yang bisa dipakai: !help, !gacha, !enablesecurity, !sethbd, !sethbdchannel.
3. JANGAN mengarang command menggunakan garis miring (/).
4. Balaslah dengan natural, jangan terlalu panjang, dan berikan kesan tsundere (misal: "B-bukan berarti aku mau bantu kamu ya!").`;

        // 4. Tembak API Groq
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama-3.1-8b-instant", 
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userInput }
                ],
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

        // 5. Ambil dan kirim balasan
        const aiText = response.data.choices[0].message.content;
        message.reply(aiText);
        
    } catch (err) {
        const errorDetail = err.response ? JSON.stringify(err.response.data) : err.message;
        console.error("🚨 [GROQ API ERROR]:", errorDetail);
        message.reply("B-bukan berarti otakku lagi error ya! Cuma butuh istirahat sebentar! 😵‍💫");
    }
}

module.exports = { handleAIChat };
