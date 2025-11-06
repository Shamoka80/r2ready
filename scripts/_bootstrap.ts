import 'dotenv/config';

// Hard fail on unhandled errors for CI-like determinism
process.on('unhandledRejection', (e) => { console.error(e); process.exit(1); });
process.on('uncaughtException', (e) => { console.error(e); process.exit(1); });

// Optional: echo key envs for visibility (mask sensitive sections)
const mask = (s?: string) => s ? (s.length > 8 ? s.slice(0,4) + '...' + s.slice(-4) : '****') : 'unset';
console.error('[env] NODE_ENV=', process.env.NODE_ENV || 'unset');
console.error('[env] DATABASE_URL=', mask(process.env.DATABASE_URL));
console.error('[env] JWT_SECRET=', mask(process.env.JWT_SECRET));
console.error('[env] JWT_ACTIVE_KID=', process.env.JWT_ACTIVE_KID || 'unset');
