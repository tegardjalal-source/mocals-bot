// aiManager.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inisialisasi API dengan Key dari environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Menggunakan model "gemini-pro" yang kompatibel secara luas
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

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
        message.channel.sendTyping(); // Memberi kesan bot sedang mengetik
        const result = await chat.sendMessage(userInput);
        const response = await result.response;
        const text = response.text();
        
        message.reply(text);
    } catch (err) {
        // Menampilkan detail error di log untuk mempermudah diagnosa
        console.error("DEBUG ERROR GEMINI:", JSON.stringify(err, null, 2));
        message.reply("Waduh, otakku lagi loading nih, coba lagi sebentar ya! 😵‍💫");
    }
}

module.exports = { handleAIChat };
