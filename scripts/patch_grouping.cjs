const fs = require('fs');
let content = fs.readFileSync('src/utils/calculations.ts', 'utf-8');

const regex1 = /const getReferenceTrolleyDemand = \(p: PartMaster\): number => \{[\s\S]*?return Math\.max\(1, Math\.round\(\(productionPlan\.hourlyPlanVehicles \* usage\) \/ binCap\)\);\s*\};/m;

const repl1 = `const getReferenceTrolleyDemand = (p: PartMaster): number => {
    if (p.manualHourlyBinsOverride !== undefined) {
      return p.manualHourlyBinsOverride;
    }
    const metrics = calculatePartMetrics(p, productionPlan.hourlyPlanVehicles, productionPlan.hourlyPlanVehicles * 8, customModeConfigs);
    if (metrics.netShiftTrolleysReq <= 0) return 0;
    return Math.ceil(metrics.netShiftTrolleysReq / 8);
  };`;

content = content.replace(regex1, repl1);

const regex2 = /let tripsData: Array<\{[\s\S]*?groups = tripsData\.map\(\(td, index\) => \{/m;

const repl2 = `let tripsData: Array<{ parts: Array<{ part: PartMaster; loadQty: number }> }> = [];

    // Filter out parts with 0 demand
    const validDemands = partDemands.filter(pd => pd.demand > 0);
    const requiredTrips = Math.ceil(validDemands.reduce((sum, pd) => sum + pd.demand, 0) / capacity);

    if (requiredTrips > 0) {
      // General deterministic bin-packing algorithm to perfectly space parts across trips
      const trips: Array<Array<{ part: PartMaster; loadQty: number }>> = Array.from(
        { length: requiredTrips },
        () => []
      );

      const sortedParts = [...validDemands].sort((a, b) => b.demand - a.demand);
      
      sortedParts.forEach(pd => {
        const demandToPlace = pd.demand;
        const interval = requiredTrips / demandToPlace;
        
        for (let k = 0; k < demandToPlace; k++) {
          const idealIdx = Math.floor(k * interval);
          
          for(let offset = 0; offset < requiredTrips; offset++) {
             let forwardIdx = (idealIdx + offset) % requiredTrips;
             let tripF = trips[forwardIdx];
             let currentTrolleysF = tripF.reduce((sum, p) => sum + p.loadQty, 0);
             
             if (currentTrolleysF < capacity) {
                 const existing = tripF.find(p => p.part.partNo === pd.part.partNo);
                 if (existing) existing.loadQty += 1;
                 else tripF.push({ part: pd.part, loadQty: 1 });
                 break;
             }
          }
        }
      });
      tripsData = trips.map(t => ({ parts: t }));
    }

    // Format the finalized trips into MilkRunGroup items
    groups = tripsData.map((td, index) => {`;

content = content.replace(regex2, repl2);

fs.writeFileSync('src/utils/calculations.ts', content);
console.log("Successfully replaced grouping logic.");
