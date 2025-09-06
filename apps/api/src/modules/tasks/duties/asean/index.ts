import type { FastifyInstance } from 'fastify';
import idBtkiRoutes from './id-btki-routes.js';
import idDutyRoutes from './id-routes.js';
import myDutyRoutes from './my-routes.js';
import phDutyRoutes from './ph-routes.js';
import sgDutyRoutes from './sg-routes.js';
import thDutyRoutes from './th-routes.js';
import vnDutyRoutes from './vn-routes.js';
import myDutyRoutesOfficial from './my-routes-official.js';

export default function aseanDutyRoutes(app: FastifyInstance) {
  idBtkiRoutes(app);
  idDutyRoutes(app);
  myDutyRoutes(app);
  myDutyRoutesOfficial(app);
  phDutyRoutes(app);
  sgDutyRoutes(app);
  thDutyRoutes(app);
  vnDutyRoutes(app);
}
