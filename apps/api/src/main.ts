import 'dotenv/config';
import { buildServer } from './server.js';

const PORT = Number(process.env.PORT ?? 3001);

buildServer()
  .then((app) => app.listen({ port: PORT, host: '0.0.0.0' }))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
