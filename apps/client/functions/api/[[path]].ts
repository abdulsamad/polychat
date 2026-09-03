interface Env {
  API_ORIGIN?: string;
}

type PagesFunction = (context: {
  request: Request;
  env: Env;
  params: { path?: string[] };
}) => Promise<Response>;

const handler: PagesFunction = async ({ request, env, params }) => {
  if (!env.API_ORIGIN) {
    return Response.json({ err: 'API proxy is not configured.' }, { status: 500 });
  }

  const origin = new URL(env.API_ORIGIN);
  const path = params.path?.join('/') || '';
  origin.pathname = `${origin.pathname.replace(/\/$/, '')}/${path}`;

  const proxyRequest = new Request(origin, request);
  proxyRequest.headers.delete('host');

  // Returning the upstream Response directly preserves Lambda's streamed body.
  return fetch(proxyRequest);
};

export const onRequest: PagesFunction = handler;
