import { env } from 'cloudflare:workers';
import { gameRoomsSchema } from '../../../db/schema';

export const dynamic = 'force-dynamic';

type DatabaseEnv = { DB: D1Database };
const db = () => (env as unknown as DatabaseEnv).DB;

async function ensureSchema() {
  await db().prepare(gameRoomsSchema).run();
  for (const statement of [
    'ALTER TABLE game_rooms ADD COLUMN green_token TEXT',
    'ALTER TABLE game_rooms ADD COLUMN third_user_id TEXT',
    'ALTER TABLE game_rooms ADD COLUMN player_count INTEGER NOT NULL DEFAULT 2',
    'ALTER TABLE game_rooms ADD COLUMN fourth_token TEXT',
    'ALTER TABLE game_rooms ADD COLUMN fourth_user_id TEXT',
  ]) {
    try { await db().prepare(statement).run(); } catch { /* Column already exists. */ }
  }
}

function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function cleanName(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 24) || 'Jugador';
}

function snapshotWithName(snapshot: unknown, role: string, name: string) {
  const next = structuredClone(snapshot) as { game?: { participantNames?: Record<string, string> } };
  if (next.game) next.game.participantNames = { ...(next.game.participantNames || {}), [role]: name };
  return next;
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json() as { action?: string; code?: string; snapshot?: unknown; playerCount?: number; name?: string };
  const userId = request.headers.get('oai-authenticated-user-id');

  if (body.action === 'join') {
    const code = String(body.code || '').trim().toUpperCase();
    const room = await db().prepare('SELECT code, state_json, red_token, green_token, fourth_token, player_count, version, status FROM game_rooms WHERE code = ?').bind(code).first<{ code: string; state_json: string; red_token: string | null; green_token: string | null; fourth_token: string | null; player_count: number; version: number; status: string }>();
    if (!room) return Response.json({ error: 'Sala inexistente.' }, { status: 404 });
    const token = crypto.randomUUID();
    const name = cleanName(body.name);
    if (!room.red_token) {
      const status = room.player_count === 2 ? 'active' : 'waiting';
      const role = room.player_count === 4 ? 'b' : 'red';
      const snapshot = snapshotWithName(JSON.parse(room.state_json), role, name);
      const result = await db().prepare("UPDATE game_rooms SET red_token = ?, guest_user_id = ?, state_json = ?, status = ?, version = version + 1, updated_at = ? WHERE code = ? AND red_token IS NULL").bind(token, userId, JSON.stringify(snapshot), status, Date.now(), code).run();
      if (!result.meta.changes) return Response.json({ error: 'Otro jugador ocupó la sala.' }, { status: 409 });
      return Response.json({ code, token, role, status, playerCount: room.player_count, version: room.version + 1, snapshot });
    }
    if (room.player_count === 3 && !room.green_token) {
      const snapshot = snapshotWithName(JSON.parse(room.state_json), 'green', name);
      const result = await db().prepare("UPDATE game_rooms SET green_token = ?, third_user_id = ?, state_json = ?, status = 'active', version = version + 1, updated_at = ? WHERE code = ? AND green_token IS NULL").bind(token, userId, JSON.stringify(snapshot), Date.now(), code).run();
      if (!result.meta.changes) return Response.json({ error: 'Otro jugador ocupó la sala.' }, { status: 409 });
      return Response.json({ code, token, role: 'green', status: 'active', playerCount: 3, version: room.version + 1, snapshot });
    }
    if (room.player_count === 4 && !room.green_token) {
      const snapshot = snapshotWithName(JSON.parse(room.state_json), 'c', name);
      const result = await db().prepare("UPDATE game_rooms SET green_token = ?, third_user_id = ?, state_json = ?, version = version + 1, updated_at = ? WHERE code = ? AND green_token IS NULL").bind(token, userId, JSON.stringify(snapshot), Date.now(), code).run();
      if (!result.meta.changes) return Response.json({ error: 'Otro jugador ocupó la sala.' }, { status: 409 });
      return Response.json({ code, token, role: 'c', status: 'waiting', playerCount: 4, version: room.version + 1, snapshot });
    }
    if (room.player_count === 4 && !room.fourth_token) {
      const snapshot = snapshotWithName(JSON.parse(room.state_json), 'd', name);
      const result = await db().prepare("UPDATE game_rooms SET fourth_token = ?, fourth_user_id = ?, state_json = ?, status = 'active', version = version + 1, updated_at = ? WHERE code = ? AND fourth_token IS NULL").bind(token, userId, JSON.stringify(snapshot), Date.now(), code).run();
      if (!result.meta.changes) return Response.json({ error: 'Otro jugador ocupó la sala.' }, { status: 409 });
      return Response.json({ code, token, role: 'd', status: 'active', playerCount: 4, version: room.version + 1, snapshot });
    }
    return Response.json({ error: 'La sala ya está completa.' }, { status: 409 });
  }

  if (!body.snapshot) return Response.json({ error: 'Falta el estado inicial.' }, { status: 400 });
  const playerCount = body.playerCount === 4 ? 4 : body.playerCount === 3 ? 3 : 2;
  const hostRole = playerCount === 4 ? 'a' : 'blue';
  const initialSnapshot = snapshotWithName(body.snapshot, hostRole, cleanName(body.name));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = roomCode();
    const token = crypto.randomUUID();
    try {
      await db().prepare('INSERT INTO game_rooms (code, state_json, blue_token, host_user_id, player_count, version, status, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)').bind(code, JSON.stringify(initialSnapshot), token, userId, playerCount, 'waiting', Date.now()).run();
      return Response.json({ code, token, role: hostRole, status: 'waiting', playerCount, version: 1, snapshot: initialSnapshot });
    } catch {
      // Retry only the extremely unlikely room-code collision.
    }
  }
  return Response.json({ error: 'No se pudo crear la sala.' }, { status: 500 });
}
