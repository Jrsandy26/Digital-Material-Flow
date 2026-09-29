const fs = require('fs');
let content = fs.readFileSync('src/components/features/swct/MisuzumashiChart.tsx', 'utf-8');

content = content.replace(
  "consumption: number;",
  "consumption: {label: string, mins: number}[];"
);

// We also need to update the JSX part where we render the consumption lines
const oldJsx = `// Add Inventory dashed line
                         if (unloadEndTimeMin > 0 && rowData.consumption) {
                            const invStartPercent = (unloadEndTimeMin / maxTimeLine) * 100;
                            const invWidthPercent = (rowData.consumption / maxTimeLine) * 100;
                            const clampedInvWidth = Math.min(invWidthPercent, 100 - invStartPercent);
                            if (invStartPercent < 100) {
                              elements.push(
                                <div key="inventory" className="absolute h-full border-t-[2px] border-red-500 border-dashed mt-[20px]" style={{ left: \`\${invStartPercent}%\`, width: \`\${clampedInvWidth}%\` }}>
                                  <div className="absolute right-0 top-[-6px] h-[10px] border-r-2 border-red-500"></div>
                                </div>
                              );
                              // Add text label for consumption time
                              elements.push(
                                <div key="inventory-text" className="absolute h-full mt-[20px] text-[9px] font-bold text-red-600 pl-1" style={{ left: \`\${invStartPercent + clampedInvWidth}%\` }}>
                                  {rowData.consumption} mins
                                </div>
                              );
                            }
                         }`;

const newJsx = `// Add Inventory dashed lines for each part
                         if (unloadEndTimeMin > 0 && rowData.consumption && rowData.consumption.length > 0) {
                            rowData.consumption.forEach((cons, cIdx) => {
                               const invStartPercent = (unloadEndTimeMin / maxTimeLine) * 100;
                               const invWidthPercent = (cons.mins / maxTimeLine) * 100;
                               const clampedInvWidth = Math.min(invWidthPercent, 100 - invStartPercent);
                               
                               // Slightly offset multiple lines vertically so they are distinguishable
                               const yOffset = 20 + (cIdx * 5); 
                               
                               if (invStartPercent < 100) {
                                 elements.push(
                                   <div key={\`inventory-\${cIdx}\`} className="absolute h-full border-t-[2px] border-red-500 border-dashed" style={{ left: \`\${invStartPercent}%\`, width: \`\${clampedInvWidth}%\`, marginTop: \`\${yOffset}px\` }}>
                                     <div className="absolute right-0 top-[-6px] h-[10px] border-r-2 border-red-500"></div>
                                   </div>
                                 );
                                 // Add text label for consumption time
                                 elements.push(
                                   <div key={\`inventory-text-\${cIdx}\`} className="absolute h-full text-[9px] font-bold text-red-600 pl-1" style={{ left: \`\${invStartPercent + clampedInvWidth}%\`, marginTop: \`\${yOffset - 2}px\` }}>
                                     {cons.mins} mins
                                   </div>
                                 );
                               }
                            });
                         }`;
                         
content = content.replace(oldJsx, newJsx);

// We also need to update the consumption column text display
const oldConsDisp = `{rowData ? rowData.consumption : ''}`;
const newConsDisp = `{rowData ? rowData.consumption.map(c => c.mins).join(' + ') : ''}`;
content = content.replace(oldConsDisp, newConsDisp);

fs.writeFileSync('src/components/features/swct/MisuzumashiChart.tsx', content);
