const fs = require('fs');

let c = fs.readFileSync('src/services/whatsapp.ts', 'utf8');

const oldAllMenu = `      if (this.channelLink) {
        const { generateWAMessageFromContent, proto, generateWAMessage } = await import('@whiskeysockets/baileys');
        let imageMessage;
        if (this.coverImageBuffer) {
           const mediaMsg = await generateWAMessage(jid, { image: this.coverImageBuffer }, { userJid: this.sock.user.id, upload: this.sock.waUploadToServer });
           imageMessage = mediaMsg.message?.imageMessage;
        }
        const ctaMsg = {
            viewOnceMessage: {
                message: {
                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                    interactiveMessage: proto.Message.InteractiveMessage.create({
                        body: proto.Message.InteractiveMessage.Body.create({ text: menu }),
                        footer: proto.Message.InteractiveMessage.Footer.create({ text: " " }),
                        header: proto.Message.InteractiveMessage.Header.create({ hasMediaAttachment: !!imageMessage, imageMessage: imageMessage }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                            buttons: [{
                                name: "cta_url",
                                buttonParamsJson: JSON.stringify({ display_text: "Lihat saluran", url: this.channelLink, merchant_url: this.channelLink })
                            }]
                        })
                    })
                }
            }
        };
        const generatedMsg = generateWAMessageFromContent(jid, ctaMsg, { userJid: this.sock.user.id });
        await this.sock.relayMessage(jid, generatedMsg.message, { messageId: generatedMsg.key.id });
      } else {
        if (this.coverImageBuffer) {
          await this.sock.sendMessage(jid, { image: this.coverImageBuffer, caption: menu }, { quoted: msg });
        } else {
          await this.sock.sendMessage(jid, { text: menu }, { quoted: msg });
        }
      }`;

const newAllMenu = `      if (this.channelLink) {
        try {
          const { generateWAMessageFromContent, proto, generateWAMessage } = await import('@whiskeysockets/baileys');
          let imageMessage;
          if (this.coverImageBuffer) {
             const mediaMsg = await generateWAMessage(jid, { image: this.coverImageBuffer }, { userJid: this.sock.user.id, upload: this.sock.waUploadToServer });
             imageMessage = mediaMsg.message?.imageMessage;
          }
          const ctaMsg = {
              viewOnceMessage: {
                  message: {
                      messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                      interactiveMessage: proto.Message.InteractiveMessage.create({
                          body: proto.Message.InteractiveMessage.Body.create({ text: menu }),
                          footer: proto.Message.InteractiveMessage.Footer.create({ text: " " }),
                          header: proto.Message.InteractiveMessage.Header.create({ hasMediaAttachment: !!imageMessage, imageMessage: imageMessage || null }),
                          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                              buttons: [{
                                  name: "cta_url",
                                  buttonParamsJson: JSON.stringify({ display_text: "Lihat saluran", url: this.channelLink, merchant_url: this.channelLink })
                              }]
                          })
                      })
                  }
              }
          };
          const generatedMsg = generateWAMessageFromContent(jid, ctaMsg, { userJid: this.sock.user.id, quoted: msg });
          await this.sock.relayMessage(jid, generatedMsg.message, { messageId: generatedMsg.key.id });
        } catch (e) {
          console.error("Failed to send interactive message: ", e);
          if (this.coverImageBuffer) {
            await this.sock.sendMessage(jid, { image: this.coverImageBuffer, caption: menu }, { quoted: msg });
          } else {
            await this.sock.sendMessage(jid, { text: menu }, { quoted: msg });
          }
        }
      } else {
        if (this.coverImageBuffer) {
          await this.sock.sendMessage(jid, { image: this.coverImageBuffer, caption: menu }, { quoted: msg });
        } else {
          await this.sock.sendMessage(jid, { text: menu }, { quoted: msg });
        }
      }`;

if(c.includes(oldAllMenu)) {
  c = c.replace(oldAllMenu, newAllMenu);
  console.log('patched allmenu');
}

