const fs = require('fs');
let code = fs.readFileSync('src/services/whatsapp.ts', 'utf8');

// 1. Add stickerCommands and kristenCommands
code = code.replace(
  /const stickerCommands = \['\.stickermenu', 'stickermenu', '\.stiker', 'stiker', '\.hd', 'hd', '\.brat', 'brat', '\.bratvid', 'bratvid', '\.smeme', 'smeme', '\.qc', 'qc', '\.toimg', 'toimg', '\.togif', 'togif'\];/,
  `const stickerCommands = ['.stickermenu', 'stickermenu', '.stiker', 'stiker', '.hd', 'hd', '.brat', 'brat', '.bratvid', 'bratvid', '.smeme', 'smeme', '.qc', 'qc', '.toimg', 'toimg', '.togif', 'togif', '.stikerrandom', 'stikerrandom', '.stikerspongebob', 'stikerspongebob'];\n    const kristenCommands = ['.kristenmenu', 'kristenmenu', '.ayatalkitab', 'ayatalkitab', '.doaayat', 'doaayat', '.kisahyesus', 'kisahyesus', '.jadwalgereja', 'jadwalgereja', '.namakitab', 'namakitab'];`
);

// 2. Add totalFitur logic
code = code.replace(
  /const totalFitur = ownerCommands.length \+ groupCommands.length \+ funCommands.length \+ margaCommands.length \+ videoCommands.length \+ stickerCommands.length \+ downloadCommands.length;/,
  `const totalFitur = ownerCommands.length + groupCommands.length + funCommands.length + margaCommands.length + videoCommands.length + stickerCommands.length + downloadCommands.length + kristenCommands.length;`
);

code = code.replace(
  /const totalFitur = ownerCommands.length \+ groupCommands.length \+ margaCommands.length \+ videoCommands.length \+ stickerCommands.length;/,
  `const totalFitur = ownerCommands.length + groupCommands.length + margaCommands.length + videoCommands.length + stickerCommands.length + funCommands.length + downloadCommands.length + kristenCommands.length;`
);

// 3. Add kristenmenu to allmenu text
code = code.replace(
  /│ \.stickermenu/,
  `│ .stickermenu\n│ .kristenmenu`
);

// 4. Update stickermenu text and add kristenmenu
code = code.replace(
  /const stickerText = `🎨 \*Sticker Menu\*\n\n│ \.stiker - ubah gambar jadi stiker\n│ \.hd - tingkatkan resolusi gambar\n│ \.brat - buat stiker teks brat\n│ \.bratvid - buat stiker teks video brat\n│ \.smeme - buat stiker dengan teks\|teks\n│ \.qc - buat stiker text chat\n│ \.toimg - stiker ke gambar\n│ \.togif - gambar ke gif`;\n      await this.sock.sendMessage\(jid, { text: stickerText }, { quoted: msg }\);\n      this.broadcastState\(`Responded to stickermenu command`\);/,
  `const stickerText = \`🎨 *Sticker Menu*\\n\\n│ .stiker - ubah gambar jadi stiker\\n│ .hd - tingkatkan resolusi gambar\\n│ .brat - buat stiker teks brat\\n│ .bratvid - buat stiker teks video brat\\n│ .smeme - buat stiker dengan teks|teks\\n│ .qc - buat stiker text chat\\n│ .toimg - stiker ke gambar\\n│ .togif - gambar ke gif\\n│ .stikerrandom - stiker random\\n│ .stikerspongebob - stiker spongebob\`;
      await this.sock.sendMessage(jid, { text: stickerText }, { quoted: msg });
      this.broadcastState(\`Responded to stickermenu command\`);
    } else if (body === "kristenmenu" || body === ".kristenmenu" || body === "kristen menu" || body === ".kristen menu") {
      const kristenText = \`✝️ *Kristen Menu*\\n\\n│ .ayatalkitab\\n│ .doaayat\\n│ .kisahyesus\\n│ .jadwalgereja\\n│ .namakitab\`;
      await this.sock.sendMessage(jid, { text: kristenText }, { quoted: msg });
      this.broadcastState(\`Responded to kristenmenu command\`);`
);

