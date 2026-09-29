const fs = require('fs');
let content = fs.readFileSync('src/components/features/swct/SWCTDashboard.tsx', 'utf-8');

// Replace tripsToShow to use hourGroups
content = content.replace(
  /const tripsToShow = useMemo\(\(\) => \{\s*return combinedGroups;\s*\}, \[combinedGroups\]\);/,
  `const tripsToShow = useMemo(() => {
    return hourGroups;
  }, [hourGroups]);`
);

// Add the Hour Selector UI below the KPI section
const kpiEndRegex = /<\/div>\s*\{\/\* MAIN CONTENT TABS \*\/\}/m;

const hourNavHtml = `
      {/* SHIFT HOUR SELECTION NAVBAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 md:p-5 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="text-sm font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
          Timeline Window
        </div>
        <div className="flex-1 w-full overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          <div className="flex items-center gap-2 min-w-max">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((hour) => {
              let label = '';
              const slots = productionPlan.hourlyBreakdown || [];
              if (slots[hour - 1]) {
                 label = slots[hour - 1].hourSlot;
              } else {
                 label = \`Hour \${hour}\`;
              }
              const isActive = selectedHour === hour;
              return (
                <button
                  key={hour}
                  onClick={() => setSelectedHour(hour)}
                  className={\`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap \${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }\`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* MAIN CONTENT TABS */}`;

content = content.replace(kpiEndRegex, hourNavHtml);

// Fix combinedGroups reference in the analytics tab table view
content = content.replace(
  /\{combinedGroups\.length\}/g,
  `{hourGroups.length}`
);
content = content.replace(
  /\{combinedGroups\.map\(\(mr, idx\) => \(/g,
  `{hourGroups.map((mr, idx) => (`
);


fs.writeFileSync('src/components/features/swct/SWCTDashboard.tsx', content);
console.log("Patched SWCT UI");
