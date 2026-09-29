const capacity = 3;
const validDemands = [
  { partNo: 'F', demand: 88 },
  { partNo: 'W', demand: 32 },
  { partNo: 'S', demand: 16 },
  { partNo: 'L', demand: 16 },
  { partNo: 'B', demand: 16 },
];

const requiredTrips = Math.ceil(validDemands.reduce((sum, pd) => sum + pd.demand, 0) / capacity);
const trips = Array.from({ length: requiredTrips }, () => []);

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
           const existing = tripF.find(p => p.partNo === pd.partNo);
           if (existing) existing.loadQty += 1;
           else tripF.push({ partNo: pd.partNo, loadQty: 1 });
           break;
       }
    }
  }
});

let wastedSlots = 0;
trips.forEach((t, i) => {
  const load = t.reduce((s, p) => s + p.loadQty, 0);
  if (load < capacity) wastedSlots += (capacity - load);
  console.log(`Trip ${i+1}: ${t.map(p => `${p.partNo}(${p.loadQty})`).join(', ')} | Total: ${load}`);
});
console.log("Wasted Slots:", wastedSlots);
