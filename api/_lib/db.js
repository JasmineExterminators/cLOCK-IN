// Postgres access (Supabase, connected through the Vercel Marketplace integration).
import postgres from 'postgres';
import { Conflict } from './crew.js';
import { SCHEMA } from './schema.js';

let sql = null;
let ready = null;

function connect() {
  const raw = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
  if (!raw) throw new Error('POSTGRES_URL is not set. Connect the Supabase database to this Vercel project.');
  // Drop provider-specific query params (e.g. ?supa=...) that the driver would forward to the server.
  const url = new URL(raw);
  url.search = '';
  return postgres(url.toString(), {
    ssl: process.env.PGSSL === 'off' ? false : 'require', // PGSSL=off only for local testing
    onnotice: () => {},
    prepare: false, // required for Supabase's transaction pooler
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export async function db() {
  if (!sql) sql = connect();
  if (!ready) ready = sql.unsafe(SCHEMA).catch((e) => { ready = null; throw e; });
  await ready;
  return sql;
}

/* ---------- saves ---------- */

export const saveStore = {
  async get(userId) {
    const s = await db();
    const [row] = await s`select data, version, updated_at from public.saves where user_id = ${userId}`;
    return row ? { data: row.data, version: row.version, updatedAt: row.updated_at.getTime() } : null;
  },

  // Write only if the stored version still equals baseVersion (0 = "no save yet").
  async put(userId, data, baseVersion, force = false) {
    const s = await db();
    if (force) {
      const [row] = await s`
        insert into public.saves (user_id, data) values (${userId}, ${s.json(data)})
        on conflict (user_id) do update set data = excluded.data, version = public.saves.version + 1, updated_at = now()
        returning version, updated_at`;
      return { ok: true, version: row.version, updatedAt: row.updated_at.getTime() };
    }
    if (!baseVersion) {
      const [row] = await s`
        insert into public.saves (user_id, data) values (${userId}, ${s.json(data)})
        on conflict (user_id) do nothing
        returning version, updated_at`;
      if (row) return { ok: true, version: row.version, updatedAt: row.updated_at.getTime() };
    } else {
      const [row] = await s`
        update public.saves set data = ${s.json(data)}, version = version + 1, updated_at = now()
        where user_id = ${userId} and version = ${baseVersion}
        returning version, updated_at`;
      if (row) return { ok: true, version: row.version, updatedAt: row.updated_at.getTime() };
    }
    return { ok: false, current: await this.get(userId) };
  },
};

/* ---------- crews ---------- */

export const crewStore = {
  async getCrew(code) {
    const s = await db();
    const [crew] = await s`select code, name from public.crews where code = ${code}`;
    if (!crew) return null;
    const members = await s`
      select user_id, card, updated_at from public.crew_members where crew_code = ${code} order by joined_at`;
    return { code, name: crew.name || '', members: members.map((m) => ({ userId: m.user_id, card: m.card, updatedAt: m.updated_at.getTime() })) };
  },

  async listMine(userId) {
    const s = await db();
    const rows = await s`
      select c.code, c.name, (select count(*)::int from public.crew_members x where x.crew_code = c.code) as size
      from public.crew_members m join public.crews c on c.code = m.crew_code
      where m.user_id = ${userId} order by m.joined_at`;
    return rows.map((r) => ({ code: r.code, name: r.name || '', size: r.size }));
  },

  async createCrew(code, userId, card, name = '') {
    const s = await db();
    await s.begin(async (t) => {
      const [made] = await t`insert into public.crews (code, created_by, name) values (${code}, ${userId}, ${name || null}) on conflict do nothing returning code`;
      if (!made) throw new Conflict('exists');
      await t`insert into public.crew_members (crew_code, user_id, card) values (${code}, ${userId}, ${t.json(card)})`;
    });
  },

  // Returns 'ok' | 'full' | 'no_crew'
  async addMember(code, userId, card, max) {
    const s = await db();
    return s.begin(async (t) => {
      const [crew] = await t`select code from public.crews where code = ${code} for update`;
      if (!crew) return 'no_crew';
      const [{ n }] = await t`select count(*)::int as n from public.crew_members where crew_code = ${code} and user_id <> ${userId}`;
      if (n >= max) return 'full';
      await t`
        insert into public.crew_members (crew_code, user_id, card) values (${code}, ${userId}, ${t.json(card)})
        on conflict (crew_code, user_id) do update set card = excluded.card, updated_at = now()`;
      return 'ok';
    });
  },

  async updateMember(code, userId, card) {
    const s = await db();
    const rows = await s`
      update public.crew_members set card = ${s.json(card)}, updated_at = now()
      where crew_code = ${code} and user_id = ${userId} returning user_id`;
    return rows.length > 0;
  },

  async updateAll(userId, card) {
    const s = await db();
    const rows = await s`
      update public.crew_members set card = ${s.json(card)}, updated_at = now() where user_id = ${userId} returning crew_code`;
    return rows.length;
  },

  async renameCrew(code, name) {
    const s = await db();
    await s`update public.crews set name = ${name || null} where code = ${code}`;
  },

  async removeMember(code, userId) {
    const s = await db();
    await s`delete from public.crew_members where crew_code = ${code} and user_id = ${userId}`;
  },
};

/* ---------- payday emails ---------- */

export const paydayStore = {
  async recipients() {
    const s = await db();
    const rows = await s`
      select s.user_id, u.email, s.data from public.saves s join auth.users u on u.id = s.user_id where u.email is not null`;
    return rows.map((r) => ({ userId: r.user_id, email: r.email, data: r.data }));
  },
  // True if this (user, payday) wasn't claimed yet; claiming it means "we're sending this one".
  async claim(userId, key) {
    const s = await db();
    const rows = await s`insert into public.payday_emails (user_id, payday) values (${userId}, ${key}) on conflict do nothing returning user_id`;
    return rows.length > 0;
  },
  async unclaim(userId, key) {
    const s = await db();
    await s`delete from public.payday_emails where user_id = ${userId} and payday = ${key}`;
  },
};
