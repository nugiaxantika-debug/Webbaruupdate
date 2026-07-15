const { generateWAMessageFromContent, proto } = require("@whiskeysockets/baileys");

const ctaMsg = {
    viewOnceMessage: {
        message: {
            messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2
            },
            interactiveMessage: proto.Message.InteractiveMessage.create({
                body: proto.Message.InteractiveMessage.Body.create({ text: "Hello" }),
                footer: proto.Message.InteractiveMessage.Footer.create({ text: "Footer" }),
                header: proto.Message.InteractiveMessage.Header.create({ title: "Header", hasMediaAttachment: false }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                    buttons: [
                        {
                            name: "cta_url",
                            buttonParamsJson: JSON.stringify({
                                display_text: "Lihat saluran",
                                url: "https://whatsapp.com/channel/0029VaA2...",
                                merchant_url: "https://whatsapp.com/channel/0029VaA2..."
                            })
                        }
                    ]
                })
            })
        }
    }
};
console.log(JSON.stringify(ctaMsg, null, 2));
