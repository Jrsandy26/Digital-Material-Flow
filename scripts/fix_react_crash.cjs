const fs = require('fs');
let content = fs.readFileSync('src/components/features/swct/SWCTDashboard.tsx', 'utf-8');

// For excel export
content = content.replace(
  "'Life/Consumption (m)': row.consumption,",
  "'Life/Consumption (m)': row.consumption.map(c => c.mins).join(' + '),"
);

// For the table render
content = content.replace(
  "<td className=\"px-2 text-center font-mono text-slate-600 dark:text-slate-400\">{row.consumption}m</td>",
  "<td className=\"px-2 text-center font-mono text-slate-600 dark:text-slate-400\">{row.consumption.map(c => c.mins).join(' + ')}m</td>"
);

fs.writeFileSync('src/components/features/swct/SWCTDashboard.tsx', content);
