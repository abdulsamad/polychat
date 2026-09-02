import { Hono } from 'hono';
import {
  handle,
  streamHandle,
  type LambdaEvent,
  ApiGatewayRequestContextV2,
} from 'hono/aws-lambda';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { type JWTPayload } from 'jose';

import chat from '@controllers/chat';
import image from '@controllers/image';
import { authMiddleware } from '@middlewares/index';

import type { User } from '@types';

export type AppContext = {
  Bindings: {
    event: LambdaEvent;
    requestContext: ApiGatewayRequestContextV2;
  };
  Variables: {
    user: Pick<User, 'id'>;
    payload: JWTPayload;
  };
};

export const app = new Hono<AppContext>();

const allowedOrigins = (process.env.CLERK_AUTHORIZED_PARTIES || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  '*',
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : undefined),
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
  })
);

app.get('/', (c) => c.text('Hono + Lambda + AI'));

app.use(logger());
app.use(authMiddleware);

app.post('/chat', chat);
app.post('/image', image);

// `streamHandle` accesses the Lambda-provided `awslambda` global immediately.
// Keep the app importable by the native local streaming server.
export const handler = process.env.AWS_LAMBDA_FUNCTION_NAME ? streamHandle(app) : undefined;

// API Gateway/SAM local adapter. The production Function URL uses streaming;
// API Gateway local emulation expects a standard Lambda proxy response.
export const apiHandler = handle(app);
