const fs = require('fs');

let content = fs.readFileSync('src/components/features/swct/MisuzumashiChart.tsx', 'utf-8');

const regex = /\{rowData && \([\s\S]*?\}\)/m;

const replacement = `{rowData && (
                     <div className="absolute top-0 left-0 h-full w-full pointer-events-none px-[0.5px]">
                       {(() => {
                         let currentLeftMin = (rowData.startTimeSec || 0) / 60;
                         let unloadEndTimeMin = 0;
                         
                         const elements = rowData.steps.map((step, sIdx) => {
                           const durationMin = step.duration / 60;
                           const leftPercent = (currentLeftMin / maxTimeLine) * 100;
                           const widthPercent = (durationMin / maxTimeLine) * 100;
                           
                           if (step.label === 'Unloading') {
                             unloadEndTimeMin = currentLeftMin + durationMin;
                           }
                           
                           currentLeftMin += durationMin;
                           
                           if (leftPercent >= 100) return null;
                           const clampedWidth = Math.min(widthPercent, 100 - leftPercent);
                           
                           if (step.label === 'Loading' || step.label === 'Unloading') {
                             return (
                               <div key={sIdx} className="absolute h-full border-t-[8px] border-yellow-300 mt-[12px] shadow-[0_1px_1px_rgba(0,0,0,0.3)]" style={{ left: \`\${leftPercent}%\`, width: \`\${clampedWidth}%\` }}></div>
                             );
                           } else {
                             // Wavy blue line for moving and empty pick
                             return (
                               <div key={sIdx} className="absolute h-full flex items-center mt-0.5" style={{ left: \`\${leftPercent}%\`, width: \`\${clampedWidth}%\` }}>
                                  <svg className="w-full h-6" preserveAspectRatio="none" viewBox="0 0 100 24">
                                    <path d="M 0 12 Q 12 0, 25 12 T 50 12 T 75 12 T 100 12" fill="none" stroke="blue" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                                  </svg>
                               </div>
                             );
                           }
                         });
                         
                         // Add vertical drop to next row
                         if (rowIndex < swctCycleSteps.length - 1) {
                            const endPercent = (currentLeftMin / maxTimeLine) * 100;
                            if (endPercent < 100) {
                              elements.push(
                                <div key="drop" className="absolute h-[32px] border-l-[1.5px] border-black mt-[12px]" style={{ left: \`\${endPercent}%\` }}></div>
                              );
                            }
                         }

                         // Add Inventory dashed line
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
                         }
                         
                         return elements;
                       })()}
                     </div>
                   )}`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/components/features/swct/MisuzumashiChart.tsx', content);
