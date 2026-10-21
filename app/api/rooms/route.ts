import { env } from 'cloudflare:workers';
import { gameRoomsSchema } from '../../../db/schema';

export const dynamic = 'force-dynamic';

type DatabaseEnv = { DB: D1Database };
const db = () => (env as unknown as DatabaseEnv).DB;

async function ensureSchema() {
  await db().prepare(gameRoomsSchema).run();
}

function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json() as { action?: string; code?: string; snapshot?: unknown };
  const userId = request.headers.get('oai-authenticated-user-id');

  if (body.action === 'join') {
    const code = String(body.code || '').trim().toUpperCase();
    const room = await db().prepare('SELECT code, state_json, red_token, version, status FROM game_rooms WHERE code = ?').bind(code).first<{ code: string; state_json: string; red_token: string | null; version: number; status: string }>();
    if (!room) return Response.json({ error: 'Sala inexistente.' }, { status: 404 });
    if (room.red_token) return Response.json({ error: 'La sala ya tiene dos jugadores.' }, { status: 409 });
    const token = crypto.randomUUID();
    const result = await db().prepare("UPDATE game_rooms SET red_token = ?, guest_user_id = ?, status = 'active', version = version + 1, updated_at = ? WHERE code = ? AND red_token IS NULL").bind(token, userId, Date.now(), code).run();
    if (!result.meta.changes) return Response.json({ error: 'Otro jugador ocupó la sala.' }, { status: 409 });
    return Response.json({ code, token, role: 'red', status: 'active', version: room.version + 1, snapshot: JSON.parse(room.state_json) });
  }

  if (!body.snapshot) return Response.json({ error: 'Falta el estado inicial.' }, { status: 400 });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = roomCode();
    const token = crypto.randomUUID();
    try {
      await db().prepare('INSERT INTO game_rooms (code, state_json, blue_token, host_user_id, version, status, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)').bind(code, JSON.stringify(body.snapshot), token, userId, 'waiting', Date.now()).run();
      return Response.json({ code, token, role: 'blue', status: 'waiting', version: 1, snapshot: body.snapshot });
    } catch {
      // Retry only the extremely unlikely room-code collision.
    }
  }
  return Response.json({ error: 'No se pudo crear la sala.' }, { status: 500 });
}
