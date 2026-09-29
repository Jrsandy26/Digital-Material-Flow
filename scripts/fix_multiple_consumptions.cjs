const fs = require('fs');
let content = fs.readFileSync('src/components/features/swct/SWCTDashboard.tsx', 'utf-8');

const target = `      let calculatedConsumptionMin = 0;
      
      group.materialAllocations.forEach(ma => {
        const binCap = ma.part.binCapacity || 1;
        const usage = ma.part.usagePerVehicle || 1;
        // consumption time for this allocation in minutes
        const allocConsumption = (ma.trolleys * binCap * productionPlan.taktTimeSeconds) / (usage * 60);
        calculatedConsumptionMin += allocConsumption;
      });

      // Grouped Data for Table
      const rowData = {
        id: group.milkRunId,
        operation: partsSummary,
        pickTime: pickSec,
        consumption: Number(calculatedConsumptionMin.toFixed(2)),`;

const replacement = `      const partConsumptions: {label: string, mins: number}[] = [];
      
      group.materialAllocations.forEach(ma => {
        const binCap = ma.part.binCapacity || 1;
        const usage = ma.part.usagePerVehicle || 1;
        const allocConsumption = (ma.trolleys * binCap * productionPlan.taktTimeSeconds) / (usage * 60);
        partConsumptions.push({
           label: ma.part.partNo,
           mins: Number(allocConsumption.toFixed(2))
        });
      });

      // Grouped Data for Table
      const rowData = {
        id: group.milkRunId,
        operation: partsSummary,
        pickTime: pickSec,
        consumption: partConsumptions,`;

content = content.replace(target, replacement);
fs.writeFileSync('src/components/features/swct/SWCTDashboard.tsx', content);
