const fs = require('fs');
let code = fs.readFileSync('src/services/whatsapp.ts', 'utf8');

// 1. Add islamCommands
code = code.replace(
  /const kristenCommands = \['\.kristenmenu', 'kristenmenu', '\.ayatalkitab', 'ayatalkitab', '\.doaayat', 'doaayat', '\.kisahyesus', 'kisahyesus', '\.jadwalgereja', 'jadwalgereja', '\.namakitab', 'namakitab'\];/,
  `const kristenCommands = ['.kristenmenu', 'kristenmenu', '.ayatalkitab', 'ayatalkitab', '.doaayat', 'doaayat', '.kisahyesus', 'kisahyesus', '.jadwalgereja', 'jadwalgereja', '.namakitab', 'namakitab'];\n    const islamCommands = ['.islammenu', 'islammenu', '.ayatkursi', 'ayatkursi', '.tekssholat', 'tekssholat', '.hadits', 'hadits', '.jadwalsholat', 'jadwalsholat', '.kisahnabi', 'kisahnabi', '.niatsholat', 'niatsholat', '.quotesislami', 'quotesislami'];`
);

// 2. Add totalFitur logic
code = code.replace(
  /const totalFitur = ownerCommands\.length \+ groupCommands\.length \+ funCommands\.length \+ margaCommands\.length \+ videoCommands\.length \+ stickerCommands\.length \+ downloadCommands\.length \+ kristenCommands\.length;/g,
  `const totalFitur = ownerCommands.length + groupCommands.length + funCommands.length + margaCommands.length + videoCommands.length + stickerCommands.length + downloadCommands.length + kristenCommands.length + islamCommands.length;`
);

code = code.replace(
  /const totalFitur = ownerCommands\.length \+ groupCommands\.length \+ margaCommands\.length \+ videoCommands\.length \+ stickerCommands\.length \+ funCommands\.length \+ downloadCommands\.length \+ kristenCommands\.length;/g,
  `const totalFitur = ownerCommands.length + groupCommands.length + margaCommands.length + videoCommands.length + stickerCommands.length + funCommands.length + downloadCommands.length + kristenCommands.length + islamCommands.length;`
);

// 3. Add islammenu to allmenu text
code = code.replace(
  /│ \.kristenmenu/,
  `│ .kristenmenu\n│ .islammenu`
);

// 4. Update kristenmenu text and add islammenu
code = code.replace(
  /const kristenText = `✝️ \*Kristen Menu\*\\n\\n│ \.ayatalkitab\\n│ \.doaayat\\n│ \.kisahyesus\\n│ \.jadwalgereja\\n│ \.namakitab`;\n      await this\.sock\.sendMessage\(jid, { text: kristenText }, { quoted: msg }\);\n      this\.broadcastState\(`Responded to kristenmenu command`\);/g,
  `const kristenText = \`✝️ *Kristen Menu*\\n\\n│ .ayatalkitab\\n│ .doaayat\\n│ .kisahyesus\\n│ .jadwalgereja\\n│ .namakitab\`;
      await this.sock.sendMessage(jid, { text: kristenText }, { quoted: msg });
      this.broadcastState(\`Responded to kristenmenu command\`);
    } else if (body === "islammenu" || body === ".islammenu" || body === "islam menu" || body === ".islam menu") {
      const islamText = \`☪️ *Islam Menu*\\n\\n│ .ayatkursi\\n│ .tekssholat\\n│ .hadits\\n│ .jadwalsholat\\n│ .kisahnabi\\n│ .niatsholat\\n│ .quotesislami\`;
      await this.sock.sendMessage(jid, { text: islamText }, { quoted: msg });
      this.broadcastState(\`Responded to islammenu command\`);`
);

