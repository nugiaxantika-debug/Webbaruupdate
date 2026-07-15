const fs = require('fs');
let code = fs.readFileSync('src/services/whatsapp.ts', 'utf8');

code = code.replace(
  /    \} else if \(body\.startsWith\("\.jadwalsholat"\) \|\| body\.startsWith\("jadwalsholat"\)\) {\n        await this\.sock\.sendMessage\(jid, { text: `🕌 \*Jadwal Sholat\*\\n\\nFitur jadwal sholat dinamis sedang dikembangkan\. Anda bisa mengecek di aplikasi Muslim Pro atau situs Bimas Islam Kemenag\.` }, { quoted: msg }\);/,
  `    } else if (body.startsWith(".jadwalsholat") || body.startsWith("jadwalsholat")) {
        const city = messageContent.replace(/^\\.?jadwalsholat\\s*/i, "").trim();
        if (!city) {
            await this.sock.sendMessage(jid, { text: \`🕌 *Jadwal Sholat*\\n\\nSilakan masukkan nama kota.\\nContoh: .jadwalsholat jakarta\` }, { quoted: msg });
        } else {
            try {
                const res = await axios.get(\`https://api.aladhan.com/v1/timingsByCity?city=\${encodeURIComponent(city)}&country=Indonesia&method=8\`);
                if (res.data && res.data.data && res.data.data.timings) {
                    const t = res.data.data.timings;
                    const text = \`🕌 *Jadwal Sholat - \${city.toUpperCase()}*\\n\\nImsak: \${t.Imsak}\\nSubuh: \${t.Fajr}\\nTerbit: \${t.Sunrise}\\nDzuhur: \${t.Dhuhr}\\nAshar: \${t.Asr}\\nMaghrib: \${t.Maghrib}\\nIsya: \${t.Isha}\\n\\n_Sumber: Aladhan API_\`;
                    await this.sock.sendMessage(jid, { text: text }, { quoted: msg });
                } else {
                    await this.sock.sendMessage(jid, { text: \`❌ Kota "\${city}" tidak ditemukan.\` }, { quoted: msg });
                }
            } catch (error) {
                await this.sock.sendMessage(jid, { text: \`❌ Gagal mengambil data jadwal sholat untuk kota "\${city}".\` }, { quoted: msg });
            }
        }`
);

fs.writeFileSync('src/services/whatsapp.ts', code);
