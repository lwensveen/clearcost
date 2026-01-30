import 'dotenv/config';
import { buildInternalServer, buildPublicServer } from './server.js';

const PORT = Number(process.env.PORT ?? 3001);
const INTERNAL_PORT = Number(process.env.INTERNAL_PORT ?? 3002);
const INTERNAL_HOST = process.env.INTERNAL_HOST ?? '0.0.0.0';
const PUBLIC_HOST = process.env.HOST ?? '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const ALLOW_INTERNAL_BIND = process.env.ALLOW_INTERNAL_BIND === '1';

if (NODE_ENV === 'production') {
  if ((INTERNAL_HOST === '0.0.0.0' || INTERNAL_HOST === '::') && !ALLOW_INTERNAL_BIND) {
    throw new Error(
      'INTERNAL_HOST is set to a public bind in production. Set ALLOW_INTERNAL_BIND=1 to override.'
    );
  }

  if ((INTERNAL_HOST === '0.0.0.0' || INTERNAL_HOST === '::') && ALLOW_INTERNAL_BIND) {
    console.warn('ALLOW_INTERNAL_BIND=1 set in production: internal server is publicly bound.');
  }

  if (!process.env.TRUST_PROXY) {
    console.warn('TRUST_PROXY not set; trustProxy is disabled in production.');
  }
}

async function start() {
  const publicApp = await buildPublicServer();
  const internalApp = await buildInternalServer();

  await publicApp.listen({ port: PORT, host: PUBLIC_HOST });
  await internalApp.listen({ port: INTERNAL_PORT, host: INTERNAL_HOST });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
