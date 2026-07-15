const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const downloadMenuHtml = `
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-green-500/20 p-2 rounded-lg text-green-400 mt-1"><Download className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.downloadmenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Download Tiktok, TiktokAudio, Youtube MP3/MP4, Capcut, FB, IG, Pinterest, dll.</p>
                  </div>
                </div>`;

code = code.replace(
  /<div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">\s*<div className="bg-rose-500\/20 p-2 rounded-lg text-rose-400 mt-1"><Video className="w-5 h-5" \/><\/div>\s*<div>\s*<h3 className="font-semibold text-white text-sm">\.videomenu<\/h3>/,
  downloadMenuHtml + '\n                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">\n                  <div className="bg-rose-500/20 p-2 rounded-lg text-rose-400 mt-1"><Video className="w-5 h-5" /></div>\n                  <div>\n                    <h3 className="font-semibold text-white text-sm">.videomenu</h3>'
);

fs.writeFileSync('src/pages/Dashboard.tsx', code);
