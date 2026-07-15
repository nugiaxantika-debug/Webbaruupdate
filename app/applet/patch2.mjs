import fs from 'fs';

let c = fs.readFileSync('src/services/whatsapp.ts', 'utf8');

if (!c.includes('.addlinkch')) {
  c = c.replace(/const ownerCommands = \['\.ownermenu', 'ownermenu',/, "const ownerCommands = ['.addlinkch', 'addlinkch', '.dellinkch', 'dellinkch', '.ownermenu', 'ownermenu',");
  
  c = c.replace(/│ \.self \/ \.publik/, "│ .addlinkch <link>\n│ .dellinkch\n│ .self / .publik");
  
  const additionalLogic = `    } else if (body.startsWith(".addlinkch") || body.startsWith("addlinkch")) {
      const match = body.match(/^\\.?addlinkch\\s+(.+)$/i);
      if (match && match[1]) {
         this.channelLink = match[1].trim();
         this.saveBotSettings();
         await this.sock.sendMessage(jid, { text: \`✅ Berhasil menambahkan link saluran: \${this.channelLink}\` }, { quoted: msg });
      } else {
         await this.sock.sendMessage(jid, { text: \`❌ Kirim link channel, contoh: .addlinkch https://whatsapp.com/channel/xxx\` }, { quoted: msg });
      }
      this.broadcastState(\`Added linkch\`);
    } else if (body.startsWith(".dellinkch") || body.startsWith("dellinkch")) {
      this.channelLink = null;
      this.saveBotSettings();
      await this.sock.sendMessage(jid, { text: \`✅ Berhasil menghapus link saluran\` }, { quoted: msg });
      this.broadcastState(\`Deleted linkch\`);`;
      
  c = c.replace('} else if (body.startsWith(".setcoverbot") || body.startsWith("setcoverbot")) {', additionalLogic + '\n    } else if (body.startsWith(".setcoverbot") || body.startsWith("setcoverbot")) {');
  
  fs.writeFileSync('src/services/whatsapp.ts', c);
  console.log('patched');
}
