// aiManager.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inisialisasi API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const chatHistories = new Map();

async function handleAIChat(message) {
    const userId = message.author.id;
    
    // 1. Bersihkan tag mention bot dari pesan biar AI nggak bingung baca angka ID
    let userInput = message.content.replace(/<@!?\d+>/g, '').trim();

    // 2. Cegah error jika user cuma ngetag doang tanpa teks
    if (!userInput) {
        return message.reply("Iyaaa? Kenapa manggil-manggil? Ada yang bisa Mocals bantu? ✨");
    }

    if (!chatHistories.has(userId)) {
        chatHistories.set(userId, model.startChat({
            history: [{
                role: "user",
                parts: [{ text: "Halo, namamu adalah Mocals Chan. Kamu adalah asisten virtual di server Discord Mocals. Jawab dengan gaya bahasa gaul, ceria, santai, dan sedikit tsundere." }],
            }, {
                role: "model",
                parts: [{ text: "Halo! Aku Mocals Chan, siap menemanimu! Ada yang bisa kubantu hari ini? ✨" }],
            }],
        }));
    }

    const chat = chatHistories.get(userId);
    
    try {
        message.channel.sendTyping();
        const result = await chat.sendMessage(userInput);
        const response = await result.response;
        
        message.reply(response.text());
    } catch (err) {
        // Log diubah biar pesan merah di Railway lebih jelas terbaca
        console.error("🚨 [DEBUG AI ERROR]:", err.message || err);
        message.reply("Waduh, otakku lagi loading nih, coba lagi sebentar ya! 😵‍💫");
    }
}

module.exports = { handleAIChat };