const oldOwnerMenu = `      if (this.channelLink) {
        const { generateWAMessageFromContent, proto, generateWAMessage } = await import('@whiskeysockets/baileys');
        let imageMessage;
        if (this.coverImageBuffer) {
           const mediaMsg = await generateWAMessage(jid, { image: this.coverImageBuffer }, { userJid: this.sock.user.id, upload: this.sock.waUploadToServer });
           imageMessage = mediaMsg.message?.imageMessage;
        }
        const ctaMsg = {
            viewOnceMessage: {
                message: {
                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                    interactiveMessage: proto.Message.InteractiveMessage.create({
                        body: proto.Message.InteractiveMessage.Body.create({ text: ownerText }),
                        footer: proto.Message.InteractiveMessage.Footer.create({ text: " " }),
                        header: proto.Message.InteractiveMessage.Header.create({ hasMediaAttachment: !!imageMessage, imageMessage: imageMessage }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                            buttons: [{
                                name: "cta_url",
                                buttonParamsJson: JSON.stringify({ display_text: "Lihat saluran", url: this.channelLink, merchant_url: this.channelLink })
                            }]
                        })
                    })
                }
            }
        };
        const generatedMsg = generateWAMessageFromContent(jid, ctaMsg, { userJid: this.sock.user.id });
        await this.sock.relayMessage(jid, generatedMsg.message, { messageId: generatedMsg.key.id });
      } else {
        let msgObj: any = { text: ownerText };
        if (this.coverImageBuffer) msgObj = { image: this.coverImageBuffer, caption: ownerText };
        await this.sock.sendMessage(jid, msgObj, { quoted: msg });
      }`;

const newOwnerMenu = `      if (this.channelLink) {
        try {
          const { generateWAMessageFromContent, proto, generateWAMessage } = await import('@whiskeysockets/baileys');
          let imageMessage;
          if (this.coverImageBuffer) {
             const mediaMsg = await generateWAMessage(jid, { image: this.coverImageBuffer }, { userJid: this.sock.user.id, upload: this.sock.waUploadToServer });
             imageMessage = mediaMsg.message?.imageMessage;
          }
          const ctaMsg = {
              viewOnceMessage: {
                  message: {
                      messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                      interactiveMessage: proto.Message.InteractiveMessage.create({
                          body: proto.Message.InteractiveMessage.Body.create({ text: ownerText }),
                          footer: proto.Message.InteractiveMessage.Footer.create({ text: " " }),
                          header: proto.Message.InteractiveMessage.Header.create({ hasMediaAttachment: !!imageMessage, imageMessage: imageMessage || null }),
                          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                              buttons: [{
                                  name: "cta_url",
                                  buttonParamsJson: JSON.stringify({ display_text: "Lihat saluran", url: this.channelLink, merchant_url: this.channelLink })
                              }]
                          })
                      })
                  }
              }
          };
          const generatedMsg = generateWAMessageFromContent(jid, ctaMsg, { userJid: this.sock.user.id, quoted: msg });
          await this.sock.relayMessage(jid, generatedMsg.message, { messageId: generatedMsg.key.id });
        } catch (e) {
          console.error("Failed to send interactive message owner: ", e);
          let msgObj: any = { text: ownerText };
          if (this.coverImageBuffer) msgObj = { image: this.coverImageBuffer, caption: ownerText };
          await this.sock.sendMessage(jid, msgObj, { quoted: msg });
        }
      } else {
        let msgObj: any = { text: ownerText };
        if (this.coverImageBuffer) msgObj = { image: this.coverImageBuffer, caption: ownerText };
        await this.sock.sendMessage(jid, msgObj, { quoted: msg });
      }`;

if(c.includes(oldOwnerMenu)) {
  c = c.replace(oldOwnerMenu, newOwnerMenu);
  console.log('patched ownermenu');
}

fs.writeFileSync('src/services/whatsapp.ts', c);
