const fs = require('fs');
let code = fs.readFileSync('src/services/whatsapp.ts', 'utf8');

// Ensure kristenmenu handler exists
if (!code.includes('Responded to kristenmenu command')) {
  code = code.replace(
    /      this\.broadcastState\(`Responded to stickermenu command`\);\n    \} else if \(body === "funmenu"/,
    `      this.broadcastState(\`Responded to stickermenu command\`);
    } else if (body === "kristenmenu" || body === ".kristenmenu" || body === "kristen menu" || body === ".kristen menu") {
      const kristenText = \`✝️ *Kristen Menu*\\n\\n│ .ayatalkitab\\n│ .doaayat\\n│ .kisahyesus\\n│ .jadwalgereja\\n│ .namakitab\`;
      await this.sock.sendMessage(jid, { text: kristenText }, { quoted: msg });
      this.broadcastState(\`Responded to kristenmenu command\`);
    } else if (body === "funmenu"`
  );
}

// Ensure islammenu handler exists
if (!code.includes('Responded to islammenu command')) {
  code = code.replace(
    /      this\.broadcastState\(`Responded to kristenmenu command`\);\n    \} else if \(body === "funmenu"/,
    `      this.broadcastState(\`Responded to kristenmenu command\`);
    } else if (body === "islammenu" || body === ".islammenu" || body === "islam menu" || body === ".islam menu") {
      const islamText = \`☪️ *Islam Menu*\\n\\n│ .ayatkursi\\n│ .tekssholat\\n│ .hadits\\n│ .jadwalsholat\\n│ .kisahnabi\\n│ .niatsholat\\n│ .quotesislami\`;
      await this.sock.sendMessage(jid, { text: islamText }, { quoted: msg });
      this.broadcastState(\`Responded to islammenu command\`);
    } else if (body === "funmenu"`
  );
}

fs.writeFileSync('src/services/whatsapp.ts', code);
