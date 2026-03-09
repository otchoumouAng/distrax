const fs = require('fs');
const path = require('path');

const dir = 'e:\\Exo\\Distrax';
const htmlPath = path.join(dir, 'index.html');
let content = fs.readFileSync(htmlPath, 'utf8');

// 1. Extract CSS
const styleStart = content.indexOf('<style>');
const styleEnd = content.indexOf('</style>');
if (styleStart === -1 || styleEnd === -1) {
    console.error("No <style> block found.");
    process.exit(1);
}

const cssContent = content.substring(styleStart + 7, styleEnd).trim();

// Splitting CSS roughly based on markers
let vEnd = cssContent.indexOf('* {');
let variablesCss = cssContent.substring(0, vEnd);

let bEnd = cssContent.indexOf('/* --- HOME HERO --- */');
let baseCss = cssContent.substring(vEnd, bEnd);

let lEnd1 = cssContent.indexOf('/* --- SUGGESTIONS --- */');
let l1 = cssContent.substring(bEnd, lEnd1);

let cEnd1 = cssContent.indexOf('/* --- NAVIGATION FLOTTANTE --- */');
let c1 = cssContent.substring(lEnd1, cEnd1);

let lEnd2 = cssContent.indexOf('/* --- CARTES --- */');
let l2 = cssContent.substring(cEnd1, lEnd2);

let cEnd2 = cssContent.indexOf('/* --- RESPONSIVE MOBILE OPTIMISÉ --- */');
let c2 = cssContent.substring(lEnd2, cEnd2);

let l3 = cssContent.substring(cEnd2);

const variablesCssData = variablesCss;
const baseCssData = baseCss;
const layoutCssData = l1 + "\n" + l2 + "\n" + l3;
const componentsCssData = c1 + "\n" + c2;

fs.mkdirSync(path.join(dir, 'css'), { recursive: true });
fs.writeFileSync(path.join(dir, 'css', 'variables.css'), variablesCssData);
fs.writeFileSync(path.join(dir, 'css', 'base.css'), baseCssData);
fs.writeFileSync(path.join(dir, 'css', 'layout.css'), layoutCssData);
fs.writeFileSync(path.join(dir, 'css', 'components.css'), componentsCssData);

// Remove style tag and add module script tag instead (Vite style)
const newHtmlHead = content.substring(0, styleStart) + `
    <!-- Styles pris en charge via Vite dans main.js -->
` + content.substring(styleEnd + 8, content.indexOf('<script>'));

const moduleScript = `    <script type="module" src="/js/main.js"></script>\n`;

const newHtmlEnd = moduleScript + `</body>\n</html>`;

const finalHtml = newHtmlHead + newHtmlEnd;

fs.writeFileSync(htmlPath, finalHtml);

// Create other required directories
fs.mkdirSync(path.join(dir, 'public'), { recursive: true });
fs.mkdirSync(path.join(dir, 'assets', 'img'), { recursive: true });
fs.mkdirSync(path.join(dir, 'assets', 'icons'), { recursive: true });
fs.mkdirSync(path.join(dir, 'js', 'components'), { recursive: true });
fs.mkdirSync(path.join(dir, 'js', 'utils'), { recursive: true });

console.log("Refactoring complete.");