// 5. Update funmenu handlers (cekgempa, cekcuaca, meme, waifu)
code = code.replace(
  /    \} else if \(body\.startsWith\("\.cekgempa"\) \|\| body\.startsWith\("cekgempa"\)\) {\n       await this\.sock\.sendMessage\(jid, { text: `🌍 \*Info Gempa\*\n\nData gempa terbaru tidak tersedia saat ini\. Silakan cek situs web BMKG untuk informasi lebih lanjut\.` }, { quoted: msg }\);\n    \} else if \(body\.startsWith\("\.cekcuaca"\) \|\| body\.startsWith\("cekcuaca"\)\) {\n       await this\.sock\.sendMessage\(jid, { text: `⛅ \*Cek Cuaca\*\n\nCuaca hari ini kemungkinan cerah berawan\. Tetap semangat!` }, { quoted: msg }\);\n    \} else if \(body\.startsWith\("\.meme"\) \|\| body\.startsWith\("meme"\)\) {\n       await this\.sock\.sendMessage\(jid, { text: `🖼️ \*Meme\*\n\nFitur meme sedang dalam pengembangan\.` }, { quoted: msg }\);\n    \} else if \(body\.startsWith\("\.waifu"\) \|\| body\.startsWith\("waifu"\)\) {\n       await this\.sock\.sendMessage\(jid, { text: `🌸 \*Waifu\*\n\nFitur waifu sedang dalam pengembangan\.` }, { quoted: msg }\);/,
  `    } else if (body.startsWith(".cekgempa") || body.startsWith("cekgempa")) {
       try {
           const res = await axios.get("https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json");
           const gempa = res.data?.Infogempa?.gempa;
           if (gempa) {
               const text = \`🌍 *Info Gempa BMKG*\\n\\n📅 Tanggal: \${gempa.Tanggal}\\n⌚ Jam: \${gempa.Jam}\\n📍 Koordinat: \${gempa.Coordinates}\\n📏 Magnitudo: \${gempa.Magnitude}\\n🕳️ Kedalaman: \${gempa.Kedalaman}\\n🗺️ Wilayah: \${gempa.Wilayah}\\n⚠️ Potensi: \${gempa.Potensi}\\n🫨 Dirasakan: \${gempa.Dirasakan}\`;
               const image = \`https://data.bmkg.go.id/DataMKG/TEWS/\${gempa.Shakemap}\`;
               await this.sock.sendMessage(jid, { image: { url: image }, caption: text }, { quoted: msg });
           } else {
               await this.sock.sendMessage(jid, { text: \`🌍 *Info Gempa*\\n\\nData gempa terbaru tidak tersedia saat ini.\` }, { quoted: msg });
           }
       } catch (error) {
           await this.sock.sendMessage(jid, { text: \`🌍 *Info Gempa*\\n\\nGagal mengambil data gempa.\` }, { quoted: msg });
       }
    } else if (body.startsWith(".cekcuaca") || body.startsWith("cekcuaca")) {
       await this.sock.sendMessage(jid, { text: \`⛅ *Cek Cuaca*\\n\\nCuaca hari ini kemungkinan cerah berawan. Tetap semangat!\` }, { quoted: msg });
    } else if (body.startsWith(".meme") || body.startsWith("meme")) {
       try {
           const res = await axios.get("https://meme-api.com/gimme");
           if (res.data && res.data.url) {
               await this.sock.sendMessage(jid, { image: { url: res.data.url }, caption: \`🖼️ *Meme*\\n\\n\${res.data.title}\` }, { quoted: msg });
           } else {
               await this.sock.sendMessage(jid, { text: \`🖼️ *Meme*\\n\\nGagal mengambil meme.\` }, { quoted: msg });
           }
       } catch (error) {
           await this.sock.sendMessage(jid, { text: \`🖼️ *Meme*\\n\\nGagal mengambil meme.\` }, { quoted: msg });
       }
    } else if (body.startsWith(".waifu") || body.startsWith("waifu")) {
       try {
           const res = await axios.get("https://nekos.life/api/v2/img/waifu");
           if (res.data && res.data.url) {
               await this.sock.sendMessage(jid, { image: { url: res.data.url }, caption: \`🌸 *Waifu*\` }, { quoted: msg });
           } else {
               await this.sock.sendMessage(jid, { text: \`🌸 *Waifu*\\n\\nGagal mengambil waifu.\` }, { quoted: msg });
           }
       } catch (error) {
           await this.sock.sendMessage(jid, { text: \`🌸 *Waifu*\\n\\nGagal mengambil waifu.\` }, { quoted: msg });
       }`
);

