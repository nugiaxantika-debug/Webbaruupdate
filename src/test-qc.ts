import axios from 'axios';

async function testQc() {
  try {
    const payload = {
        type: "quote",
        format: "png",
        backgroundColor: "#1b1429",
        width: 512,
        height: 768,
        scale: 2,
        messages: [{
            entities: [],
            avatar: true,
            from: {
                id: 1,
                name: "John",
                photo: {
                    url: "https://i.pravatar.cc/300"
                }
            },
            text: "Hello World",
            replyMessage: {}
        }]
    };
    
    const res = await axios.post("https://bot.lyo.su/quote/generate", payload);
    console.log("Success?", res.status, typeof res.data.result.image, typeof res.data.result);
  } catch (e: any) {
    console.error("Failed:", e.message);
  }
}
testQc();
