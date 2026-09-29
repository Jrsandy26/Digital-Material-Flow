const fs = require('fs');
let content = fs.readFileSync('src/utils/calculations.ts', 'utf-8');

content = content.replace(
  /const totalTrolleys = partDemands\.reduce\(\(sum, pd\) => sum \+ pd\.demand, 0\);\s*const requiredTrips = Math\.ceil\(totalTrolleys \/ capacity\);/m,
  ''
);

fs.writeFileSync('src/utils/calculations.ts', content);
console.log("Fixed redeclaration");
