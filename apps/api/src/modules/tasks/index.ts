import type { FastifyInstance } from 'fastify';

import fxRoutes from './fx-routes.js';
import vatRoutes from './vat-routes.js';
import ukDutyRoutes from './duties/uk-routes.js';
import euDutyRoutes from './duties/eu-routes.js';
import usDutyRoutes from './duties/us-routes.js';
import witsDutyRoutes from './duties/wits-routes.js';
import surchargeUsRoutes from './surcharges/us-routes.js';
import surchargeEuRoutes from './surcharges/eu-routes.js';
import surchargeUkRoutes from './surcharges/uk-routes.js';
import surchargeJsonRoute from './surcharges/generic-json.js';
import freightRoutes from './freight-routes.js';
import hsRoutes from './hs-routes.js';

export default function taskRoutes(app: FastifyInstance) {
  fxRoutes(app);
  vatRoutes(app);
  ukDutyRoutes(app);
  euDutyRoutes(app);
  usDutyRoutes(app);
  witsDutyRoutes(app);
  surchargeUsRoutes(app);
  surchargeEuRoutes(app);
  surchargeUkRoutes(app);
  surchargeJsonRoute(app);
  freightRoutes(app);
  hsRoutes(app);
}
