// Cloud saves: one JSON save per account, with a version number so two devices
// can't silently overwrite each other. A stale write gets a 409 with the current
// save, and the client merges and retries.

const MAX_BYTES = 256 * 1024;

export async function handleSave(store, user, method, body = {}) {
  if (!user) return { status: 401, json: { error: 'signed_out', message: 'Sign in to save to the cloud.' } };

  if (method === 'GET') {
    const save = await store.get(user.id);
    return { status: 200, json: save || { data: null, version: 0, updatedAt: null } };
  }

  if (method === 'PUT' || method === 'POST') {
    const data = body?.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { status: 400, json: { error: 'bad_save', message: 'Save data is missing.' } };
    }
    if (JSON.stringify(data).length > MAX_BYTES) {
      return { status: 413, json: { error: 'too_big', message: 'That save is too large.' } };
    }
    const base = Number.isInteger(body.baseVersion) ? body.baseVersion : 0;
    const res = await store.put(user.id, data, base, body.force === true);
    if (res.ok) return { status: 200, json: { version: res.version, updatedAt: res.updatedAt } };
    return { status: 409, json: { error: 'conflict', message: 'This save changed on another device.', current: res.current } };
  }

  return { status: 405, json: { error: 'method', message: 'Use GET or PUT.' } };
}
