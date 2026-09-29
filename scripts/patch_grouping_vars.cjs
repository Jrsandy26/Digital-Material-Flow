const fs = require('fs');
let content = fs.readFileSync('src/utils/calculations.ts', 'utf-8');

const regex2 = /\/\/ Each planned trip runs exactly once per hour to meet demands[\s\S]*?const freqMins = 60\.0;/m;

const repl2 = `// Each planned trip runs exactly once per shift now
      const tripsShift = 1;
      const tripsHr = 1 / 8;
      const tripsDay = 2;
      const freqMins = tripsData.length > 0 ? Number((480 / tripsData.length).toFixed(1)) : 60.0;`;

content = content.replace(regex2, repl2);

// Also need to fix nonJumboParts!
const regex3 = /const tripsHr = 1;\s*const tripsShift = 8;\s*const tripsDay = 16;\s*const freqMins = 60\.0;/g;

const repl3 = `const tripsShift = 1;
      const tripsHr = 1 / 8;
      const tripsDay = 2;
      const freqMins = 480; // If one trip per shift, freq is 8 hours!`;

content = content.replace(regex3, repl3);

fs.writeFileSync('src/utils/calculations.ts', content);
console.log("Updated MilkRunGroup trip frequencies");
