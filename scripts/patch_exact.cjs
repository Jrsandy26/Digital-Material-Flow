const fs = require('fs');

// Patch PartMaster.tsx
let partMasterContent = fs.readFileSync('src/components/features/parts/PartMaster.tsx', 'utf-8');
partMasterContent = partMasterContent.replace(
  /\(\{metrics\.trolleyReqPerHour\.toFixed\(1\)\} exact\/hr\)/g,
  "({metrics.trolleyDemandPerHour.toFixed(1)} exact/hr)"
);
fs.writeFileSync('src/components/features/parts/PartMaster.tsx', partMasterContent);

// Patch ProductionPlanning.tsx
let prodPlanContent = fs.readFileSync('src/components/features/planning/ProductionPlanning.tsx', 'utf-8');
prodPlanContent = prodPlanContent.replace(
  /\(\{m\.trolleyReqPerHour\} exact\)/g,
  "({m.trolleyDemandPerHour.toFixed(1)} exact)"
);
fs.writeFileSync('src/components/features/planning/ProductionPlanning.tsx', prodPlanContent);

console.log("Replaced exact label display");
