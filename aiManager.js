// aiManager.js
const axios = require('axios');

async function handleAIChat(message) {
    // 1. Bersihkan tag mention dari pesan
    let userInput = message.content.replace(/<@!?\d+>/g, '').trim();

    // 2. Kalau cuma ngetag tanpa ngetik apa-apa
    if (!userInput) {
        return message.reply("Iyaaa? Kenapa manggil-manggil? Ada yang bisa Mocals bantu? ✨");
    }
    
    try {
        message.channel.sendTyping();
        
        // 3. Prompt Sistem Persona
        const promptSystem = "Kamu adalah Mocals Chan, asisten virtual tsundere, imut, dan ceria di server Discord Mocals. Jawablah pesan berikut dengan bahasa gaul, santai, dan singkat:\n\nUser: " + userInput;
        
        // 👇 GANTI BAGIAN URL INI (Gunakan gemini-1.0-pro) 👇
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: promptSystem }] }]
            },
            { 
                headers: { 'Content-Type': 'application/json' } 
            }
        );

        // 5. Ambil jawaban dari Google
        const aiText = response.data.candidates[0].content.parts[0].text;
        
        message.reply(aiText);
        
    } catch (err) {
        // Tangkap error langsung dari mesin Google
        const errorDetail = err.response ? JSON.stringify(err.response.data) : err.message;
        console.error("🚨 [RAW API ERROR]:", errorDetail);
        message.reply("Waduh, koneksi ke Google lagi ngadat nih mang! 😵‍💫");
    }
}

module.exports = { handleAIChat };
