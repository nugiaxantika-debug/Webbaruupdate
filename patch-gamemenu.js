const fs = require('fs');

let code = fs.readFileSync('src/services/whatsapp.ts', 'utf8');

code = code.replace(
  "│ .werewolf\" }, { quoted: msg });",
  "│ .werewolf\\n│ .tebakuang\\n│ .tebaksurah\\n│ .tebakhewan\\n│ .tebakbaju\\n│ .tebakcelana\" }, { quoted: msg });"
);

fs.writeFileSync('src/services/whatsapp.ts', code);
