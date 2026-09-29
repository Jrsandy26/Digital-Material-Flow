const fs = require('fs');
let content = fs.readFileSync('src/utils/calculations.ts', 'utf-8');

const regex1 = /const getReferenceTrolleyDemand = \(p: PartMaster\): number => \{[\s\S]*?return Math\.ceil\(metrics\.netShiftTrolleysReq \/ 8\);\s*\};/m;

const repl1 = `const getReferenceTrolleyDemand = (p: PartMaster): number => {
    const metrics = calculatePartMetrics(p, productionPlan.hourlyPlanVehicles, productionPlan.hourlyPlanVehicles * 8, customModeConfigs);
    
    // If the user manually provided an override, use that but scaled to the shift
    if (p.manualHourlyBinsOverride !== undefined) {
      return Math.round(p.manualHourlyBinsOverride * 8);
    }
    
    if (metrics.netShiftTrolleysReq <= 0) return 0;
    return Math.ceil(metrics.netShiftTrolleysReq);
  };`;

content = content.replace(regex1, repl1);

fs.writeFileSync('src/utils/calculations.ts', content);
console.log("Updated to Shift Demand");
