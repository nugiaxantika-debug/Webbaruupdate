import fs from 'fs';

let content = fs.readFileSync('src/pages/Landing.tsx', 'utf-8');

const replacements = {
  "bg-neutral-950": "bg-neutral-50 dark:bg-neutral-950",
  "text-neutral-200": "text-neutral-800 dark:text-neutral-200",
  "bg-neutral-950/80": "bg-white/80 dark:bg-neutral-950/80",
  "text-white": "text-neutral-900 dark:text-white",
  "text-neutral-400": "text-neutral-600 dark:text-neutral-400",
  "text-neutral-300": "text-neutral-700 dark:text-neutral-300",
  "border-white/5": "border-black/5 dark:border-white/5",
  "bg-neutral-900/50": "bg-neutral-100/50 dark:bg-neutral-900/50",
  "border-neutral-800": "border-neutral-300 dark:border-neutral-800",
  "bg-neutral-800": "bg-neutral-200 dark:bg-neutral-800",
  "bg-neutral-900": "bg-white dark:bg-neutral-900",
  "bg-neutral-950/50": "bg-neutral-50/50 dark:bg-neutral-950/50",
  "text-neutral-950": "text-white dark:text-neutral-950",
  "bg-black/80": "bg-neutral-500/80 dark:bg-black/80"
};

const sortedKeys = Object.keys(replacements).sort((a,b) => b.length - a.length);

for (const key of sortedKeys) {
  // Be careful with slashes
  const regex = new RegExp(`(?<!dark:)${key.replace(/\//g, '\\/')}`, 'g');
  content = content.replace(regex, replacements[key]);
}

content = content.replace('import { Smartphone', 'import { Moon, Sun, Smartphone');
content = content.replace('const [isRegisterMode, setIsRegisterMode] = useState(false);', 'const [isRegisterMode, setIsRegisterMode] = useState(false);\n  const [isDarkMode, setIsDarkMode] = useState(true);');

// The main wrapper replacement
content = content.replace(
  '<div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 font-sans">',
  '<div className={`min-h-screen font-sans ${isDarkMode ? "dark" : ""}`}>\n      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 transition-colors">'
);

// We must also close that extra div at the bottom
// wait, we can just replace `<div className={`min-h-screen ...` instead if we just replace it differently
// Let's do:

content = content.replace(
  '<div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 font-sans">',
  '<div className={`min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 font-sans ${isDarkMode ? "dark" : ""}`}>'
);

// Insert toggle button into Navbar
const toggleButton = `
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl bg-neutral-200 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <span className="text-xl font-bold`;

content = content.replace('<span className="text-xl font-bold', toggleButton);

// Or more safely: we can place the button inside a container in the navbar.
// Let's find "</div>" just before </nav> and insert it there.
// We have:
//         <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
//           <div className="flex items-center gap-3">
//             ...
//           </div>
//         </div>
//       </nav>

// Instead of string replacement for navbar, we will manually edit the file.

fs.writeFileSync('src/pages/Landing.tsx_new', content);
