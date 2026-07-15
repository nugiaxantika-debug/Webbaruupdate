const fs = require('fs');
let content = fs.readFileSync('src/services/whatsapp.ts', 'utf8');

const oldGameMenu = `            const gameText = \`🎮 *Game Menu*

│ .tebakgambar
│ .susunkata
│ .math
│ .tebakkata
│ .tebakbendera
│ .asahotak
│ .tebaklirik
│ .tekateki
│ .tebakangka
│ .kuis
│ .tebakkota
│ .family100
│ .tebakusia
│ .tebakkimia
│ .tebakbuah
│ .werewolf
│ .tebakuang
│ .tebaksurah
│ .tebakhewan
│ .tebakbaju
│ .tebakcelana
│ .tebakmakanan
│ .tebakjkt48\`;`;

const newGameMenu = `      const gameText = \`🎮 *Game Menu*\\n\\n| .tebakgambar\\n| .susunkata\\n| .math\\n| .tebakkata\\n| .tebakbendera\\n| .asahotak\\n| .tebaklirik\\n| .tekateki\\n| .tebakangka\\n| .kuis\\n| .tebakkota\\n| .family100\\n| .tebakusia\\n| .tebakkimia\\n| .tebakbuah\\n| .werewolf\\n| .tebakuang\\n| .tebaksurah\\n| .tebakhewan\\n| .tebakbaju\\n| .tebakcelana\\n| .tebakmakanan\\n| .tebakjkt48\`;`;

if (content.includes(oldGameMenu)) {
    content = content.replace(oldGameMenu, newGameMenu);
    fs.writeFileSync('src/services/whatsapp.ts', content);
    console.log("Updated gamemenu!");
} else {
    console.log("oldGameMenu not found, trying regex...");
    const regex = /const gameText = \`🎮 \*Game Menu\*[\s\S]*?\.tebakjkt48\`;/;
    if (regex.test(content)) {
        content = content.replace(regex, newGameMenu);
        fs.writeFileSync('src/services/whatsapp.ts', content);
        console.log("Updated gamemenu via regex!");
    } else {
        console.log("Still not found!");
    }
}
