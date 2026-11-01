const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(indexPath, 'utf-8');

const regex = /<div\s+class="mod-card"\s+data-gama="([^"]+)"([^>]*)>/g;

let count = 0;
content = content.replace(regex, (match, gama, rest) => {
    if (match.includes('data-engine=')) {
        return match;
    }

    let ram = '2GB RAM';
    if (gama === 'mid') ram = '3GB RAM';
    if (gama === 'mid-high' || gama === 'high') ram = '4GB RAM';

    count++;
    return `<div class="mod-card" data-gama="${gama}" data-engine="Psych Engine" data-ram="${ram}" data-size="300 MB"${rest}>`;
});

fs.writeFileSync(indexPath, content, 'utf-8');
console.log(`Updated ${count} mod cards with data-engine, data-ram, and data-size.`);
