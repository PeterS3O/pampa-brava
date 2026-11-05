import { env } from 'cloudflare:workers';
import { gameRoomsSchema } from '../../../../db/schema';

export const dynamic = 'force-dynamic';

type DatabaseEnv = { DB: D1Database };
type RoomRow = { state_json: string; blue_token: string; red_token: string | null; green_token: string | null; fourth_token: string | null; player_count: number; version: number; status: string };
const db = () => (env as unknown as DatabaseEnv).DB;

async function roomFor(code: string) {
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
  return db().prepare('SELECT state_json, blue_token, red_token, green_token, fourth_token, player_count, version, status FROM game_rooms WHERE code = ?').bind(code.toUpperCase()).first<RoomRow>();
}

function roleFor(room: RoomRow, token: string | null) {
  if (token === room.blue_token) return room.player_count === 4 ? 'a' : 'blue';
  if (token && token === room.red_token) return room.player_count === 4 ? 'b' : 'red';
  if (token && token === room.green_token) return room.player_count === 4 ? 'c' : 'green';
  if (token && token === room.fourth_token) return 'd';
  return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await roomFor(code);
  if (!room) return Response.json({ error: 'Sala inexistente.' }, { status: 404 });
  const token = new URL(request.url).searchParams.get('token');
  const role = roleFor(room, token);
  if (!role) return Response.json({ error: 'Acceso inválido.' }, { status: 403 });
  return Response.json({ code: code.toUpperCase(), role, status: room.status, playerCount: room.player_count, version: room.version, snapshot: JSON.parse(room.state_json) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await roomFor(code);
  if (!room) return Response.json({ error: 'Sala inexistente.' }, { status: 404 });
  const body = await request.json() as { token?: string; snapshot?: unknown; version?: number };
  if (!roleFor(room, body.token || null)) return Response.json({ error: 'Acceso inválido.' }, { status: 403 });
  if (!body.snapshot) return Response.json({ error: 'Falta el estado.' }, { status: 400 });
  if (!Number.isInteger(body.version)) return Response.json({ error: 'Falta la versión de la partida.' }, { status: 400 });
  const result = await db().prepare('UPDATE game_rooms SET state_json = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ?').bind(JSON.stringify(body.snapshot), Date.now(), code.toUpperCase(), body.version).run();
  if (!result.meta.changes) {
    const latest = await roomFor(code);
    return Response.json({ error: 'La partida cambió en el otro dispositivo.', version: latest?.version, status: latest?.status, playerCount: latest?.player_count, snapshot: latest && JSON.parse(latest.state_json) }, { status: 409 });
  }
  return Response.json({ ok: true, version: body.version! + 1 });
}
