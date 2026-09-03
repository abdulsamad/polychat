interface Env {
  API_ORIGIN?: string;
  LAMBDA_PROXY_SECRET?: string;
}

type PagesFunction = (context: {
  request: Request;
  env: Env;
  params: { path?: string[] };
}) => Promise<Response>;

const handler: PagesFunction = async ({ request, env, params }) => {
  if (!env.API_ORIGIN || !env.LAMBDA_PROXY_SECRET) {
    return Response.json({ err: 'API proxy is not configured.' }, { status: 500 });
  }

  const origin = new URL(env.API_ORIGIN);
  const path = params.path?.join('/') || '';
  origin.pathname = `${origin.pathname.replace(/\/$/, '')}/${path}`;

  const proxyRequest = new Request(origin, request);
  proxyRequest.headers.delete('host');
  proxyRequest.headers.set('x-polychat-proxy-secret', env.LAMBDA_PROXY_SECRET);

  try {
    // Returning the upstream Response directly preserves Lambda's streamed body.
    // Pass the Pages request signal explicitly so cancelling the browser fetch
    // also cancels this proxy fetch and closes the upstream connection when
    // the runtime supports disconnect propagation.
    return await fetch(proxyRequest, { signal: request.signal });
  } catch (error) {
    // A client cancellation is expected and should not be turned into a new
    // response. For an upstream failure before headers arrive, provide the
    // same error shape used by the API so the client can show its failover UI.
    if (request.signal.aborted) throw error;

    console.error('[API_PROXY] Lambda request failed:', error);
    return Response.json(
      {
        success: false,
        err: 'The chat service is temporarily unavailable. You can continue using your own API keys.',
      },
      { status: 502 }
    );
  }
};

export const onRequest: PagesFunction = handler;
