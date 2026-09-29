const fs = require('fs');

let content = fs.readFileSync('src/components/features/swct/SWCTDashboard.tsx', 'utf-8');

const regex = /\/\/ 3\. Define the steps for the full Mizusumashi cycle sequential visualization[\s\S]*?return steps;\n  \}, \[combinedGroups, modeConfigs\]\);/m;

const replacement = `// 3. Define the steps for the full Mizusumashi cycle sequential visualization
  const swctCycleSteps = useMemo(() => {
    const steps: any[] = [];
    let cumulativeSec = 0;
    
    combinedGroups.forEach((group, gIdx) => {
      const trolleys = group.capacityUsed;
      const config = modeConfigs[group.transportMode] || {
        loadSpeedSecPerMtr: 0.72,
        emptySpeedSecPerMtr: 0.72,
        pickTimeSec: 10,
        storingTimeSec: 10,
        emptyHandlingTimeSec: 10,
        emptyDropTimeSec: 10,
      };
      const loadSpeed = (config as any).loadSpeedSecPerMtr || 0.72;
      const emptySpeed = (config as any).emptySpeedSecPerMtr || 0.72;
      const pickTimeBase = config.pickTimeSec ?? 10;
      const storeTimeBase = config.storingTimeSec ?? 10;
      const emptyTimeBase = config.emptyHandlingTimeSec ?? 10;
      const emptyDropTimeBase = (config as any).emptyDropTimeSec ?? 10;

      // 1. Sort materials by distance to simulate multi-stop routing
      const sortedMats = [...group.materials].sort((a, b) => 
        (a.loadedDistanceMeters || 0) - (b.loadedDistanceMeters || 0)
      );

      let travelLoadedSec = 0;
      let travelEmptySec = 0;
      let totalUnloadSec = 0;
      let totalEmptySec = 0;

      // 2. Calculate multi-stop travel
      if (sortedMats.length > 0) {
        travelLoadedSec += Math.round((sortedMats[0].loadedDistanceMeters || 120) * loadSpeed);
        for (let i = 0; i < sortedMats.length - 1; i++) {
          const distBetween = Math.abs((sortedMats[i+1].loadedDistanceMeters || 120) - (sortedMats[i].loadedDistanceMeters || 120));
          const effectiveDist = Math.max(distBetween, 25); 
          travelLoadedSec += Math.round(effectiveDist * loadSpeed);
        }
        const lastDist = sortedMats[sortedMats.length - 1].returnDistanceMeters || 120;
        travelEmptySec = Math.round(lastDist * emptySpeed);
      }

      // 3. Handling Times
      const pickSec = Math.round(pickTimeBase * group.capacityUsed);
      
      group.materialAllocations.forEach(ma => {
        totalUnloadSec += Math.round(storeTimeBase * ma.trolleys);
        totalEmptySec += Math.round(emptyTimeBase * ma.trolleys);
      });

      // 4. Empty Drop at Stores (Finalizing cycle)
      const totalDropSec = Math.round(emptyDropTimeBase * group.capacityUsed);

      const partsSummary = group.materialAllocations.map(ma => {
        const fullDesc = (ma.part.description || ma.part.partNo).trim();
        return \`\${fullDesc} (\${ma.trolleys})\`;
      }).join(' & ');

      // Grouped Data for Table
      const rowData = {
        id: group.milkRunId,
        operation: partsSummary,
        pickTime: pickSec,
        consumption: Math.round((group.materials[0]?.minSafetyCoverageHours || 1) * 60), 
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
  }, [combinedGroups, modeConfigs]);`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/components/features/swct/SWCTDashboard.tsx', content);