// 6. Add stikerrandom, stikerspongebob, kristen commands
code = code.replace(
  /    \} else if \(body\.startsWith\("\.sewabot"\) \|\| body\.startsWith\("sewabot"\)\) {/,
  `    } else if (body.startsWith(".stikerrandom") || body.startsWith("stikerrandom")) {
       try {
           const res = await axios.get("https://meme-api.com/gimme");
           if (res.data && res.data.url) {
               const imgRes = await axios.get(res.data.url, { responseType: 'arraybuffer' });
               const buffer = await sharp(imgRes.data).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
               await this.sock.sendMessage(jid, { sticker: buffer }, { quoted: msg });
           } else {
               await this.sock.sendMessage(jid, { text: \`❌ Gagal mengambil gambar random.\` }, { quoted: msg });
           }
       } catch (error) {
           await this.sock.sendMessage(jid, { text: \`❌ Gagal membuat stiker random.\` }, { quoted: msg });
       }
    } else if (body.startsWith(".stikerspongebob") || body.startsWith("stikerspongebob")) {
       try {
           const res = await axios.get("https://meme-api.com/gimme/BikiniBottomTwitter");
           if (res.data && res.data.url) {
               const imgRes = await axios.get(res.data.url, { responseType: 'arraybuffer' });
               const buffer = await sharp(imgRes.data).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
               await this.sock.sendMessage(jid, { sticker: buffer }, { quoted: msg });
           } else {
               await this.sock.sendMessage(jid, { text: \`❌ Gagal mengambil gambar spongebob.\` }, { quoted: msg });
           }
       } catch (error) {
           await this.sock.sendMessage(jid, { text: \`❌ Gagal membuat stiker spongebob.\` }, { quoted: msg });
       }
    } else if (body.startsWith(".ayatalkitab") || body.startsWith("ayatalkitab")) {
        const ayat = [
            "Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal, supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan beroleh hidup yang kekal. - Yohanes 3:16",
            "Pencuri datang hanya untuk mencuri dan membunuh dan membinasakan; Aku datang, supaya mereka mempunyai hidup, dan mempunyainya dalam segala kelimpahan. - Yohanes 10:10",
            "Segala perkara dapat kutanggung di dalam Dia yang memberi kekuatan kepadaku. - Filipi 4:13",
            "Sebab Aku ini mengetahui rancangan-rancangan apa yang ada pada-Ku mengenai kamu, demikianlah firman TUHAN, yaitu rancangan damai sejahtera dan bukan rancangan kecelakaan, untuk memberikan kepadamu hari depan yang penuh harapan. - Yeremia 29:11"
        ];
        const randomAyat = ayat[Math.floor(Math.random() * ayat.length)];
        await this.sock.sendMessage(jid, { text: \`📖 *Ayat Alkitab*\\n\\n\${randomAyat}\` }, { quoted: msg });
    } else if (body.startsWith(".doaayat") || body.startsWith("doaayat")) {
        await this.sock.sendMessage(jid, { text: \`🙏 *Doa Harian*\\n\\nTuhan Yesus, terima kasih atas berkatMu hari ini. Bimbinglah langkah kami dan berikanlah damai sejahtera. Amin.\` }, { quoted: msg });
    } else if (body.startsWith(".kisahyesus") || body.startsWith("kisahyesus")) {
        await this.sock.sendMessage(jid, { text: \`✝️ *Kisah Yesus*\\n\\nYesus Kristus lahir di Betlehem, melakukan banyak mukjizat, disalibkan demi menebus dosa manusia, dan bangkit pada hari ketiga untuk memberikan keselamatan bagi setiap orang yang percaya.\` }, { quoted: msg });
    } else if (body.startsWith(".jadwalgereja") || body.startsWith("jadwalgereja")) {
        await this.sock.sendMessage(jid, { text: \`⛪ *Jadwal Gereja*\\n\\n- Ibadah Raya 1: Minggu 07.00 WIB\\n- Ibadah Raya 2: Minggu 09.30 WIB\\n- Ibadah Raya 3: Minggu 17.00 WIB\\n- Sekolah Minggu: Minggu 09.30 WIB\\n- Pemuda & Remaja: Sabtu 18.00 WIB\` }, { quoted: msg });
    } else if (body.startsWith(".namakitab") || body.startsWith("namakitab")) {
        await this.sock.sendMessage(jid, { text: \`📚 *Nama-nama Kitab*\\n\\n*Perjanjian Lama (39 Kitab):*\\nKejadian, Keluaran, Imamat, Bilangan, Ulangan, Yosua, Hakim-Hakim, Rut, 1&2 Samuel, 1&2 Raja-Raja, 1&2 Tawarikh, Ezra, Nehemia, Ester, Ayub, Mazmur, Amsal, Pengkhotbah, Kidung Agung, Yesaya, Yeremia, Ratapan, Yehezkiel, Daniel, Hosea, Yoel, Amos, Obaja, Yunus, Mikha, Nahum, Habakuk, Zefanya, Hagai, Zakharia, Maleakhi.\\n\\n*Perjanjian Baru (27 Kitab):*\\nMatius, Markus, Lukas, Yohanes, Kisah Para Rasul, Roma, 1&2 Korintus, Galatia, Efesus, Filipi, Kolose, 1&2 Tesalonika, 1&2 Timotius, Titus, Filemon, Ibrani, Yakobus, 1&2 Petrus, 1-3 Yohanes, Yudas, Wahyu.\` }, { quoted: msg });
    } else if (body.startsWith(".sewabot") || body.startsWith("sewabot")) {`
);

fs.writeFileSync('src/services/whatsapp.ts', code);
