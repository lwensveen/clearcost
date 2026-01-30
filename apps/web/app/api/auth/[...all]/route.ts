import { getAuth } from '@/auth';
import { toNextJsHandler } from 'better-auth/next-js';

const handler = () => toNextJsHandler(getAuth().handler);

export const GET = (req: Request) => handler().GET(req as never);
export const POST = (req: Request) => handler().POST(req as never);
