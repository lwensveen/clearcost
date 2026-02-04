import 'dotenv/config';
import { validateApiRuntimeEnv } from './lib/env.js';
import { buildInternalServer, buildPublicServer } from './server.js';

const env = validateApiRuntimeEnv();

if (env.nodeEnv === 'production') {
  if ((env.internalHost === '0.0.0.0' || env.internalHost === '::') && !env.allowInternalBind) {
    throw new Error(
      'INTERNAL_HOST is set to a public bind in production. Set ALLOW_INTERNAL_BIND=1 to override.'
    );
  }

  if ((env.internalHost === '0.0.0.0' || env.internalHost === '::') && env.allowInternalBind) {
    console.warn('ALLOW_INTERNAL_BIND=1 set in production: internal server is publicly bound.');
  }

  if (!env.trustProxy) {
    console.warn('TRUST_PROXY not set; trustProxy is disabled in production.');
  }

  if (!env.metricsRequireSigning) {
    console.warn('METRICS_REQUIRE_SIGNING=0 set in production: /metrics does not require signing.');
  }
}

async function start() {
  const publicApp = await buildPublicServer();
  const internalApp = await buildInternalServer();

  await publicApp.listen({ port: env.publicPort, host: env.publicHost });
  await internalApp.listen({ port: env.internalPort, host: env.internalHost });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
