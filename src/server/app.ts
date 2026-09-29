import express, { Express } from 'express';

export function createExpressApp(): Express {
  const app = express();

  app.use(express.json());

  // API Endpoints
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      system: 'Digital Material Flow Planning & Line Feeding System',
      plant: 'Two-Wheeler Assembly Facility #01',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/production/plan', (req, res) => {
    res.json({
      taktTimeSeconds: 27.4,
      shiftTargetVehicles: 1050,
      hourlyTargetVehicles: 131.25,
      activeShift: 'Shift 1 (07:00 - 15:30)',
    });
  });

  app.post('/api/simulation/calculate', (req, res) => {
    const { parts, hourlyPlanVehicles, shiftPlanVehicles } = req.body;
    if (!parts || !Array.isArray(parts)) {
      return res.status(400).json({ error: 'Parts array required' });
    }

    const calculated = parts.map((part: any) => {
      const usage = part.usagePerVehicle || 1;
      const hourlyConsumption = (hourlyPlanVehicles || 131) * usage;
      const shiftConsumption = (shiftPlanVehicles || 1050) * usage;
      const binCap = part.binCapacity || 10;
      const trolleyReqPerHour = Number((hourlyConsumption / binCap).toFixed(2));
      const roundedQuantity = Math.ceil(trolleyReqPerHour) * binCap;
      const tripsRequired = Math.ceil(shiftConsumption / binCap);

      return {
        partNo: part.partNo,
        hourlyConsumption,
        shiftConsumption,
        trolleyReqPerHour,
        roundedQuantity,
        tripsRequired,
      };
    });

    res.json({ calculated });
  });

  return app;
}

export const app = createExpressApp();
