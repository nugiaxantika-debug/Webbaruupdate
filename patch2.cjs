const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

code = code.replace(
  /<div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">\n\s*<div className="bg-pink-500\/20 p-2 rounded-lg text-pink-400 mt-1"><MessageCircle className="w-5 h-5" \/><\/div>\n\s*<div>\n\s*<h3 className="font-semibold text-white text-sm">\.funmenu<\/h3>/,
  `<div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-sky-500/20 p-2 rounded-lg text-sky-400 mt-1"><MessageCircle className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.kristenmenu</h3>
                    <p className="text-xs text-neutral-400 mt-1">Menu khusus Kristen (Ayatalkitab, doaayat, kisahyesus, jadwalgereja, namakitab).</p>
                  </div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-start gap-4">
                  <div className="bg-pink-500/20 p-2 rounded-lg text-pink-400 mt-1"><MessageCircle className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">.funmenu</h3>`
);

fs.writeFileSync('src/pages/Dashboard.tsx', code);
