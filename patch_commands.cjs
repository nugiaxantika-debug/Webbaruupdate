const fs = require('fs');
let code = fs.readFileSync('src/services/whatsapp.ts', 'utf8');

code = code.replace(
  /const downloadCommands = \['\.downloadmenu', 'downloadmenu', '\.tiktok', 'tiktok', '\.playyt', 'playyt', '\.fotosexy', 'fotosexy', '\.pinterest', 'pinterest'\];/,
  `const downloadCommands = ['.downloadmenu', 'downloadmenu', '.tiktok', 'tiktok', '.tiktokaudiomp3', 'tiktokaudiomp3', '.playyt', 'playyt', '.playytmp4', 'playytmp4', '.capcut', 'capcut', '.facebook', 'facebook', '.instagram', 'instagram', '.fotosexy', 'fotosexy', '.fotoanime', 'fotoanime', '.pinterest', 'pinterest'];`
);

code = code.replace(
  /│ \.tiktok - download video dari link tiktok VT\\n│ \.playyt - mencari dan mendownload audio\/video Youtube\\n│ \.fotosexy - ambil foto random\\n│ \.pinterest - download foto pinterest/,
  `│ .tiktok - download video dari link tiktok VT\\n│ .tiktokaudiomp3 - download audio dari tiktok\\n│ .playyt - mencari dan mendownload audio Youtube\\n│ .playytmp4 - mencari dan mendownload video Youtube\\n│ .capcut - download template capcut\\n│ .facebook - download video/reels facebook\\n│ .instagram - download reels instagram\\n│ .fotoanime - ambil foto anime random\\n│ .fotosexy - ambil foto random\\n│ .pinterest - download foto pinterest`
);

fs.writeFileSync('src/services/whatsapp.ts', code);