// 6. Add islam commands handlers
code = code.replace(
  /    \} else if \(body\.startsWith\("\.sewabot"\) \|\| body\.startsWith\("sewabot"\)\) {/,
  `    } else if (body.startsWith(".ayatkursi") || body.startsWith("ayatkursi")) {
        const ayatKursi = \`*Ayat Kursi*\\n\\nٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌۭ وَلَا نَوْمٌۭ ۚ لَّهُۥ مَا فِى ٱلسَّمَـٰوَٰتِ وَمَا فِى ٱلْأَرْضِ ۗ مَن ذَا ٱلَّذِى يَشْفَعُ عِندَهُۥٓ إِلَّا بِإِذْنِهِۦ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَىْءٍۢ مِّنْ عِلْمِهِۦٓ إِلَّا بِمَا شَآءَ ۚ وَسِعَ كُرْسِيُّهُ ٱلسَّمَـٰوَٰتِ وَٱلْأَرْضَ ۖ وَلَا يَـُٔودُهُۥ حِفْظُهُمَا ۚ وَهُوَ ٱلْعَلِىُّ ٱلْعَظِيمُ\\n\\n*Artinya:* Allah, tidak ada tuhan selain Dia. Yang Mahahidup, Yang terus menerus mengurus (makhluk-Nya), tidak mengantuk dan tidak tidur. Milik-Nya apa yang ada di langit dan apa yang ada di bumi. Tidak ada yang dapat memberi syafaat di sisi-Nya tanpa izin-Nya. Dia mengetahui apa yang di hadapan mereka dan apa yang di belakang mereka, dan mereka tidak mengetahui sesuatu apa pun tentang ilmu-Nya melainkan apa yang Dia kehendaki. Kursi-Nya meliputi langit dan bumi. Dan Dia tidak merasa berat memelihara keduanya, dan Dia Mahatinggi, Mahabesar. (QS. Al-Baqarah: 255)\`;
        await this.sock.sendMessage(jid, { text: ayatKursi }, { quoted: msg });
    } else if (body.startsWith(".tekssholat") || body.startsWith("tekssholat")) {
        const teks = \`*Teks/Bacaan Sholat*\\n\\nSilakan cari referensi bacaan sholat lengkap di sumber terpercaya seperti NU Online, Muhammadiyah, atau aplikasi Al-Qur'an dan Hadits.\`;
        await this.sock.sendMessage(jid, { text: teks }, { quoted: msg });
    } else if (body.startsWith(".hadits") || body.startsWith("hadits")) {
        const hadits = [
            "Sebaik-baik manusia adalah yang paling bermanfaat bagi manusia lainnya. (HR. Ahmad)",
            "Kebersihan itu sebagian dari iman. (HR. Muslim)",
            "Barangsiapa menempuh jalan untuk mencari ilmu, maka Allah akan mudahkan baginya jalan menuju surga. (HR. Muslim)",
            "Sesungguhnya amal itu tergantung pada niatnya. (HR. Bukhari dan Muslim)"
        ];
        const randomHadits = hadits[Math.floor(Math.random() * hadits.length)];
        await this.sock.sendMessage(jid, { text: \`📜 *Hadits*\\n\\n\${randomHadits}\` }, { quoted: msg });
    } else if (body.startsWith(".jadwalsholat") || body.startsWith("jadwalsholat")) {
        await this.sock.sendMessage(jid, { text: \`🕌 *Jadwal Sholat*\\n\\nFitur jadwal sholat dinamis sedang dikembangkan. Anda bisa mengecek di aplikasi Muslim Pro atau situs Bimas Islam Kemenag.\` }, { quoted: msg });
    } else if (body.startsWith(".kisahnabi") || body.startsWith("kisahnabi")) {
        const kisah = [
            "Nabi Muhammad SAW adalah nabi terakhir yang diutus oleh Allah SWT. Beliau lahir di Makkah dan menerima wahyu Al-Qur'an melalui Malaikat Jibril.",
            "Nabi Nuh AS berdakwah selama 950 tahun namun hanya sedikit yang beriman. Beliau diperintahkan Allah membuat kapal besar untuk selamat dari banjir bah.",
            "Nabi Ibrahim AS dikenal sebagai Bapak Para Nabi. Beliau membangun Ka'bah bersama putranya, Nabi Ismail AS.",
            "Nabi Musa AS membelah lautan Merah atas izin Allah untuk menyelamatkan Bani Israil dari kejaran Fir'aun."
        ];
        const randomKisah = kisah[Math.floor(Math.random() * kisah.length)];
        await this.sock.sendMessage(jid, { text: \`📖 *Kisah Nabi*\\n\\n\${randomKisah}\` }, { quoted: msg });
    } else if (body.startsWith(".niatsholat") || body.startsWith("niatsholat")) {
        const niat = \`*Niat Sholat Fardhu*\\n\\n1. *Subuh:* Ushalli fardhas subhi rak'ataini mustaqbilal qiblati adaa'an (ma'muman/imaman) lillaahi ta'aalaa.\\n2. *Dzuhur:* Ushalli fardhadz dzuhri arba'a raka'aatin mustaqbilal qiblati adaa'an (ma'muman/imaman) lillaahi ta'aalaa.\\n3. *Ashar:* Ushalli fardhal ashri arba'a raka'aatin mustaqbilal qiblati adaa'an (ma'muman/imaman) lillaahi ta'aalaa.\\n4. *Maghrib:* Ushalli fardhal maghribi tsalaatsa raka'aatin mustaqbilal qiblati adaa'an (ma'muman/imaman) lillaahi ta'aalaa.\\n5. *Isya:* Ushalli fardhal isyaa'i arba'a raka'aatin mustaqbilal qiblati adaa'an (ma'muman/imaman) lillaahi ta'aalaa.\`;
        await this.sock.sendMessage(jid, { text: niat }, { quoted: msg });
    } else if (body.startsWith(".quotesislami") || body.startsWith("quotesislami")) {
        const quotes = [
            "Jangan bersedih, sesungguhnya Allah bersama kita. (QS. At-Taubah: 40)",
            "Allah tidak membebani seseorang melainkan sesuai dengan kesanggupannya. (QS. Al-Baqarah: 286)",
            "Maka sesungguhnya bersama kesulitan ada kemudahan. (QS. Al-Insyirah: 5)",
            "Sabar itu memang pahit, tapi buahnya lebih manis dari madu.",
            "Jadikan sabar dan sholat sebagai penolongmu. (QS. Al-Baqarah: 45)"
        ];
        const randomQuotes = quotes[Math.floor(Math.random() * quotes.length)];
        await this.sock.sendMessage(jid, { text: \`✨ *Quotes Islami*\\n\\n\${randomQuotes}\` }, { quoted: msg });
    } else if (body.startsWith(".sewabot") || body.startsWith("sewabot")) {`
);

fs.writeFileSync('src/services/whatsapp.ts', code);
