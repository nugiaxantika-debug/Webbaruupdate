const fs = require('fs');
let code = fs.readFileSync('src/services/whatsapp.ts', 'utf8');

const handlers = `
    } else if (body.startsWith(".playytmp4 ") || body.startsWith("playytmp4 ")) {
      const q = messageContent.replace(/^\\.?playytmp4\\s*/i, "").trim();
      await this.sock.sendMessage(jid, { text: \`⏳ *Sedang mencari "\${q}" di Youtube...*\` }, { quoted: msg });
      try {
        const search: any = await btch.yts(q);
        if (search.result && search.result.videos && search.result.videos.length > 0) {
           const firstVideo = search.result.videos[0];
           const ytInfo = \`🎧 *PLAY YOUTUBE MP4*\\n\\n📌 Judul: \${firstVideo.title}\\n⏱ Durasi: \${firstVideo.duration.timestamp}\\n👀 Views: \${firstVideo.views}\\n📺 Channel: \${firstVideo.author.name}\\n\\n✅ *Video Ditemukan!*\\n🔗 Link: \${firstVideo.url}\\n⏳ _Sedang mengambil video, mohon tunggu..._\`;
           await this.sock.sendMessage(jid, { image: { url: firstVideo.image }, caption: ytInfo }, { quoted: msg });
           let ytDownload: any;
           for (let i = 0; i < 3; i++) {
             try {
               ytDownload = await (vredenYt as any).ytmp4(firstVideo.url);
               if (ytDownload && ytDownload.status && ytDownload.download && ytDownload.download.url) break;
             } catch (e) {}
             await new Promise(r => setTimeout(r, 2000));
           }
           if (ytDownload && ytDownload.status && ytDownload.download && ytDownload.download.url) {
             const dlUrl = ytDownload.download.url;
             await this.sock.sendMessage(jid, { video: { url: dlUrl }, mimetype: "video/mp4", caption: \`✅ \${firstVideo.title}\` }, { quoted: msg });
           } else {
             await this.sock.sendMessage(jid, { text: \`❌ Gagal mendownload video dari "\${firstVideo.title}"\` }, { quoted: msg });
           }
        } else {
           await this.sock.sendMessage(jid, { text: \`❌ Tidak ditemukan hasil untuk "\${q}"\` }, { quoted: msg });
        }
      } catch (e) {
        await this.sock.sendMessage(jid, { text: \`❌ Terjadi kesalahan saat mencari Youtube.\` }, { quoted: msg });
      }
    } else if (body.startsWith(".tiktokaudiomp3 ") || body.startsWith("tiktokaudiomp3 ")) {
      const urlMatches = messageContent.match(/(https?:\\/\\/[^\\s]+)/g);
      if (!urlMatches) {
        await this.sock.sendMessage(jid, { text: "Link TikTok tidak ditemukan. Contoh: .tiktokaudiomp3 https://vt.tiktok.com/ZS9pCeuV4/" }, { quoted: msg });
        return;
      }
      const url = urlMatches[0];
      await this.sock.sendMessage(jid, { text: "⏳ *Sedang mendownload audio TikTok...*" }, { quoted: msg });
      try {
        const fetchRes = await axios.get(\`https://www.tikwm.com/api/?url=\${url}\`);
        if (fetchRes.data && fetchRes.data.code === 0 && fetchRes.data.data.music) {
          const audioUrl = fetchRes.data.data.music;
          await this.sock.sendMessage(jid, { audio: { url: audioUrl }, mimetype: "audio/mp4", ptt: false }, { quoted: msg });
        } else {
           await this.sock.sendMessage(jid, { text: "❌ *Gagal mendownload audio. Pastikan link valid.*" }, { quoted: msg });
        }
      } catch (e) {
        await this.sock.sendMessage(jid, { text: "❌ *Gagal mendownload audio dari server.*" }, { quoted: msg });
      }
    } else if (body.startsWith(".capcut ") || body.startsWith("capcut ")) {
      const urlMatches = messageContent.match(/(https?:\\/\\/[^\\s]+)/g);
      if (!urlMatches) {
        await this.sock.sendMessage(jid, { text: "Link Capcut tidak ditemukan." }, { quoted: msg });
        return;
      }
      const url = urlMatches[0];
      await this.sock.sendMessage(jid, { text: "⏳ *Sedang mendownload Capcut...*" }, { quoted: msg });
      try {
        const capcutRes: any = await btch.capcut(url);
        if (capcutRes && capcutRes.video) {
          await this.sock.sendMessage(jid, { video: { url: capcutRes.video }, caption: \`✅ *Download Sukses*\\n\\n\${capcutRes.title || ''}\` }, { quoted: msg });
        } else {
          await this.sock.sendMessage(jid, { text: "❌ *Gagal mendownload Capcut.*" }, { quoted: msg });
        }
      } catch (e) {
        await this.sock.sendMessage(jid, { text: "❌ *Terjadi kesalahan saat mendownload Capcut.*" }, { quoted: msg });
      }
    } else if (body.startsWith(".facebook ") || body.startsWith("facebook ") || body.startsWith(".fb ") || body.startsWith("fb ")) {
      const urlMatches = messageContent.match(/(https?:\\/\\/[^\\s]+)/g);
      if (!urlMatches) {
        await this.sock.sendMessage(jid, { text: "Link Facebook tidak ditemukan." }, { quoted: msg });
        return;
      }
      const url = urlMatches[0];
      await this.sock.sendMessage(jid, { text: "⏳ *Sedang mendownload video Facebook...*" }, { quoted: msg });
      try {
        const fbRes: any = await ab.fbdown(url);
        if (fbRes && fbRes.HD) {
          await this.sock.sendMessage(jid, { video: { url: fbRes.HD }, caption: \`✅ *Download Sukses*\` }, { quoted: msg });
        } else if (fbRes && fbRes.Normal_video) {
          await this.sock.sendMessage(jid, { video: { url: fbRes.Normal_video }, caption: \`✅ *Download Sukses*\` }, { quoted: msg });
        } else {
          await this.sock.sendMessage(jid, { text: "❌ *Gagal mendownload Facebook.*" }, { quoted: msg });
        }
      } catch (e) {
        await this.sock.sendMessage(jid, { text: "❌ *Terjadi kesalahan saat mendownload Facebook.*" }, { quoted: msg });
      }
    } else if (body.startsWith(".instagram ") || body.startsWith("instagram ") || body.startsWith(".ig ") || body.startsWith("ig ")) {
      const urlMatches = messageContent.match(/(https?:\\/\\/[^\\s]+)/g);
      if (!urlMatches) {
        await this.sock.sendMessage(jid, { text: "Link Instagram tidak ditemukan." }, { quoted: msg });
        return;
      }
      const url = urlMatches[0];
      await this.sock.sendMessage(jid, { text: "⏳ *Sedang mendownload Instagram...*" }, { quoted: msg });
      try {
        const igRes: any = await btch.igdl(url);
        if (igRes && igRes.length > 0 && igRes[0].url) {
          await this.sock.sendMessage(jid, { video: { url: igRes[0].url }, caption: \`✅ *Download Sukses*\` }, { quoted: msg });
        } else {
          await this.sock.sendMessage(jid, { text: "❌ *Gagal mendownload Instagram.*" }, { quoted: msg });
        }
      } catch (e) {
        await this.sock.sendMessage(jid, { text: "❌ *Terjadi kesalahan saat mendownload Instagram.*" }, { quoted: msg });
      }
    } else if (body === ".fotoanime" || body === "fotoanime") {
      await this.sock.sendMessage(jid, { text: "⏳ *Sedang mengambil foto anime random...*" }, { quoted: msg });
      try {
        const res = await axios.get("https://nekos.life/api/v2/img/waifu");
        if (res.data && res.data.url) {
          await this.sock.sendMessage(jid, { image: { url: res.data.url }, caption: \`🌸 *Foto Anime Random*\` }, { quoted: msg });
        } else {
          await this.sock.sendMessage(jid, { text: "❌ *Gagal mengambil foto.*" }, { quoted: msg });
        }
      } catch (e) {
        await this.sock.sendMessage(jid, { text: "❌ *Terjadi kesalahan saat mengambil foto anime.*" }, { quoted: msg });
      }
`;

if (code.includes('} else if (body.startsWith(".pinterest ") || body.startsWith("pinterest ")) {')) {
  code = code.replace(
    /    \} else if \(body\.startsWith\("\.pinterest "\) \|\| body\.startsWith\("pinterest "\)\) \{/,
    handlers + "\n    } else if (body.startsWith(\".pinterest \") || body.startsWith(\"pinterest \")) {"
  );
  fs.writeFileSync('src/services/whatsapp.ts', code);
  console.log("Patched successfully!");
} else {
  console.log("Target string not found!");
}

