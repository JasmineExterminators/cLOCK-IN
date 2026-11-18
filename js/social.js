// Friends: everyone on this shared cLOCK IN page publishes a small public
// "place" card (home, car, title, hours, whether they're on the clock).
//
// Backend: the claude.ai artifact database (claude.use('db') + 'user').
// Each person writes only places/<their id>; everyone reads all places.
// When the page runs somewhere without that backend (e.g. Vercel, local),
// connect() resolves null and the Friends page explains what's missing.
// To move to another backend later, reimplement connect() with the same
// return shape: { me, publish(card), subscribe(onCards, onError), names(ids) }.

const COLLECTION = 'places';

export async function connect() {
  const c = typeof window !== 'undefined' ? window.claude : null;
  if (!c || typeof c.use !== 'function') return null;
  let db, user;
  try {
    [db, user] = await Promise.all([c.use('db'), c.use('user')]);
  } catch {
    return null;
  }
  if (!db || !user) return null;
  let me = null;
  try { me = await user.id(); } catch {}
  if (!me) return null;

  let lastJson = '';
  let writing = Promise.resolve();
  let canWrite = true;

  return {
    me,
    get canWrite() { return canWrite; },

    // Write my card only when it actually changed; one write at a time.
    publish(card) {
      const json = JSON.stringify(card);
      if (json === lastJson || !canWrite) return writing;
      lastJson = json;
      writing = writing
        .then(() => db.collection(COLLECTION).doc(me).set(card))
        .catch((e) => {
          if (e && e.code === 'invalid_argument') canWrite = false;
          lastJson = '';
        });
      return writing;
    },

    subscribe(onCards, onError) {
      return db.collection(COLLECTION).onSnapshot(
        (snap) => onCards(snap.docs.filter((d) => d.exists).map((d) => ({ id: d.id, ...d.data() })), snap.metadata),
        (e) => onError && onError(e),
      );
    },

    async names(ids) {
      try {
        const ps = await user.profiles(ids);
        const out = {};
        for (const id of ids) out[id] = (ps && ps[id] && ps[id].name) || '';
        return out;
      } catch {
        return {};
      }
    },

    async myName() {
      try { const p = await user.me(); return (p && p.name) || ''; } catch { return ''; }
    },
  };
}
