const fs = require('fs');

let content = fs.readFileSync('src/components/features/swct/MisuzumashiChart.tsx', 'utf-8');

const regex = /\}\);\s*\}\)\(\)\}\s*<\/div>\s*\)\};\s*\}\)\(\)\}\s*<\/div>\s*\)\}\s*<\/div>\s*<\/div>\s*\);\s*\}\)}\s*<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\};\s*export default MisuzumashiChart;/m;

content = content.replace(regex, `
                         return elements;
                       })()}
                     </div>
                   )}
                 </div>
               </div>
             );
          })}
        </div>
      </div>
    </div>
  );
};

export default MisuzumashiChart;
`);

fs.writeFileSync('src/components/features/swct/MisuzumashiChart.tsx', content);
