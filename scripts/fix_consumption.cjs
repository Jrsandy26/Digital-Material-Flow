const fs = require('fs');
let content = fs.readFileSync('src/components/features/swct/SWCTDashboard.tsx', 'utf-8');

const regex = /const rowData = \{\s*id: group\.milkRunId,\s*operation: partsSummary,\s*pickTime: pickSec,\s*consumption: Math\.round\(\(group\.materials\[0\]\?\.minSafetyCoverageHours \|\| 1\) \* 60\),\s*emptyTime: totalUnloadSec \+ totalEmptySec \+ totalDropSec,[\s\S]*?steps\.push\(rowData\);\s*\}\);\s*return steps;\s*\}, \[combinedGroups, modeConfigs\]\);/m;

const replacement = `let calculatedConsumptionMin = 0;
      
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
        consumption: Number(calculatedConsumptionMin.toFixed(2)), 
        emptyTime: totalUnloadSec + totalEmptySec + totalDropSec, 
        startTimeSec: cumulativeSec,
        steps: [
          { type: 'Manual', duration: pickSec, label: 'Loading' },
          { type: 'Walking', duration: travelLoadedSec, label: 'Moving to POC' },
          { type: 'Manual', duration: totalUnloadSec, label: 'Unloading' },
          { type: 'Manual', duration: totalEmptySec, label: 'Empty Pick' },
          { type: 'Walking', duration: travelEmptySec, label: 'Moving to Store' },
          { type: 'Manual', duration: totalDropSec, label: 'Empty Drop' }
        ]
      };
      
      cumulativeSec += pickSec + travelLoadedSec + totalUnloadSec + totalEmptySec + travelEmptySec + totalDropSec;
      
      steps.push(rowData);
    });

    return steps;
  }, [combinedGroups, modeConfigs, productionPlan.taktTimeSeconds]);`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/components/features/swct/SWCTDashboard.tsx', content);
