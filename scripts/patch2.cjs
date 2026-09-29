const fs = require('fs');
let content = fs.readFileSync('src/utils/calculations.ts', 'utf-8');

let newContent = content;

newContent = newContent.replace(
  /const trolleyDemandPerHour = part\.manualHourlyBinsOverride !== undefined \n\s*\? part\.manualHourlyBinsOverride \n\s*: \(part\.hourlyTrolleysRequired !== undefined \? part\.hourlyTrolleysRequired : calculatedTrolleyDemand\);/m,
  "const trolleyDemandPerHour = part.manualHourlyBinsOverride !== undefined ? part.manualHourlyBinsOverride : calculatedTrolleyDemand;"
);

// Fallback if formatting was different
newContent = newContent.replace(
  /: \(part\.hourlyTrolleysRequired !== undefined \? part\.hourlyTrolleysRequired : calculatedTrolleyDemand\);/g,
  ": calculatedTrolleyDemand;"
);

newContent = newContent.replace(
  /: \(part\.hourlyTrolleysRequired !== undefined \? Number\(\(part\.hourlyTrolleysRequired \* 8\.0\)\.toFixed\(2\)\) : calculatedShiftTrolleysReq\);/g,
  ": calculatedShiftTrolleysReq;"
);

newContent = newContent.replace(
  /\|\| part\.hourlyTrolleysRequired !== undefined/g,
  ""
);

newContent = newContent.replace(
  /if \(p\.hourlyTrolleysRequired !== undefined\) \{\s*return p\.hourlyTrolleysRequired;\s*\}/g,
  ""
);

fs.writeFileSync('src/utils/calculations.ts', newContent);
console.log("Replaced calculations.ts length:", newContent.length);
