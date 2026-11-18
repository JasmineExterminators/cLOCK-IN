// Small helpers shared by the API routes.
export function body(req) {
  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { b = {}; }
  }
  return b || {};
}

export function send(res, { status, json }) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(json);
}

export async function run(res, fn) {
  try {
    send(res, await fn());
  } catch (e) {
    console.error('api error', e);
    send(res, { status: 500, json: { error: 'server_error', message: 'Something went wrong on our side. Try again.' } });
  }
}
