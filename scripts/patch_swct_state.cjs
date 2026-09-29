const fs = require('fs');
let content = fs.readFileSync('src/components/features/swct/SWCTDashboard.tsx', 'utf-8');

const regex1 = /const \[selectedTripId, setSelectedTripId\] = useState<string>\(''\);/m;
const repl1 = `const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [selectedHour, setSelectedHour] = useState<number>(1);

  const hourGroups = useMemo(() => {
    const totalTrips = combinedGroups.length;
    if (totalTrips === 0) return [];
    
    const tripsPerHr = totalTrips / 8;
    const startIdx = Math.round((selectedHour - 1) * tripsPerHr);
    const endIdx = Math.round(selectedHour * tripsPerHr);
    
    return combinedGroups.slice(startIdx, endIdx);
  }, [combinedGroups, selectedHour]);`;
content = content.replace(regex1, repl1);

const regex2 = /combinedGroups\.forEach\(\(group, gIdx\) => \{/m;
const repl2 = `hourGroups.forEach((group, gIdx) => {`;
content = content.replace(regex2, repl2);

const regex3 = /const swctCycleSteps = useMemo\(\(\) => \{[\s\S]*?\}, \[combinedGroups, modeConfigs, productionPlan\.taktTimeSeconds\]\);/m;
content = content.replace(/\[combinedGroups, modeConfigs, productionPlan\.taktTimeSeconds\]\);/g, `[hourGroups, modeConfigs, productionPlan.taktTimeSeconds]);`);

fs.writeFileSync('src/components/features/swct/SWCTDashboard.tsx', content);
console.log("Patched SWCTDashboard state and steps");
