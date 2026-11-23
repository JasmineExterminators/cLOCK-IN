// In-memory stand-ins for the Postgres stores, for tests and local runs.
import { Conflict } from '../api/_lib/crew.js';

export function memoryCrews() {
  const crews = new Map(); // code -> { name, members: Map(userId -> { card, updatedAt, joined }) }
  let tick = 0;
  return {
    async getCrew(code) {
      const c = crews.get(code);
      return c ? { code, name: c.name, members: [...c.members].map(([userId, v]) => ({ userId, card: v.card, updatedAt: v.updatedAt })) } : null;
    },
    async listMine(userId) {
      return [...crews].filter(([, c]) => c.members.has(userId))
        .sort((a, b) => a[1].members.get(userId).joined - b[1].members.get(userId).joined)
        .map(([code, c]) => ({ code, name: c.name, size: c.members.size }));
    },
    async createCrew(code, userId, card, name = '') {
      if (crews.has(code)) throw new Conflict();
      crews.set(code, { name, members: new Map([[userId, { card, updatedAt: Date.now(), joined: tick++ }]]) });
    },
    async addMember(code, userId, card, max) {
      const c = crews.get(code);
      if (!c) return 'no_crew';
      if (!c.members.has(userId) && c.members.size >= max) return 'full';
      c.members.set(userId, { card, updatedAt: Date.now(), joined: c.members.get(userId)?.joined ?? tick++ });
      return 'ok';
    },
    async updateMember(code, userId, card) {
      const m = crews.get(code)?.members;
      if (!m?.has(userId)) return false;
      m.set(userId, { ...m.get(userId), card, updatedAt: Date.now() });
      return true;
    },
    async updateAll(userId, card) {
      let n = 0;
      for (const c of crews.values()) if (c.members.has(userId)) { c.members.set(userId, { ...c.members.get(userId), card, updatedAt: Date.now() }); n++; }
      return n;
    },
    async renameCrew(code, name) { const c = crews.get(code); if (c) c.name = name; },
    async removeMember(code, userId) { crews.get(code)?.members.delete(userId); },
  };
}

export function memorySaves() {
  const rows = new Map();
  return {
    async get(id) { return rows.get(id) || null; },
    async put(id, data, base, force) {
      const cur = rows.get(id);
      if (force || (!cur && !base) || (cur && cur.version === base)) {
        const row = { data, version: (cur?.version || 0) + 1, updatedAt: Date.now() };
        rows.set(id, row);
        return { ok: true, version: row.version, updatedAt: row.updatedAt };
      }
      return { ok: false, current: cur || null };
    },
  };
}

export function memoryPayday(recipients = []) {
  const claimed = new Set();
  return {
    async recipients() { return recipients; },
    async claim(userId, key) { const k = `${userId}|${key}`; if (claimed.has(k)) return false; claimed.add(k); return true; },
    async unclaim(userId, key) { claimed.delete(`${userId}|${key}`); },
  };
}

export function memoryBoard(crews = {}) {
  const milestones = new Map(); // id -> { ..., votes: Map, congrats: [] }
  const reports = new Map(); // id -> { ..., votes: Map }
  const outM = (m) => m && { ...m, votes: [...m.votes].map(([userId, amount]) => ({ userId, amount })), congrats: [...m.congrats] };
  const outR = (r) => r && { ...r, votes: [...r.votes].map(([userId, agree]) => ({ userId, agree })) };
  return {
    crews,
    async members(code) { return crews[code] || null; },
    async listMilestones(code) { return [...milestones.values()].filter((m) => m.crewCode === code).map(outM); },
    async getMilestone(id) { return outM(milestones.get(id)) || null; },
    async createMilestone(m) { milestones.set(m.id, { ...m, doneAt: null, bonus: null, votes: new Map(), congrats: [] }); },
    async voteMilestone(id, userId, amount) { milestones.get(id).votes.set(userId, amount); },
    async completeMilestone(id, bonus, now) { const m = milestones.get(id); if (!m.doneAt) Object.assign(m, { doneAt: now, bonus }); },
    async deleteMilestone(id) { milestones.delete(id); },
    async setCongrats(id, userId, on) { const m = milestones.get(id); m.congrats = m.congrats.filter((u) => u !== userId); if (on) m.congrats.push(userId); },
    async listReports(code) { return [...reports.values()].filter((r) => r.crewCode === code).map(outR); },
    async getReport(id) { return outR(reports.get(id)) || null; },
    async findOpenReport(code, target, shiftId) { return [...reports.values()].some((r) => r.crewCode === code && r.target === target && r.shift.id === shiftId && r.status === 'open'); },
    async createReport(r) { reports.set(r.id, { ...r, votes: new Map() }); },
    async voteReport(id, userId, agree) { reports.get(id).votes.set(userId, agree); },
    async setReportStatus(id, status) { reports.get(id).status = status; },
    async deleteReport(id) { reports.delete(id); },
    async respondReport(id, text, now) { Object.assign(reports.get(id), { response: text, respondedAt: now }); },
  };
}
