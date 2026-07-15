const fs = require('fs');
let code = fs.readFileSync('src/services/whatsapp.ts', 'utf8');

const oldText = "const downloadText = `📥 *Download Menu*\\n\\n│ .tiktok - download video dari link tiktok VT\\n│ .playyt - mencari dan mendownload audio/video Youtube\\n│ .fotosexy - ambil foto random\\n│ .pinterest - download foto pinterest`;";
const newText = "const downloadText = `📥 *Download Menu*\\n\\n│ .tiktok - download video dari link tiktok VT\\n│ .tiktokaudiomp3 - download audio dari tiktok\\n│ .playyt - mencari dan mendownload audio Youtube\\n│ .playytmp4 - mencari dan mendownload video Youtube\\n│ .capcut - download template capcut\\n│ .facebook - download video/reels facebook\\n│ .instagram - download reels instagram\\n│ .fotoanime - ambil foto anime random\\n│ .fotosexy - ambil foto random\\n│ .pinterest - download foto pinterest`;";

if (code.includes("│ .playyt - mencari dan mendownload audio/video Youtube")) {
    console.log("Found old text");
    // We will just do a string replace of the block.
    // Replace using regex that matches the string format exactly
    code = code.replace(/const downloadText = `📥 \*Download Menu\*[\s\S]*?│ \.pinterest - download foto pinterest`;/m, newText);
    fs.writeFileSync('src/services/whatsapp.ts', code);
} else {
    console.log("Old text not found");
}

