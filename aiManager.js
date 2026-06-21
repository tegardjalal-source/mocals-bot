// aiManager.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Memori untuk menyimpan histori chat per user
const chatHistories = new Map();

async function handleAIChat(message) {
    const userId = message.author.id;
    const userInput = message.content;

    // Ambil histori user, atau buat baru kalau belum ada
    if (!chatHistories.has(userId)) {
        chatHistories.set(userId, model.startChat({
            history: [{
                role: "user",
                parts: [{ text: "Halo, kamu adalah Mocals Chan, asisten yang ceria, suka anime, dan sedikit tsundere. Kamu menemani member di server Discord." }],
            }, {
                role: "model",
                parts: [{ text: "Halo! Aku Mocals Chan, siap menemanimu! Ada yang bisa kubantu hari ini? ✨" }],
            }],
        }));
    }

    const chat = chatHistories.get(userId);
    
    try {
        message.channel.sendTyping(); // Biar kesannya kayak lagi ngetik
        const result = await chat.sendMessage(userInput);
        const response = await result.response;
        const text = response.text();
        
        message.reply(text);
    } catch (err) {
        console.error("AI Error:", err);
        message.reply("Waduh, otakku lagi loading nih, coba lagi sebentar ya! 😵‍💫");
    }
}

module.exports = { handleAIChat };
