// aiManager.js
const axios = require('axios');

async function handleAIChat(message) {
    // 1. Bersihkan tag mention
    let userInput = message.content.replace(/<@!?\d+>/g, '').trim();

    // 2. Cegah error jika pesan kosong
    if (!userInput) {
        return message.reply("Iyaaa? Kenapa manggil-manggil? Ada yang bisa Mocals bantu? ✨");
    }
    
    try {
        message.channel.sendTyping();
        
        // 3. Tembak API Groq menggunakan model Llama-3
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama3-8b-8192", // Model super cepat dan ringan
                messages: [
                    { 
                        role: "system", 
                        content: "Kamu adalah Mocals Chan, asisten virtual tsundere, imut, dan ceria di server Discord Mocals. Jawablah pesan berikut dengan bahasa gaul, santai, dan asik." 
                    },
                    { 
                        role: "user", 
                        content: userInput 
                    }
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

        // 4. Ambil dan kirim balasan
        const aiText = response.data.choices[0].message.content;
        message.reply(aiText);
        
    } catch (err) {
        const errorDetail = err.response ? JSON.stringify(err.response.data) : err.message;
        console.error("🚨 [GROQ API ERROR]:", errorDetail);
        message.reply("Waduh, otak baruku lagi loading nih mang! 😵‍💫");
    }
}

module.exports = { handleAIChat };
