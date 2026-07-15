const fs = require('fs');
let content = fs.readFileSync('src/services/whatsapp.ts', 'utf8');

// Update funCommands array
const oldFunCommands = /const funCommands = \['\.ceksifat', 'ceksifat', [^;]+\];/;
const matchFun = content.match(oldFunCommands);
if (matchFun) {
    let funArr = matchFun[0].replace('];', ", '.infonegara', 'infonegara', '.cekwibu', 'cekwibu', '.meme', 'meme', '.waifu', 'waifu', '.ceksange', 'ceksange', '.cekkaya', 'cekkaya', '.cekbucin', 'cekbucin', '.artinama', 'artinama', '.cekmasadepan', 'cekmasadepan', '.faktadunia', 'faktadunia', '.cekgempa', 'cekgempa', '.cekcuaca', 'cekcuaca'];");
    content = content.replace(oldFunCommands, funArr);
}

// Update funmenu text
const oldFunMenu = /const funText = \`🤡 \*Fun Menu\*\\n\\n│ \.cekkhodam[^\`]+\`;/;
const matchText = content.match(oldFunMenu);
if (matchText) {
    let newFunText = matchText[0].replace('\`;', "\\n│ .infonegara\\n│ .cekwibu\\n│ .meme\\n│ .waifu\\n│ .ceksange\\n│ .cekkaya\\n│ .cekbucin\\n│ .artinama\\n│ .cekmasadepan\\n│ .faktadunia\\n│ .cekgempa\\n│ .cekcuaca\`;");
    content = content.replace(oldFunMenu, newFunText);
}

const additionalFeatures = `    } else if (body.startsWith(".cekwibu") || body.startsWith("cekwibu") || body.startsWith(".ceksange") || body.startsWith("ceksange") || body.startsWith(".cekkaya") || body.startsWith("cekkaya") || body.startsWith(".cekbucin") || body.startsWith("cekbucin")) {
      const percentage = Math.floor(Math.random() * 101);
      const cmdName = body.split(" ")[0].replace(".", "");
      await this.sock.sendMessage(jid, { text: \`📊 *\${cmdName.toUpperCase()}*\\n\\nTingkat \${cmdName.replace("cek", "")} kamu adalah: *\${percentage}%*\` }, { quoted: msg });
    } else if (body.startsWith(".artinama") || body.startsWith("artinama") || body.startsWith(".cekmasadepan") || body.startsWith("cekmasadepan")) {
       const cmdName = body.split(" ")[0].replace(".", "");
       const target = body.split(" ").slice(1).join(" ");
       if (!target) {
           await this.sock.sendMessage(jid, { text: \`Tolong sebutkan nama. Contoh: .\${cmdName} Budi\` }, { quoted: msg });
       } else {
           const hasilNama = ["Orangnya penyayang", "Suka menabung", "Gampang marah", "Suka tidur", "Pemalas tapi pintar", "Rajin dan pekerja keras"];
           const hasilMasaDepan = ["Menjadi CEO", "Menjadi pengangguran sukses", "Menjadi artis", "Mendapat banyak uang", "Hidup bahagia bersama keluarga"];
           const hasil = cmdName === "artinama" ? hasilNama[Math.floor(Math.random() * hasilNama.length)] : hasilMasaDepan[Math.floor(Math.random() * hasilMasaDepan.length)];
           await this.sock.sendMessage(jid, { text: \`🔮 *\${cmdName.toUpperCase()}*\\n\\nNama: *\${target}*\\nHasil: *\${hasil}*\` }, { quoted: msg });
       }
    } else if (body.startsWith(".infonegara") || body.startsWith("infonegara")) {
       const negara = ["Indonesia", "Jepang", "Korea Selatan", "Amerika Serikat", "Rusia", "Inggris"];
       const n = negara[Math.floor(Math.random() * negara.length)];
       await this.sock.sendMessage(jid, { text: \`🌎 *Info Negara*\\n\\nNegara acak: *\${n}*\\nTahukah kamu? Ini adalah negara yang luar biasa!\` }, { quoted: msg });
    } else if (body.startsWith(".faktadunia") || body.startsWith("faktadunia")) {
       const fakta = [
           "Madu tidak pernah basi.",
           "Gurita memiliki 3 jantung.",
           "Venus adalah planet terpanas di tata surya kita.",
           "Semut tidak pernah tidur.",
           "Gajah adalah mamalia darat terbesar."
       ];
       const f = fakta[Math.floor(Math.random() * fakta.length)];
       await this.sock.sendMessage(jid, { text: \`🌍 *Fakta Dunia*\\n\\n\${f}\` }, { quoted: msg });
    } else if (body.startsWith(".cekgempa") || body.startsWith("cekgempa")) {
       await this.sock.sendMessage(jid, { text: \`🌍 *Info Gempa*\\n\\nData gempa terbaru tidak tersedia saat ini. Silakan cek situs web BMKG untuk informasi lebih lanjut.\` }, { quoted: msg });
    } else if (body.startsWith(".cekcuaca") || body.startsWith("cekcuaca")) {
       await this.sock.sendMessage(jid, { text: \`⛅ *Cek Cuaca*\\n\\nCuaca hari ini kemungkinan cerah berawan. Tetap semangat!\` }, { quoted: msg });
    } else if (body.startsWith(".meme") || body.startsWith("meme")) {
       await this.sock.sendMessage(jid, { text: \`🖼️ *Meme*\\n\\nFitur meme sedang dalam pengembangan.\` }, { quoted: msg });
    } else if (body.startsWith(".waifu") || body.startsWith("waifu")) {
       await this.sock.sendMessage(jid, { text: \`🌸 *Waifu*\\n\\nFitur waifu sedang dalam pengembangan.\` }, { quoted: msg });`;

content = content.replace('    } else if (body.startsWith(".cekhoby")', additionalFeatures + '\\n    } else if (body.startsWith(".cekhoby")');

fs.writeFileSync('src/services/whatsapp.ts', content);
