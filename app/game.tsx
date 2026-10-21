'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Terrain = 'pampa' | 'monte' | 'sierra';
type NatureCard = Terrain | 'cabalgata' | 'mate_cocido';
type PlayerId = 'blue' | 'red';
type Cell = { row: number; col: number };
type TrucoSuit = 'espada' | 'basto' | 'oro' | 'copa';
type TrucoRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;
type TrucoCard = { id: string; rank: TrucoRank; suit: TrucoSuit };
type Piece = { id: string; name?: string; owner: PlayerId; type: 'faconero' | 'payador'; card: TrucoCard | null; cardVersion: number; revealed: boolean; status: 'camp' | 'board' | 'goal' | 'sacrificed'; position: Cell | null };
type Player = { id: PlayerId; name: string; cards: NatureCard[]; sacrificed: boolean; arrived: number };
type Game = { board: Terrain[][]; goalTerrain: Terrain; pieces: Piece[]; players: Record<PlayerId, Player>; current: PlayerId; turn: number; roll: Terrain | null; activations: string[]; deck: NatureCard[]; trucoDeck: TrucoCard[]; trucoDiscard: TrucoCard[]; log: string[]; winner: PlayerId | null };
type Outcome = { title: string; detail: string; attackerCard: TrucoCard | null; defenderCard: TrucoCard | null; loserId: string | null; replacementIds: string[]; retreat: number; winner: 'attacker' | 'defender' | 'tie' };
type Duel = { attackerId: string; defenders: string[]; defenderId: string | null; target: Cell; from: Cell | null; entry: boolean; cardIndex: number | null; death: boolean; phase: 'choose-defender' | 'attacker' | 'defender' | 'death-answer' | 'outcome' | 'replacement'; outcome?: Outcome };
type RetreatChoice = { pieceId: string; paths: (Cell | null)[][]; steps: number; resolution: 'duel' | 'refusal'; attackerId: string };
type PlayMode = 'online' | 'test' | null;
type RoomSession = { code: string; token: string; role: PlayerId; status: 'waiting' | 'active'; version: number };
type SharedSnapshot = { game: Game; duel: Duel | null; retreat: RetreatChoice | null };

const LABEL: Record<Terrain, string> = { pampa: 'Pampa', monte: 'Monte', sierra: 'Sierra' };
const ICON: Record<Terrain, string> = { pampa: '≈', monte: '♠', sierra: '▲' };
const NATURE_LABEL: Record<NatureCard, string> = { ...LABEL, cabalgata: 'Cabalgata', mate_cocido: 'Mate cocido' };
const NATURE_ICON: Record<NatureCard, string> = { ...ICON, cabalgata: '♞', mate_cocido: '◉' };
const NATURE_EFFECT: Record<NatureCard, string> = {
  pampa: '+3 al naipe si atacás desde Pampa.',
  monte: '+3 al naipe si atacás desde Monte.',
  sierra: '+3 al naipe si atacás desde Sierra.',
  cabalgata: 'Saltá una fila a un terreno del dado.',
  mate_cocido: 'El rival pierde su próximo turno.',
};
const isTerrain = (card: NatureCard): card is Terrain => card === 'pampa' || card === 'monte' || card === 'sierra';
const PLAYER: Record<PlayerId, string> = { blue: 'Azul', red: 'Rojo' };
const TRUCO_SUITS: TrucoSuit[] = ['espada', 'basto', 'oro', 'copa'];
const TRUCO_RANKS: TrucoRank[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const TRUCO_SUIT_LABEL: Record<TrucoSuit, string> = { espada: 'Espada', basto: 'Basto', oro: 'Oro', copa: 'Copa' };
const TRUCO_RANK_LABEL: Record<TrucoRank, string> = { 1: 'Ancho', 2: 'Dos', 3: 'Tres', 4: 'Cuatro', 5: 'Cinco', 6: 'Seis', 7: 'Siete', 10: 'Sota', 11: 'Caballo', 12: 'Rey' };
const BOARD_ROWS = 7;
const GAUCHO_NAMES: Record<PlayerId, string[]> = { blue: ['Zoilo', 'Santos', 'Anselmo'], red: ['Jacinto', 'Prudencio', 'Laureano'] };
const other = (id: PlayerId): PlayerId => id === 'blue' ? 'red' : 'blue';
const trucoOrder = (rank: TrucoRank, suit: TrucoSuit) => {
  if (rank === 1 && suit === 'espada') return 14;
  if (rank === 1 && suit === 'basto') return 13;
  if (rank === 7 && suit === 'espada') return 12;
  if (rank === 7 && suit === 'oro') return 11;
  if (rank === 3) return 10;
  if (rank === 2) return 9;
  if (rank === 1) return 8;
  if (rank === 12) return 7;
  if (rank === 11) return 6;
  if (rank === 10) return 5;
  if (rank === 7) return 4;
  return rank - 3;
};
const cardOrder = (card: TrucoCard | null) => card ? trucoOrder(card.rank, card.suit) : 0;
const trucoCardLabel = (card: TrucoCard | null) => card ? `${card.rank} de ${TRUCO_SUIT_LABEL[card.suit]}` : 'Sin naipe';
const trucoCardBadge = (card: TrucoCard | null) => card ? `${card.rank} ${TRUCO_SUIT_LABEL[card.suit]}`.toUpperCase() : '?';
const key = (c: Cell) => `${c.row}-${c.col}`;
const same = (a: Cell | null, b: Cell | null) => !!a && !!b && a.row === b.row && a.col === b.col;
const short = (p: Piece) => p.name || `${p.type === 'faconero' ? 'Faconero' : 'Payador'} ${p.id.match(/\d+$/)?.[0] || '1'}`;
const badge = (p: Piece) => p.name ? p.name.slice(0, 3).toUpperCase() : `${p.type === 'faconero' ? 'F' : 'P'}${p.id.match(/\d+$/)?.[0] || '1'}`;
const TERRAIN: Terrain[] = ['pampa', 'monte', 'sierra'];

function randomIndex(length: number) {
  const values = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / length) * length;
  do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return values[0] % length;
}

const secureRandom = () => randomIndex(0x100000000) / 0x100000000;

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffle<T>(source: T[], rng: () => number = secureRandom) {
  const out = [...source];
  for (let i = out.length - 1; i; i -= 1) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

function makeTrucoDeck(rng: () => number = secureRandom) {
  return shuffle(TRUCO_SUITS.flatMap(suit => TRUCO_RANKS.map(rank => ({ id: `${suit}-${rank}`, rank, suit }))), rng);
}

function makeGame(rng: () => number = secureRandom): Game {
  const terrain = shuffle<Terrain>([...Array<Terrain>(12).fill('pampa'), ...Array<Terrain>(12).fill('monte'), ...Array<Terrain>(11).fill('sierra')], rng);
  const board: Terrain[][] = [];
  let at = 0;
  for (let row = 0; row < BOARD_ROWS; row += 1) { const rowLength = BOARD_ROWS + 1 - row; board.push(terrain.slice(at, at + rowLength)); at += rowLength; }
  const deck = shuffle<NatureCard>([...Array<Terrain>(4).fill('pampa'), ...Array<Terrain>(4).fill('monte'), ...Array<Terrain>(4).fill('sierra'), 'cabalgata', 'mate_cocido'], rng);
  const blueCard = deck.pop()!; const redCard = deck.pop()!;
  const trucoDeck = makeTrucoDeck(rng);
  const pieces = (['blue', 'red'] as PlayerId[]).flatMap(owner => GAUCHO_NAMES[owner].map((name, index) => ({ id: `${owner}-g${index + 1}`, name, owner, type: (index === 1 ? 'payador' : 'faconero') as Piece['type'], card: trucoDeck.pop() || null, cardVersion: 1, revealed: false, status: 'camp' as const, position: null })));
  const current: PlayerId = rng() < .5 ? 'blue' : 'red';
  const goalTerrain = TERRAIN[Math.floor(rng() * TERRAIN.length)];
  return { board, goalTerrain, pieces, players: { blue: { id: 'blue', name: 'Los Azules', cards: [blueCard], sacrificed: false, arrived: 0 }, red: { id: 'red', name: 'Los Rojos', cards: [redCard], sacrificed: false, arrived: 0 } }, current, turn: 1, roll: null, activations: [], deck, trucoDeck, trucoDiscard: [], log: [`La meta es terreno de ${LABEL[goalTerrain]}.`, `Cada bando recibió una carta de naturaleza al azar.`, `Se repartió un naipe de truco a cada gaucho.`, `El sorteo eligió al ${PLAYER[current]}. La travesía comienza.`], winner: null };
}

function withLog(game: Game, message: string): Game {
  return { ...game, log: [message, ...game.log].slice(0, 12) };
}

function passTurn(game: Game, reason: string): Game {
  if (game.winner) return game;
  const next = other(game.current);
  return withLog({ ...game, current: next, turn: game.turn + 1, roll: null, activations: [] }, `${reason} Ahora juega ${PLAYER[next]}.`);
}

function completeActivation(game: Game, pieceId: string): Game {
  if (game.activations.includes(pieceId)) return game;
  const activations = [...game.activations, pieceId];
  const updated = { ...game, activations };
  return activations.length >= 2 ? passTurn(updated, `${PLAYER[game.current]} completó sus dos acciones.`) : updated;
}

function replacePlayedCards(game: Game, pieceIds: string[]) {
  const trucoDeck = [...game.trucoDeck], trucoDiscard = [...game.trucoDiscard];
  const replacements = new Map<string, TrucoCard | null>();
  pieceIds.forEach(id => {
    const piece = game.pieces.find(p => p.id === id);
    if (piece?.card) trucoDiscard.push(piece.card);
    replacements.set(id, trucoDeck.pop() || null);
  });
  const pieces = game.pieces.map(piece => replacements.has(piece.id) ? { ...piece, card: replacements.get(piece.id) || null, cardVersion: piece.cardVersion + 1, revealed: false } : piece);
  return { ...game, pieces, trucoDeck, trucoDiscard };
}

function neighbors(c: Cell, board: Terrain[][]) {
  const out: Cell[] = [];
  if (c.col > 0) out.push({ row: c.row, col: c.col - 1 });
  if (c.col + 1 < board[c.row].length) out.push({ row: c.row, col: c.col + 1 });
  if (c.row < board.length - 1) {
    if (c.col > 0 && c.col - 1 < board[c.row + 1].length) out.push({ row: c.row + 1, col: c.col - 1 });
    if (c.col < board[c.row + 1].length) out.push({ row: c.row + 1, col: c.col });
  }
  return out;
}

function cabalgataTargets(piece: Piece, board: Terrain[][]): Cell[] {
  const row = piece.status === 'camp' ? 1 : piece.position ? piece.position.row + 2 : board.length;
  if (row >= board.length) return [];
  const first = piece.position ? Math.max(0, piece.position.col - 2) : 0;
  const last = piece.position ? Math.min(board[row].length - 1, piece.position.col) : board[row].length - 1;
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, offset) => ({ row, col: first + offset }));
}

function retreatPaths(start: Cell, steps: number) {
  const all: (Cell | null)[][] = [];
  const walk = (cur: Cell | null, left: number, path: (Cell | null)[]) => {
    if (all.length >= 20) return;
    if (!left || !cur) { all.push(path); return; }
    if (!cur.row) { walk(null, left - 1, [...path, null]); return; }
    walk({ row: cur.row - 1, col: cur.col }, left - 1, [...path, { row: cur.row - 1, col: cur.col }]);
    walk({ row: cur.row - 1, col: cur.col + 1 }, left - 1, [...path, { row: cur.row - 1, col: cur.col + 1 }]);
  };
  walk(start, steps, []);
  return [...new Map(all.map(p => [p.map(c => c ? key(c) : 'camp').join('|'), p])).values()];
}

function availableRetreatPaths(start: Cell, steps: number, pieces: Piece[], movingId: string) {
  const paths = retreatPaths(start, steps).filter(path => {
    return path.every(cell => !cell || !pieces.some(piece => piece.id !== movingId && piece.status === 'board' && same(piece.position, cell)));
  });
  return paths.length ? paths : [[null]];
}

function duelNeighbors(cell: Cell, board: Terrain[][]): Cell[] {
  const backward = cell.row > 0 ? [{ row: cell.row - 1, col: cell.col }, { row: cell.row - 1, col: cell.col + 1 }] : [];
  return [...neighbors(cell, board), ...backward.filter(next => next.col < board[next.row].length)];
}

function resolveDuelCards(attacker: Piece, defender: Piece, nature: NatureCard | null, origin: Terrain | null, death: boolean) {
  const natureBoost = nature && nature === origin ? 3 : 0;
  const attackerOrder = cardOrder(attacker.card) + natureBoost;
  const defenderOrder = cardOrder(defender.card);
  const winner: Outcome['winner'] = attackerOrder === defenderOrder ? 'tie' : attackerOrder > defenderOrder ? 'attacker' : 'defender';
  const loserId = winner === 'attacker' ? defender.id : winner === 'defender' ? attacker.id : null;
  const retreatSteps = winner === 'tie' ? 0 : death ? (nature ? 4 : 3) : 2;
  return { natureBoost, attackerOrder, defenderOrder, winner, loserId, retreatSteps };
}

function resolveRetreatPositions(game: Game, duel: Duel, retreat: RetreatChoice, destination: Cell | null): Game | null {
  if (!duel.defenderId || retreat.attackerId !== duel.attackerId) return null;
  const attacker = game.pieces.find(piece => piece.id === duel.attackerId);
  const defender = game.pieces.find(piece => piece.id === duel.defenderId);
  if (!attacker || !defender || attacker.owner === defender.owner || attacker.owner !== game.current || !same(defender.position, duel.target)) return null;
  if (duel.from ? !same(attacker.position, duel.from) : attacker.status !== 'camp') return null;
  const defenderRefused = retreat.resolution === 'refusal' && duel.phase === 'defender' && retreat.pieceId === duel.defenderId;
  const attackerRefused = retreat.resolution === 'refusal' && duel.phase === 'death-answer' && retreat.pieceId === duel.attackerId;
  const lostAcceptedDuel = retreat.resolution === 'duel' && duel.phase === 'outcome' && retreat.pieceId === duel.outcome?.loserId;
  if (!defenderRefused && !attackerRefused && !lostAcceptedDuel) return null;
  const attackerOccupiesTarget = defenderRefused || lostAcceptedDuel && retreat.pieceId === duel.defenderId;
  const pieces = game.pieces.map(piece => {
    if (piece.id === retreat.pieceId) return { ...piece, position: destination, status: destination ? 'board' as const : 'camp' as const };
    if (attackerOccupiesTarget && piece.id === duel.attackerId) return { ...piece, position: duel.target, status: 'board' as const };
    return piece;
  });
  return { ...game, pieces };
}

export default function PampaBravaGame() {
  const [game, setGame] = useState<Game>(() => makeGame(seededRandom(0x50414d50)));
  const [mode, setMode] = useState<PlayMode>(null), [room, setRoom] = useState<RoomSession | null>(null), [roomCode, setRoomCode] = useState('');
  const [roomBusy, setRoomBusy] = useState(false), [roomError, setRoomError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [rideIndex, setRideIndex] = useState<number | null>(null);
  const [retreat, setRetreat] = useState<RetreatChoice | null>(null), [duel, setDuel] = useState<Duel | null>(null);
  const [rules, setRules] = useState(false), [confirmSacrifice, setConfirmSacrifice] = useState(false);
  const lastSnapshot = useRef('');
  const pendingSnapshot = useRef('');
  const roomVersion = useRef(0);
  const writeInFlight = useRef(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [syncRetry, setSyncRetry] = useState(0);
  const viewer: PlayerId = mode === 'test' ? game.current : room?.role || game.current;
  const isMyTurn = mode === 'test' || mode === 'online' && viewer === game.current;
  const activeRoomCode = room?.code, activeRoomToken = room?.token, activeRoomStatus = room?.status, activeRoomVersion = room?.version;
  const player = game.players[viewer], selectedPiece = game.pieces.find(p => p.id === selected) || null;
  const log = withLog;

  const installRoom = (data: RoomSession & { snapshot: SharedSnapshot }) => {
    const serialized = JSON.stringify(data.snapshot);
    lastSnapshot.current = serialized;
    pendingSnapshot.current = '';
    roomVersion.current = data.version;
    writeInFlight.current = false;
    setGame(data.snapshot.game); setDuel(data.snapshot.duel); setRetreat(data.snapshot.retreat);
    setRoom({ code: data.code, token: data.token, role: data.role, status: data.status, version: data.version });
    setMode('online'); setSelected(null); setRideIndex(null); setRoomError('');
  };
  const createRoom = async () => {
    setRoomBusy(true); setRoomError('');
    try {
      const snapshot: SharedSnapshot = { game: makeGame(), duel: null, retreat: null };
      const response = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snapshot }) });
      const data = await response.json() as RoomSession & { snapshot: SharedSnapshot; error?: string }; if (!response.ok) throw new Error(data.error || 'No se pudo crear la sala.');
      installRoom(data);
    } catch (error) { setRoomError(error instanceof Error ? error.message : 'No se pudo crear la sala.'); }
    finally { setRoomBusy(false); }
  };
  const joinRoom = async () => {
    const code = roomCode.trim().toUpperCase(); if (!code) return;
    setRoomBusy(true); setRoomError('');
    try {
      const response = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'join', code }) });
      const data = await response.json() as RoomSession & { snapshot: SharedSnapshot; error?: string }; if (!response.ok) throw new Error(data.error || 'No se pudo entrar a la sala.');
      installRoom(data);
    } catch (error) { setRoomError(error instanceof Error ? error.message : 'No se pudo entrar a la sala.'); }
    finally { setRoomBusy(false); }
  };

  useEffect(() => {
    if (!activeRoomCode || !activeRoomToken || activeRoomVersion === undefined) return;
    let alive = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/rooms/${activeRoomCode}?token=${encodeURIComponent(activeRoomToken)}`, { cache: 'no-store' });
        const data = await response.json() as RoomSession & { snapshot: SharedSnapshot };
        if (!alive || !response.ok) return;
        if (pendingSnapshot.current && pendingSnapshot.current !== lastSnapshot.current) return;
        if (data.version > roomVersion.current) {
          const snapshot = data.snapshot as SharedSnapshot;
          lastSnapshot.current = JSON.stringify(snapshot);
          setGame(snapshot.game); setDuel(snapshot.duel); setRetreat(snapshot.retreat); setSelected(null); setRideIndex(null);
        }
        roomVersion.current = Math.max(roomVersion.current, data.version);
        setRoom(current => current ? { ...current, status: data.status, version: Math.max(current.version, data.version) } : current);
      } catch { /* A short network interruption is retried by the next poll. */ }
    };
    poll(); const timer = window.setInterval(poll, 1200);
    return () => { alive = false; window.clearInterval(timer); };
  }, [activeRoomCode, activeRoomToken, activeRoomVersion]);

  useEffect(() => {
    if (!activeRoomCode || !activeRoomToken || activeRoomStatus !== 'active') return;
    const snapshot: SharedSnapshot = { game, duel, retreat };
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSnapshot.current) return;
    pendingSnapshot.current = serialized;
    const timer = window.setTimeout(async () => {
      if (writeInFlight.current) return;
      writeInFlight.current = true;
      try {
        const response = await fetch(`/api/rooms/${activeRoomCode}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: activeRoomToken, snapshot, version: roomVersion.current }) });
        const data = await response.json() as { version: number; status?: RoomSession['status']; snapshot?: SharedSnapshot };
        if (response.ok) {
          lastSnapshot.current = serialized;
          if (pendingSnapshot.current === serialized) pendingSnapshot.current = '';
          roomVersion.current = data.version;
          setRoom(current => current ? { ...current, version: data.version } : current);
          setSyncNotice('');
        } else if (response.status === 409 && data.snapshot) {
          lastSnapshot.current = JSON.stringify(data.snapshot);
          pendingSnapshot.current = '';
          roomVersion.current = data.version;
          setGame(data.snapshot.game); setDuel(data.snapshot.duel); setRetreat(data.snapshot.retreat);
          setSelected(null); setRideIndex(null);
          setRoom(current => current ? { ...current, version: data.version, status: data.status || current.status } : current);
          setSyncNotice('La jugada del rival llegó primero. Se actualizó la partida; revisá el tablero.');
        }
      } catch {
        setSyncNotice('No se pudo guardar la jugada. Reintentando la conexión…');
        window.setTimeout(() => setSyncRetry(value => value + 1), 1000);
      } finally { writeInFlight.current = false; }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [game, duel, retreat, activeRoomCode, activeRoomToken, activeRoomStatus, activeRoomVersion, syncRetry]);

  const destinations = useMemo(() => {
    if (!selectedPiece || !game.roll) return [] as Cell[];
    const available = (cell: Cell) => !game.pieces.some(piece => piece.id !== selectedPiece.id && piece.owner === selectedPiece.owner && piece.status === 'board' && same(piece.position, cell));
    if (rideIndex !== null) return cabalgataTargets(selectedPiece, game.board).filter(cell => game.board[cell.row][cell.col] === game.roll && available(cell));
    if (selectedPiece.status === 'camp') return game.board[0].map((_, col) => ({ row: 0, col })).filter(c => game.board[0][c.col] === game.roll && available(c));
    if (selectedPiece.status !== 'board' || !selectedPiece.position) return [] as Cell[];
    return neighbors(selectedPiece.position, game.board).filter(cell => game.board[cell.row][cell.col] === game.roll && available(cell));
  }, [selectedPiece, game.roll, game.board, game.pieces, rideIndex]);
  const highlighted = new Set(destinations.map(key));
  const challengeCells = selectedPiece && isMyTurn && game.roll && !game.activations.includes(selectedPiece.id)
    ? (rideIndex !== null || selectedPiece.status === 'camp' ? destinations : selectedPiece.position ? duelNeighbors(selectedPiece.position, game.board) : [])
      .filter(cell => game.board[cell.row][cell.col] === game.roll && !game.pieces.some(piece => piece.owner === selectedPiece.owner && piece.status === 'board' && same(piece.position, cell)) && game.pieces.some(piece => piece.owner !== selectedPiece.owner && piece.status === 'board' && same(piece.position, cell)))
    : [];
  const challengeKeys = new Set(challengeCells.map(key));
  const friendlyBlocked = !!selectedPiece && !!game.roll && (selectedPiece.status === 'camp' ? game.board[0].map((_, col) => ({ row: 0, col })) : selectedPiece.status === 'board' && selectedPiece.position ? neighbors(selectedPiece.position, game.board) : []).some(cell => game.board[cell.row][cell.col] === game.roll && game.pieces.some(piece => piece.id !== selectedPiece.id && piece.owner === selectedPiece.owner && piece.status === 'board' && same(piece.position, cell)));

  const selectable = (p: Piece) => isMyTurn && !!game.roll && game.activations.length < 2 && p.owner === viewer && !game.activations.includes(p.id) && !['goal', 'sacrificed'].includes(p.status) && (p.status !== 'camp' || game.board[0].includes(game.roll) || player.cards.includes('cabalgata') && cabalgataTargets(p, game.board).some(cell => game.board[cell.row][cell.col] === game.roll));
  const selectGaucho = (p: Piece) => {
    if (!selectable(p)) return;
    setSelected(current => current === p.id ? null : p.id);
    setRideIndex(null);
    setConfirmSacrifice(false);
  };
  const rollTerrain = () => { if (!isMyTurn || game.roll || duel || retreat || game.winner) return; const t = TERRAIN[randomIndex(TERRAIN.length)]; setGame(s => log({ ...s, roll: t }, `Turno ${s.turn}: el dado marca ${LABEL[t]}.`)); setSelected(null); };

  const finishMove = (pieceId: string, dest: Cell) => {
    setGame(s => {
      const mover = s.pieces.find(p => p.id === pieceId)!;
      const occupied = s.pieces.some(p => p.id !== pieceId && p.status === 'board' && same(p.position, dest));
      if (occupied) return log(s, `${short(mover)} no puede avanzar: ese terreno ya está ocupado.`);
      const pieces = s.pieces.map(p => p.id === pieceId ? { ...p, status: 'board' as const, position: dest } : p);
      return completeActivation(log({ ...s, pieces }, `${PLAYER[mover.owner]}: ${short(mover)} avanza hasta la fila ${dest.row + 1}.`), pieceId);
    });
    setSelected(null);
  };
  const beginDuel = (pieceId: string, target: Cell, from: Cell | null, entry: boolean) => {
    if (!game.roll || game.board[target.row][target.col] !== game.roll) return;
    const attacker = game.pieces.find(p => p.id === pieceId);
    if (!attacker || attacker.owner !== game.current || game.pieces.some(p => p.id !== pieceId && p.owner === attacker.owner && p.status === 'board' && same(p.position, target))) return;
    const legalTargets = rideIndex !== null ? cabalgataTargets(attacker, game.board) : attacker.status === 'camp' ? game.board[0].map((_, col) => ({ row: 0, col })) : attacker.position ? duelNeighbors(attacker.position, game.board) : [];
    if (!legalTargets.some(cell => same(cell, target))) return;
    const defenders = game.pieces.filter(p => p.owner !== attacker.owner && p.status === 'board' && same(p.position, target)).map(p => p.id);
    if (!defenders.length) return;
    setDuel({ attackerId: pieceId, defenders, defenderId: defenders.length === 1 ? defenders[0] : null, target, from, entry, cardIndex: null, death: false, phase: defenders.length > 1 ? 'choose-defender' : 'attacker' });
  };
  const travel = (pieceId: string, path: Cell[]) => {
    const p = game.pieces.find(x => x.id === pieceId)!; let previous = p.position;
    for (const c of path) {
      if (game.pieces.some(x => x.id !== p.id && x.owner === p.owner && x.status === 'board' && same(x.position, c))) return;
      if (game.pieces.some(x => x.owner !== p.owner && x.status === 'board' && same(x.position, c))) { beginDuel(pieceId, c, previous, p.status === 'camp'); return; }
      previous = c;
    }
    finishMove(pieceId, path[path.length - 1]);
  };
  const chooseDestination = (dest: Cell) => {
    if (!selectedPiece || !highlighted.has(key(dest)) && !challengeKeys.has(key(dest))) return;
    if (rideIndex !== null) {
      const index = rideIndex;
      setGame(s => {
        const current = s.players[s.current];
        if (current.cards[index] !== 'cabalgata') return s;
        const players = { ...s.players, [s.current]: { ...current, cards: current.cards.filter((_, i) => i !== index) } };
        return log({ ...s, players }, `${PLAYER[selectedPiece.owner]} juega Cabalgata: ${short(selectedPiece)} salta hasta la fila ${dest.row + 1}.`);
      });
      setRideIndex(null);
    }
    if (challengeKeys.has(key(dest)) && !highlighted.has(key(dest))) beginDuel(selectedPiece.id, dest, selectedPiece.position, false);
    else travel(selectedPiece.id, [dest]);
  };
  const stay = () => { if (!selectedPiece) return; setGame(s => completeActivation(log(s, `${PLAYER[selectedPiece.owner]}: ${short(selectedPiece)} permanece en su lugar.`), selectedPiece.id)); setSelected(null); setRideIndex(null); };
  const goalReachable = rideIndex === null && !!selectedPiece && selectedPiece.position?.row === game.board.length - 1 && game.roll === game.goalTerrain;
  const reachGoal = () => {
    if (!selectedPiece || !goalReachable) return;
    setGame(s => { const arrived = s.players[s.current].arrived + 1, players = { ...s.players, [s.current]: { ...s.players[s.current], arrived } }, winner = arrived >= 2 ? s.current : null; const pieces = s.pieces.map(p => p.id === selectedPiece.id ? { ...p, status: 'goal' as const, position: null } : p); return completeActivation(log({ ...s, pieces, players, winner }, winner ? `¡${players[s.current].name} gana la partida!` : `${PLAYER[s.current]}: ${short(selectedPiece)} alcanza la meta.`), selectedPiece.id); }); setSelected(null);
  };
  const sacrifice = () => {
    if (!selectedPiece || !isMyTurn || player.sacrificed || duel || retreat || game.winner) return;
    setGame(s => { const drawn = s.deck.at(-1), deck = drawn ? s.deck.slice(0, -1) : s.deck, pieces = s.pieces.map(p => p.id === selectedPiece.id ? { ...p, status: 'sacrificed' as const, position: null } : p), current = s.players[s.current], players = { ...s.players, [s.current]: { ...current, sacrificed: true, cards: drawn ? [...current.cards, drawn] : current.cards } }; return completeActivation(log({ ...s, deck, pieces, players }, `${PLAYER[s.current]} sacrifica a ${short(selectedPiece)} y roba una carta de naturaleza al azar.`), selectedPiece.id); }); setSelected(null); setRideIndex(null); setConfirmSacrifice(false);
  };
  const playMateCocido = (index: number) => {
    if (!isMyTurn || duel || retreat || game.winner || player.cards[index] !== 'mate_cocido') return;
    setGame(s => {
      const current = s.players[s.current];
      if (current.cards[index] !== 'mate_cocido') return s;
      const players = { ...s.players, [s.current]: { ...current, cards: current.cards.filter((_, i) => i !== index) } };
      return log({ ...s, players, turn: s.turn + 2, roll: null, activations: [] }, `${PLAYER[s.current]} juega Mate cocido: ${PLAYER[other(s.current)]} pierde su próximo turno.`);
    });
    setSelected(null); setRideIndex(null); setConfirmSacrifice(false);
  };
  const discardCard = (s: Game, d: Duel) => { if (d.cardIndex === null) return s; const p = s.players[s.current]; return { ...s, players: { ...s.players, [s.current]: { ...p, cards: p.cards.filter((_, i) => i !== d.cardIndex) } } }; };
  const refuse = () => {
    if (!duel?.defenderId || duel.phase !== 'defender') return;
    if (mode === 'online' && room?.role !== game.pieces.find(piece => piece.id === duel.defenderId)?.owner) return;
    setGame(s => {
      const defender = s.pieces.find(p => p.id === duel.defenderId)!;
      const attacker = s.pieces.find(p => p.id === duel.attackerId)!;
      return log(discardCard(s, duel), `${short(defender)} (${PLAYER[defender.owner]}) rechaza el duelo: retrocede una fila. ${short(attacker)} (${PLAYER[attacker.owner]}) ocupará la casilla disputada.`);
    });
    setRetreat({ pieceId: duel.defenderId, paths: availableRetreatPaths(duel.target, 1, game.pieces, duel.defenderId), steps: 1, resolution: 'refusal', attackerId: duel.attackerId }); setSelected(null);
  };
  const rejectDeath = () => {
    if (!duel || duel.phase !== 'death-answer') return;
    if (mode === 'online' && room?.role !== game.pieces.find(piece => piece.id === duel.attackerId)?.owner) return;
    const steps = duel.cardIndex !== null ? 3 : 2;
    if (!duel.from) { setGame(s => completeActivation(log(discardCard(s, duel), `${short(s.pieces.find(p => p.id === duel.attackerId)!)} (${PLAYER[s.current]}) rechaza el Duelo a muerte. Permanece en el campamento.`), duel.attackerId)); setDuel(null); setSelected(null); return; }
    setGame(s => log(discardCard(s, duel), `${short(s.pieces.find(p => p.id === duel.attackerId)!)} (${PLAYER[s.current]}) rechaza el Duelo a muerte y debe retroceder ${steps} filas.`));
    setRetreat({ pieceId: duel.attackerId, paths: availableRetreatPaths(duel.from, steps, game.pieces, duel.attackerId), steps, resolution: 'refusal', attackerId: duel.attackerId }); setSelected(null);
  };
  const accept = (death: boolean) => {
    if (!duel?.defenderId) return;
    const a = game.pieces.find(p => p.id === duel.attackerId)!, d = game.pieces.find(p => p.id === duel.defenderId)!;
    const card = duel.cardIndex === null ? null : game.players[a.owner].cards[duel.cardIndex], origin = duel.from ? game.board[duel.from.row][duel.from.col] : null;
    const { natureBoost, attackerOrder, defenderOrder, winner, loserId, retreatSteps } = resolveDuelCards(a, d, card, origin, death);
    const winningPiece = winner === 'attacker' ? a : winner === 'defender' ? d : null;
    const title = winningPiece ? `¡Ganó el equipo ${PLAYER[winningPiece.owner]}! ¡Bravo el gaucho ${short(winningPiece)}!` : '¡Fuerzas iguales!';
    const detail = `${short(a)} juega ${trucoCardLabel(a.card)} (fuerza ${attackerOrder}); ${short(d)} juega ${trucoCardLabel(d.card)} (fuerza ${defenderOrder}).${card ? ` El atacante mostró ${NATURE_LABEL[card]}${natureBoost ? ' y elevó tres posiciones su naipe.' : ' como farol: no recibió bonificación.'}` : ''}${loserId ? ` Retrocede ${short(winner === 'attacker' ? d : a)} del equipo ${PLAYER[winner === 'attacker' ? d.owner : a.owner]}.` : ''}`;
    const replacementIds = [a.id, d.id];
    setGame(s => { const n = discardCard(s, duel); const pieces = n.pieces.map(p => [a.id, d.id].includes(p.id) ? { ...p, revealed: true } : p); return log({ ...n, pieces }, `${title} ${detail}`); });
    setDuel({ ...duel, death, phase: 'outcome', outcome: { title, detail, attackerCard: a.card, defenderCard: d.card, loserId, replacementIds, retreat: retreatSteps, winner } });
  };
  const continueOutcome = () => {
    if (!duel?.outcome) return;
    if (duel.outcome.winner === 'tie') { setGame(s => replacePlayedCards(s, duel.outcome!.replacementIds)); setDuel({ ...duel, phase: 'replacement' }); return; }
    const loserId = duel.outcome.loserId!;
    if (duel.entry && loserId === duel.attackerId) { setGame(s => replacePlayedCards({ ...s, pieces: s.pieces.map(p => p.id === loserId ? { ...p, status: 'camp' as const, position: null } : p) }, duel.outcome!.replacementIds)); setDuel({ ...duel, phase: 'replacement' }); return; }
    const start = loserId === duel.attackerId ? duel.from : duel.target;
    if (start) setRetreat({ pieceId: loserId, paths: availableRetreatPaths(start, duel.outcome.retreat, game.pieces, loserId), steps: duel.outcome.retreat, resolution: 'duel', attackerId: duel.attackerId });
  };
  const chooseRetreat = (path: (Cell | null)[]) => {
    if (!retreat || !duel) return; const dest = path.at(-1) || null;
    if (mode === 'online' && room?.role !== game.pieces.find(piece => piece.id === retreat.pieceId)?.owner) return;
    if (dest && game.pieces.some(p => p.id !== retreat.pieceId && p.status === 'board' && same(p.position, dest))) return;
    if (!resolveRetreatPositions(game, duel, retreat, dest)) return;
    if (retreat.resolution === 'refusal') {
      setGame(s => {
        const resolved = resolveRetreatPositions(s, duel, retreat, dest);
        if (!resolved) return s;
        const loser = s.pieces.find(p => p.id === retreat.pieceId)!;
        const occupation = retreat.pieceId === duel.defenderId ? ` ${short(s.pieces.find(p => p.id === duel.attackerId)!)} ocupa la casilla disputada.` : '';
        return completeActivation(log(resolved, `${short(loser)} (${PLAYER[loser.owner]}) retrocede a ${dest ? `la fila ${dest.row + 1}` : 'su campamento'}.${occupation}`), duel.attackerId);
      });
      setRetreat(null); setDuel(null); setSelected(null); return;
    }
    setGame(s => {
      const resolved = resolveRetreatPositions(s, duel, retreat, dest);
      return resolved ? replacePlayedCards(resolved, duel.outcome?.replacementIds || []) : s;
    });
    setRetreat(null); setDuel({ ...duel, phase: 'replacement' });
  };
  const finishReplacement = () => { if (!duel) return; setGame(s => completeActivation(s, duel.attackerId)); setDuel(null); setSelected(null); };
  const endTurn = () => { if (!isMyTurn || duel || retreat || game.winner) return; setGame(s => passTurn(s, `${PLAYER[s.current]} terminó su turno.`)); setSelected(null); setRideIndex(null); };
  const startTest = () => { setGame(makeGame()); setRoom(null); setMode('test'); setSelected(null); setRideIndex(null); setDuel(null); setRetreat(null); setRoomError(''); };
  const restart = () => { if (mode === 'online' && room?.role !== 'blue') return; setGame(makeGame()); setSelected(null); setRideIndex(null); setDuel(null); setRetreat(null); };
  const leaveRoom = () => { setRoom(null); setMode(null); setSelected(null); setRideIndex(null); setDuel(null); setRetreat(null); setGame(makeGame(seededRandom(0x50414d50))); };
  const rosterOwner = viewer;
  const rosterPieces = game.pieces.filter(p => p.owner === rosterOwner && !['goal', 'sacrificed'].includes(p.status));
  const duelAttacker = duel ? game.pieces.find(p => p.id === duel.attackerId) : null;
  const duelDefender = duel?.defenderId ? game.pieces.find(p => p.id === duel.defenderId) : null;
  const controlsAttack = mode === 'test' || duelAttacker?.owner === viewer;
  const controlsDefense = mode === 'test' || duelDefender?.owner === viewer;
  const cellDescription = (cell: Cell | null) => cell ? `Fila ${cell.row + 1} · Casillero ${cell.col + 1} · ${LABEL[game.board[cell.row][cell.col]]}` : 'Campamento';
  const duelNature = duel?.cardIndex !== null && duel?.cardIndex !== undefined && duelAttacker ? game.players[duelAttacker.owner].cards[duel.cardIndex] : null;

  return <main className={`game-shell player-${viewer}`}>
    <header className="topbar"><div className="brand-mark">PB</div><div><p className="eyebrow">{mode === 'test' ? 'Modo prueba' : 'Juego online'}</p><h1>Pampa Brava</h1></div><div className="score-strip"><span className="blue-dot" />Azul {game.players.blue.arrived}/2 <i /> Rojo {game.players.red.arrived}/2<span className="red-dot" /></div>{room && <div className="room-pill"><small>Sala</small><b>{room.code}</b><span className={room.status}>{room.status === 'active' ? '2 conectados' : 'Esperando'}</span></div>}{mode === 'test' && <div className="room-pill test-pill"><small>Modo</small><b>PRUEBA</b><span className="active">Azul y Rojo en este equipo</span></div>}<button className="header-button" onClick={() => setRules(true)}>Cómo jugar</button>{mode !== null && <button className="header-button" onClick={leaveRoom}>{mode === 'test' ? 'Salir de prueba' : 'Salir de la sala'}</button>}<button className="header-button" onClick={restart} disabled={mode === null || mode === 'online' && room?.role !== 'blue'}>Reiniciar partida</button></header>
    <section className="play-layout">

      <section className={`board-wrap ${duel ? 'duel-active' : ''}`} aria-label="Tablero triangular">{duel && duelAttacker && <div className="board-duel-marker"><small>DUELO EN CURSO</small><b>{short(duelAttacker)} → {duelDefender ? short(duelDefender) : 'rival por elegir'}</b><span>{cellDescription(duel.target)}</span></div>}<div className="board-stage"><button className={`goal ${game.goalTerrain} ${goalReachable ? 'reachable' : ''}`} disabled={!goalReachable} onClick={reachGoal} aria-label={`Meta de ${LABEL[game.goalTerrain]}`}><span>{ICON[game.goalTerrain]}</span><b>META</b><small>{LABEL[game.goalTerrain]}</small></button><div className="board">
        {game.board.slice().reverse().map((row, ri) => { const r = game.board.length - 1 - ri; return <div className="board-row" key={r}>{row.map((terrain, col) => { const cell = { row: r, col }, canMoveHere = highlighted.has(key(cell)) || challengeKeys.has(key(cell)), occupants = game.pieces.filter(p => p.status === 'board' && same(p.position, cell)), duelOrigin = !!duel?.from && same(duel.from, cell), duelTarget = !!duel && same(duel.target, cell); return <div className={`hex ${terrain} ${canMoveHere ? 'reachable' : ''} ${challengeKeys.has(key(cell)) ? 'challenge-cell' : ''} ${duelOrigin ? 'duel-origin' : ''} ${duelTarget ? 'duel-target' : ''}`} role={canMoveHere ? 'button' : undefined} tabIndex={canMoveHere ? 0 : -1} key={key(cell)} onClick={() => canMoveHere && chooseDestination(cell)} onKeyDown={event => canMoveHere && (event.key === 'Enter' || event.key === ' ') && chooseDestination(cell)}><span className="terrain-icon">{ICON[terrain]}</span><span className="terrain-label">{LABEL[terrain]}</span><span className={`occupants count-${Math.min(occupants.length, 8)}`}>{occupants.map(p => { const known = p.revealed || p.owner === viewer || p.owner === game.current && !isMyTurn, cardMark = known ? trucoCardBadge(p.card) : '?', canSelect = selectable(p), canChallenge = p.owner !== viewer && challengeKeys.has(key(cell)) && !!selectedPiece; return <i className={`board-token ${p.owner} ${p.type} ${selected === p.id ? 'selected' : ''} ${canSelect ? 'selectable' : ''} ${canChallenge ? 'challengeable' : ''}`} role={canSelect || canChallenge ? 'button' : undefined} tabIndex={canSelect || canChallenge ? 0 : -1} key={p.id} title={canChallenge ? `Desafiar a ${short(p)}` : `${short(p)} · ${known ? trucoCardLabel(p.card) : 'naipe oculto'}`} aria-label={canChallenge ? `Desafiar a ${short(p)}` : `${PLAYER[p.owner]} ${short(p)}; ${known ? `naipe ${trucoCardLabel(p.card)}` : 'naipe oculto'}`} onClick={event => { event.stopPropagation(); if (canChallenge) chooseDestination(cell); else selectGaucho(p); }} onKeyDown={event => { if ((canSelect || canChallenge) && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); if (canChallenge) chooseDestination(cell); else selectGaucho(p); } }}><CharacterArt type={p.type} /><b>{short(p)}</b><span className="combat-stats"><em>{cardMark}</em></span></i>; })}</span></div>; })}</div>; })}
      </div></div><div className="terrain-legend"><span><i className="pampa" /> Pampa</span><span><i className="monte" /> Monte</span><span><i className="sierra" /> Sierra</span><span className="equal-base">Los duelos se resuelven por la jerarquía del truco argentino</span></div></section>
      <aside className="turn-status-panel" aria-label="Estado del turno">
        <div className="turn-dashboard">
          <div className={`turn-owner ${game.current}`}>
            <span>{isMyTurn ? 'TU TURNO' : 'TURNO RIVAL'}</span>
            <b>{game.players[game.current].name}</b>
            <small>Ronda {game.turn} · {game.players[game.current].arrived}/2 en la meta</small>
          </div>
          <div className="turn-count"><strong>{game.activations.length}<span>/2</span></strong><small>gauchos activados</small></div>
          <div className="rival-hand-count" aria-label={`El rival tiene ${game.players[other(viewer)].cards.length} cartas de naturaleza`}><span aria-hidden="true">▣</span><div><b>{game.players[other(viewer)].cards.length}</b><small>{game.players[other(viewer)].cards.length === 1 ? 'carta del rival' : 'cartas del rival'}</small></div></div>
        </div>
        <div className="turn-guidance" aria-live="polite"><b>{duel ? 'Duelo en curso' : retreat ? 'Elegí la retirada' : isMyTurn ? game.roll ? game.activations.length ? 'Te queda una acción' : 'Elegí tu primer gaucho' : 'Tirá el dado para empezar' : 'Esperá tu turno'}</b><span>{duel ? 'Seguí los pasos del desafío en el panel de duelo.' : retreat ? 'El gaucho que perdió debe elegir por dónde retroceder.' : isMyTurn ? game.roll ? 'Elegí un gaucho y un terreno del dado. Al completar dos acciones, el turno pasa solo.' : 'Después podrás activar hasta dos gauchos distintos.' : `Juega ${PLAYER[game.current]}. Sus acciones aparecen acá.`}</span></div>
        {syncNotice && <p className="sync-notice" role="status">{syncNotice}</p>}
        <section className="recent-actions" aria-label="Últimas acciones" aria-live="polite"><b>Últimas acciones</b>{game.log.slice(0, 3).map((entry, index) => <p key={`${game.turn}-${index}-${entry}`}>{entry}</p>)}</section>
      </aside>
      <aside className="action-panel">
        <div className="roll-column">
          <div><p className="eyebrow">La tierra decide</p><h2>{isMyTurn ? game.roll ? 'Elegí tu camino' : 'Tirá el dado' : 'Observá la jugada rival'}</h2></div>
          <button className="primary roll-button" disabled={!isMyTurn || !!game.roll || !!duel || !!retreat || !!game.winner} onClick={rollTerrain}>{game.roll ? 'Dado lanzado' : isMyTurn ? 'Tirar dado' : 'Espera al rival'} <span aria-hidden="true">◆</span></button>
          <div className={`dice-result ${game.roll || 'waiting'}`} aria-live="polite"><span>{game.roll ? ICON[game.roll] : '?'}</span><div><small>RESULTADO</small><b>{game.roll ? LABEL[game.roll].toUpperCase() : 'POR TIRAR'}</b></div></div>
        </div>
        <section className="nature-vault" aria-label="Tus cartas de naturaleza">
          <div className="nature-heading"><div><span className="eyebrow">Tu mano secreta</span><h2>Cartas de naturaleza</h2></div><small>{player.cards.length} {player.cards.length === 1 ? 'carta' : 'cartas'}</small></div>
          <div className={`nature-hand ${player.cards.length > 1 ? 'multiple' : ''}`}>
            {player.cards.length ? player.cards.map((card, index) => <article className={`nature-card ${card} ${rideIndex === index ? 'armed' : ''}`} key={`${card}-${index}`}>
              <div className="nature-card-top"><span>PAMPA BRAVA · NATURALEZA</span><b>0{index + 1}</b></div>
              <div className="nature-card-emblem" aria-hidden="true">{NATURE_ICON[card]}</div>
              <div className="nature-card-content"><small>{isTerrain(card) ? 'POTENCIADORA' : card === 'cabalgata' ? 'MOVIMIENTO' : 'TÁCTICA'}</small><h3>{NATURE_LABEL[card]}</h3><p>{NATURE_EFFECT[card]}</p></div>
              <div className="nature-card-foot">
                <span>También sirve como farol en un ataque.</span>
                {card === 'cabalgata' && <button className="nature-card-action" disabled={!isMyTurn || !game.roll || !selectedPiece || !!duel || !!retreat || !!game.winner} onClick={() => setRideIndex(current => current === index ? null : index)}>{rideIndex === index ? 'Cancelar cabalgata' : selectedPiece ? 'Usar con este gaucho' : 'Elegí un gaucho para usarla'}</button>}
                {card === 'mate_cocido' && <button className="nature-card-action" disabled={!isMyTurn || !!duel || !!retreat || !!game.winner} onClick={() => playMateCocido(index)}>Hacer perder un turno al rival</button>}
              </div>
            </article>) : <div className="empty-nature"><b>Sin cartas en la mano</b><span>Sacrificá un gaucho para robar una nueva.</span></div>}
          </div>
          <div className="nature-sacrifice"><div><b>Sacrificar un gaucho</b><small>{player.sacrificed ? 'Ya usaste este recurso en la partida.' : 'Retirá un gaucho para robar una carta nueva. Sólo una vez por partida.'}</small></div>{confirmSacrifice && selectedPiece ? <div className="sacrifice-confirm"><button onClick={sacrifice}>Confirmar sacrificio de {short(selectedPiece)}</button><button onClick={() => setConfirmSacrifice(false)}>Cancelar</button></div> : <button disabled={!isMyTurn || !selectedPiece || player.sacrificed || !game.deck.length || !!duel || !!retreat || !!game.winner} onClick={() => setConfirmSacrifice(true)}>{selectedPiece ? `Sacrificar a ${short(selectedPiece)}` : 'Seleccioná un gaucho'}</button>}</div>
        </section>
        {isMyTurn && game.roll && <div className="action-flow"><p className="hint">{rideIndex !== null ? selectedPiece ? destinations.length ? `Cabalgata lista: elegí un terreno ${LABEL[game.roll]} dos filas más adelante.` : 'No hay un destino válido para Cabalgata con este dado.' : 'Elegí un gaucho antes de usar Cabalgata.' : selectedPiece ? goalReachable ? `La meta de ${LABEL[game.goalTerrain]} está habilitada.` : challengeCells.length ? 'Hay rivales al alcance: ganá el duelo para ocupar su terreno.' : destinations.length ? `Elegí un terreno ${LABEL[game.roll]} vecino.` : friendlyBlocked ? `El terreno ${LABEL[game.roll]} disponible está ocupado por un aliado.` : selectedPiece.position?.row === game.board.length - 1 ? `La meta requiere ${LABEL[game.goalTerrain]}.` : `Este gaucho no tiene un terreno ${LABEL[game.roll]} vecino.` : game.activations.length >= 2 ? 'Ya activaste dos gauchos.' : 'Elegí un gaucho del tablero o del campamento.'}</p>{challengeCells.length > 0 && selectedPiece && <div className="challenge-box"><b>Desafíos disponibles</b>{challengeCells.map(cell => { const rivals = game.pieces.filter(piece => piece.owner !== viewer && piece.status === 'board' && same(piece.position, cell)); return <button key={key(cell)} onClick={() => chooseDestination(cell)}>Desafiar a {rivals.map(short).join(' / ')}</button>; })}</div>}{selectedPiece && !destinations.length && !goalReachable && !challengeCells.length && rideIndex === null && <button className="secondary" onClick={stay}>Quedarse y cerrar activación</button>}<button className="primary end-turn" onClick={endTurn}>{game.activations.length >= 2 ? 'Finalizar turno' : game.activations.length === 1 ? 'Finalizar con un gaucho' : 'Pasar turno'}</button></div>}
        <details className="game-history"><summary>Ver registro de la partida</summary><div className="game-log">{game.log.map((x, i) => <div className="log-entry" key={`${x}-${i}`}><span>{String(game.log.length - i).padStart(2, '0')}</span><p>{x}</p></div>)}</div></details>
      </aside>
      <div className={`camp-ground ${rosterOwner}`}><div className="camp-heading"><span>{rosterOwner === viewer ? 'Tus gauchos' : `Gauchos del rival · turno ${PLAYER[rosterOwner]}`}</span><i>{game.trucoDeck.length} naipes sin jugar · {game.trucoDiscard.length} descartados</i></div><div className="camp-pieces">{rosterPieces.map(p => { const known = p.owner === viewer || p.owner === game.current && !isMyTurn, cardMark = known ? trucoCardBadge(p.card) : '?', canSelect = selectable(p), inCamp = p.status === 'camp'; return <div className={`camp-unit ${p.owner} ${inCamp ? 'in-camp' : 'deployed'}`} key={p.id}>{inCamp ? <button className={`standing-piece ${p.owner} ${p.type} ${selected === p.id ? 'selected' : ''}`} disabled={!canSelect} onClick={() => selectGaucho(p)} title={`${short(p)} · ${known ? trucoCardLabel(p.card) : 'naipe oculto'}`}><CharacterArt type={p.type} /><b>{badge(p)}</b><span className="combat-stats"><em>{cardMark}</em></span></button> : <span className={`standing-piece roster-piece ${p.owner} ${p.type}`} title={`${short(p)} está en la fila ${p.position!.row + 1}`}><CharacterArt type={p.type} /><b>{badge(p)}</b><span className="combat-stats"><em>{cardMark}</em></span></span>}<strong className="gaucho-name">{short(p)}</strong><span className="camp-card-label">{known && p.card ? trucoCardLabel(p.card) : 'Naipe de truco oculto'}</span><TrucoCardView card={p.card} version={p.cardVersion} faceUp={known} owner={p.owner} /><small className="unit-location">{inCamp ? 'Campamento' : `Fila ${p.position!.row + 1}`}</small></div>; })}</div></div>

    </section>
    {mode === null && <div className="privacy-overlay lobby-overlay"><div className="privacy-card lobby-card"><div className="wax-seal blue">PB</div><p className="eyebrow">Partida online para dos</p><h2>Una pampa, dos jugadores</h2><p>Cada jugador entra desde su dispositivo. Creá una sala y compartí el código, o sumate con uno que hayas recibido.</p><button className="mode-choice featured create-room" disabled={roomBusy} onClick={createRoom}><b>{roomBusy ? 'Preparando la sala…' : 'Crear una sala virtual'}</b><small>Entrás como Azul y recibís un código de seis caracteres</small></button><button className="mode-choice test-shortcut" onClick={startTest}><b>Acceso rápido de prueba</b><small>Jugá Azul y Rojo en este dispositivo, sin crear una sala</small></button><div className="join-divider"><span>¿Ya tenés un código?</span></div><div className="join-form"><input value={roomCode} maxLength={6} placeholder="CÓDIGO" aria-label="Código de sala" onChange={event => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onKeyDown={event => event.key === 'Enter' && joinRoom()} /><button className="primary" disabled={roomBusy || roomCode.length < 6} onClick={joinRoom}>{roomBusy ? 'Conectando…' : 'Entrar a la sala'}</button></div>{roomError && <p className="room-error">{roomError}</p>}</div></div>}
    {room?.status === 'waiting' && <div className="privacy-overlay lobby-overlay"><div className="privacy-card waiting-room"><div className="wax-seal blue">PB</div><p className="eyebrow">Sala creada</p><h2>Invitá al jugador Rojo</h2><p>Compartile este código. La partida comenzará apenas se una.</p><strong className="room-code">{room.code}</strong><div className="waiting-turn"><span className="sync-dot" /><b>Esperando al segundo jugador…</b></div><button className="text-button" onClick={leaveRoom}>Cancelar sala</button></div></div>}
    {duel && !retreat && <DuelPanel>{!['outcome', 'replacement'].includes(duel.phase) && <div className="duel-brief"><div className="duel-route"><div className={`duelist ${duelAttacker?.owner || 'blue'}`}><span className="duelist-portrait"><CharacterArt type={duelAttacker?.type || 'faconero'} /></span><small>ATACANTE</small><b>{duelAttacker ? short(duelAttacker) : 'Gaucho'}</b><em>{cellDescription(duel.from)}</em></div><div className="duel-arrow"><span>DESAFÍA</span><b>→</b><em>{cellDescription(duel.target)}</em></div><div className={`duelist ${duelDefender?.owner || other(duelAttacker?.owner || 'blue')}`}><span className="duelist-portrait"><CharacterArt type={duelDefender?.type || 'faconero'} /></span><small>DEFENSOR</small><b>{duelDefender ? short(duelDefender) : 'Por elegir'}</b><em>{cellDescription(duel.target)}</em></div></div><div className={`power-commitment ${duel.cardIndex !== null ? 'active' : 'inactive'}`}><span>{duel.cardIndex !== null ? '⚡' : '—'}</span><div><small>CARTA DE NATURALEZA</small><b>{duel.cardIndex !== null ? controlsAttack && duelNature ? `${NATURE_ICON[duelNature]} ${NATURE_LABEL[duelNature]} comprometida (puede ser un farol)` : 'El atacante comprometió una carta extra' : 'El atacante no está usando carta extra'}</b></div></div></div>}{duel.phase === 'choose-defender' && (controlsAttack ? <><p className="eyebrow">Varios rivales</p><GauchoDialogue piece={duelAttacker} speaker={`${short(duelAttacker!)} · Atacante`}>¡Que salga uno a sostener con coraje lo que defiende con la mirada!</GauchoDialogue><h2 className="choice-title">¿A quién desafiás?</h2><div className="choice-grid defender-choices">{duel.defenders.map(id => { const p = game.pieces.find(x => x.id === id)!; return <button key={id} onClick={() => setDuel({ ...duel, defenderId: id, phase: 'attacker' })}><span className={`character-token ${p.owner}`}><CharacterArt type={p.type} /></span><b>{short(p)}</b><small>{p.revealed ? trucoCardLabel(p.card) : 'Naipe oculto'}</small></button>; })}</div></> : <WaitingStep piece={duelAttacker} text="El atacante está eligiendo a quién desafiar." />)}
      {duel.phase === 'attacker' && (controlsAttack ? <><p className="eyebrow">Prepará tu desafío</p><GauchoDialogue piece={duelAttacker} speaker={short(duelAttacker!)}>¡Eh, {duelDefender ? short(duelDefender) : 'forastero'}! No hay tranquera que frene mi paso. ¿Te animás a medir fuerzas?</GauchoDialogue><p className="duel-explainer">Podés comprometer cualquier carta de naturaleza. Si no potencia tu naipe, sirve como farol y se descarta igual.</p>{game.players[duelAttacker!.owner].cards.length > 0 && <div className="choice-grid nature-choices">{game.players[duelAttacker!.owner].cards.map((c, i) => <button className={duel.cardIndex === i ? 'chosen' : ''} key={`${c}-${i}`} onClick={() => setDuel({ ...duel, cardIndex: i })}><b>{NATURE_ICON[c]} {NATURE_LABEL[c]}</b><small>{isTerrain(c) ? 'Suma +3 si coincide con el terreno de salida; si no, es farol.' : 'Farol: esta carta no suma fuerza en el duelo.'}</small></button>)}</div>}<button className="primary" onClick={() => setDuel({ ...duel, phase: 'defender' })}>{duel.cardIndex === null ? 'Enviar desafío' : 'Invocar naturaleza y desafiar'}</button>{duel.cardIndex !== null && <button className="text-button" onClick={() => setDuel({ ...duel, cardIndex: null })}>No usar carta</button>}{duel.entry && <p className="rule-note">Desde el campamento, una carta comprometida funciona como farol.</p>}</> : <WaitingStep piece={duelAttacker} text="El rival está preparando su desafío." />)}
      {duel.phase === 'defender' && (controlsDefense ? <><p className="eyebrow">Te llegó un desafío</p><GauchoDialogue piece={duelAttacker} speaker={`${short(duelAttacker!)} · Rival`}>¡Hacé sonar esa guitarra o desenvainá el facón! Esta tierra sabrá quién manda.</GauchoDialogue><div className="challenge-status">{duel.cardIndex !== null ? 'El atacante invocó naturaleza: puede favorecer su naipe o ser un farol. ' : 'El atacante viene sin carta de naturaleza. '}Si rechazás, {short(duelDefender!)} retrocede una fila y {short(duelAttacker!)} ocupa su casilla. Si peleás y perdés, retrocedés dos.</div><div className="duel-actions"><button className="secondary" onClick={refuse}>{short(duelDefender!)} rechaza · retrocede 1 fila</button><button className="primary" onClick={() => accept(false)}>Aceptar · se juegan 2 filas</button><button className="death-button" onClick={() => setDuel({ ...duel, death: true, phase: 'death-answer' })}>Responder: ¡que sea a muerte!</button></div></> : <WaitingStep piece={duelDefender} text="El defensor está respondiendo al desafío." />)}
      {duel.phase === 'death-answer' && (controlsAttack ? <><p className="eyebrow">El defensor redobla la apuesta</p><GauchoDialogue piece={duelDefender} speaker={`${short(duelDefender!)} · Rival`}>¡Si venís por gloria, jugate entero! Que esta pulseada sea a muerte.</GauchoDialogue><div className="challenge-status">{duel.cardIndex !== null ? `Si ${short(duelAttacker!)} acepta, se juegan 4 filas; si rechaza, él retrocede 3.` : `Si ${short(duelAttacker!)} acepta, se juegan 3 filas; si rechaza, él retrocede 2.`}</div><div className="duel-actions"><button className="secondary" onClick={rejectDeath}>{short(duelAttacker!)} rechaza · retrocede {duel.cardIndex !== null ? 3 : 2}</button><button className="death-button" onClick={() => accept(true)}>Aceptar · se juegan {duel.cardIndex !== null ? 4 : 3}</button></div></> : <WaitingStep piece={duelAttacker} text="El atacante está decidiendo si acepta el duelo a muerte." />)}
      {duel.phase === 'outcome' && duel.outcome && <><p className="eyebrow">Los naipes se revelan</p><h2>{duel.outcome.title}</h2><div className="duel-force-cards"><div><span>Atacante</span><TrucoCardView card={duel.outcome.attackerCard} version={game.pieces.find(p => p.id === duel.attackerId)?.cardVersion || 1} faceUp owner={game.pieces.find(p => p.id === duel.attackerId)?.owner || 'blue'} /></div><b>VS</b><div><span>Defensor</span><TrucoCardView card={duel.outcome.defenderCard} version={game.pieces.find(p => p.id === duel.defenderId)?.cardVersion || 1} faceUp owner={game.pieces.find(p => p.id === duel.defenderId)?.owner || 'red'} /></div></div><p className="duel-card-verdict">La mano se define por la jerarquía tradicional del truco.</p><p>{duel.outcome.detail}</p>{duel.outcome.winner !== 'tie' && <p className="penalty">{duel.outcome.loserId && short(game.pieces.find(p => p.id === duel.outcome!.loserId)!)} retrocede {duel.outcome.retreat} filas. Los dos naipes jugados se descartan.</p>}{duel.outcome.winner === 'tie' && <p className="penalty">Los dos naipes jugados se descartan. Ambos gauchos recibirán la siguiente carta del mazo.</p>}{controlsAttack ? <button className="primary" onClick={continueOutcome}>{duel.outcome.winner === 'tie' ? 'Repartir los nuevos naipes' : 'Resolver retirada y nuevo reparto'}</button> : <WaitingStep text="El atacante está resolviendo el resultado." />}</>}
      {duel.phase === 'replacement' && duel.outcome && <><p className="eyebrow">Nuevo reparto</p><h2>Naipes renovados</h2><p>Las dos cartas jugadas quedaron en el descarte y no volverán al mazo. Cada gaucho recibió la siguiente carta disponible.</p><div className="replacement-list">{duel.outcome.replacementIds.map(id => { const p = game.pieces.find(piece => piece.id === id)!; const oldCard = id === duel.attackerId ? duel.outcome!.attackerCard : duel.outcome!.defenderCard; return <div className="replacement-row" key={id}><span className="replacement-name">{short(p)}</span><TrucoCardView card={oldCard} version={p.cardVersion - 1} faceUp owner={p.owner} discarded /><b>→</b><TrucoCardView card={p.card} version={p.cardVersion} faceUp={p.owner === viewer} owner={p.owner} fresh /></div>; })}</div>{controlsAttack ? <button className="primary" onClick={finishReplacement}>Guardar nuevos naipes y continuar</button> : <WaitingStep text="El atacante está cerrando el duelo." />}</>}</DuelPanel>}
    {retreat && <DuelPanel>{mode === 'test' || game.pieces.find(p => p.id === retreat.pieceId)?.owner === viewer ? <><p className="eyebrow">{retreat.resolution === 'refusal' ? 'Penalización por rechazo' : 'Retirada'}</p><h2>Retirada de {short(game.pieces.find(p => p.id === retreat.pieceId)!)}</h2><p>{short(game.pieces.find(p => p.id === retreat.pieceId)!)} ({PLAYER[game.pieces.find(p => p.id === retreat.pieceId)!.owner]}) retrocede {retreat.steps} {retreat.steps === 1 ? 'fila' : 'filas'} o hasta el campamento. {retreat.resolution === 'refusal' && retreat.pieceId === duel?.defenderId ? `${short(game.pieces.find(p => p.id === duel.attackerId)!)} ocupará la casilla disputada.` : ''}</p><div className="route-list">{retreat.paths.map((p, i) => <button key={i} onClick={() => chooseRetreat(p)}><b>Retirada {i + 1}</b><span>{p.map(c => c ? `F${c.row + 1}·${c.col + 1}` : 'Campamento').join(' → ')}</span></button>)}</div></> : <WaitingStep text="El rival está eligiendo su retirada." />}</DuelPanel>}
    {rules && <Modal><button className="close" onClick={() => setRules(false)}>×</button><p className="eyebrow">Ayuda rápida</p><h2>Cómo se juega</h2><ol><li>Cada jugador tiene tres gauchos con nombre propio y comienza con una sola carta de naturaleza al azar. Puede obtener una segunda sacrificando un gaucho una vez por partida.</li><li>Se usa una baraja española de truco de 40 naipes, sin ochos ni nueves. Cada gaucho recibe uno al comenzar.</li><li>Los duelos se resuelven por la jerarquía del truco argentino: ancho de espadas, ancho de bastos, siete de espadas, siete de oros, tres, dos y el resto.</li><li>Tirá el dado y activá hasta dos gauchos distintos por turno. Al completar las dos acciones, el turno pasa solo. También podés finalizar después del primero.</li><li>Cada gaucho sólo puede avanzar un casillero hacia un terreno vecino que coincida con el dado. Si no tiene uno, no puede moverse ese turno.</li><li>Nunca se comparte un terreno: si lo ocupa un aliado, queda bloqueado; si lo ocupa un rival, sólo podés entrar después de desafiarlo y ganar.</li><li>Podés desafiar a un rival adyacente, incluso en la fila anterior, si el terreno que ocupa coincide con el dado.</li><li>Un duelo normal pone en juego dos filas. Si el defensor lo rechaza, retrocede una y el atacante ocupa su lugar.</li><li>Un duelo a muerte pone en juego tres filas, o cuatro si hay una carta de naturaleza comprometida. Rechazarlo penaliza con dos o tres filas, respectivamente.</li><li>Al aceptar un duelo se juegan los dos naipes. Ambos se descartan para siempre y cada gaucho recibe la siguiente carta del mazo.</li><li>Una carta de terreno coincidente con la casilla de salida sube tres posiciones el naipe atacante. Cualquier carta de naturaleza puede jugarse como farol y se descarta.</li><li>Cabalgata permite saltar una fila hasta un terreno del dado. Mate cocido hace perder el próximo turno al rival. Sacrificar un gaucho usa una acción y roba una carta nueva. La meta tiene terreno propio: desde la fila 7 sólo se entra cuando coincide con el dado. Dos gauchos en la meta ganan.</li></ol></Modal>}
    {game.winner && <div className="privacy-overlay victory"><div className="privacy-card"><div className={`wax-seal ${game.winner}`}>★</div><p className="eyebrow">Final</p><h2>¡Victoria de {game.players[game.winner].name}!</h2><p>Dos gauchos completaron la travesía.</p><button className="primary" onClick={restart}>Jugar otra partida</button></div></div>}
  </main>;
}

function Modal({ children }: { children: React.ReactNode }) { return <div className="modal-backdrop"><div className="modal">{children}</div></div>; }
function DuelPanel({ children }: { children: React.ReactNode }) { return <aside className="duel-panel-shell" aria-label="Duelo en curso"><div className="duel-panel">{children}</div></aside>; }
function GauchoDialogue({ piece, speaker, children }: { piece?: Piece | null; speaker: string; children: React.ReactNode }) {
  const owner = piece?.owner || 'blue';
  return <div className={`gaucho-dialogue ${owner}`}><span className={`dialogue-portrait ${owner}`}><CharacterArt type={piece?.type || 'faconero'} /></span><div className="speech-bubble"><small>{speaker}</small><p>{children}</p></div></div>;
}
function WaitingStep({ text, piece }: { text: string; piece?: Piece | null }) { return <div className="privacy-step waiting-step">{piece && <span className={`waiting-portrait ${piece.owner}`}><CharacterArt type={piece.type} /></span>}<span className="sync-dot" /><p className="eyebrow">Partida sincronizada</p><h2>Esperando al otro jugador</h2><p>{text}</p></div>; }
function CharacterArt({ type }: { type: Piece['type'] }) { return <span className={`piece-art ${type}`} aria-hidden="true" />; }
function SpanishPip({ suit }: { suit: TrucoSuit }) {
  return <svg className={`spanish-pip ${suit}`} viewBox="0 0 32 42" aria-hidden="true" focusable="false">
    {suit === 'espada' && <><path d="M16 2 21 9 18.5 28h-5L11 9Z" fill="#dbe2dc" stroke="#536272" strokeWidth="1.6" /><path d="M16 4v22" stroke="#fff9df" strokeWidth="1.5" /><path d="M5 28q11-6 22 0l-2 4q-9-4-18 0Z" fill="#c9943f" stroke="#704920" strokeWidth="1.5" /><path d="M16 30v8" stroke="#714425" strokeWidth="3.5" strokeLinecap="round" /><circle cx="16" cy="39" r="2" fill="#d4a24d" stroke="#704920" /></>}
    {suit === 'basto' && <><path d="M19 3q5 1 4 6L16 37q-1 4-5 2-3-1-2-5L15 8q1-5 4-5Z" fill="#a66a33" stroke="#55351d" strokeWidth="1.8" /><path d="m17 8-6 5m8 7 6-4m-12 12-5-2" stroke="#684122" strokeWidth="3" strokeLinecap="round" /><path d="m20 6-8 29" stroke="#d39a52" strokeWidth="1.5" strokeLinecap="round" /></>}
    {suit === 'oro' && <><circle cx="16" cy="21" r="13" fill="#c38122" stroke="#70431b" strokeWidth="2" /><circle cx="16" cy="21" r="9.5" fill="#f6cd65" stroke="#fff0af" strokeWidth="1.2" /><path d="m16 10 2.2 7.5L26 21l-7.8 3.5L16 32l-2.2-7.5L6 21l7.8-3.5Z" fill="#d89424" stroke="#8f5318" strokeWidth=".7" /><circle cx="16" cy="21" r="3.2" fill="#ffe69a" /></>}
    {suit === 'copa' && <><path d="M4 8h24l-2 10q-2 8-10 9-8-1-10-9Z" fill="#a84030" stroke="#692b23" strokeWidth="1.8" /><path d="M5 9h22M9 14q7 6 14 0" fill="none" stroke="#e8ad65" strokeWidth="2" strokeLinecap="round" /><path d="M16 27v8m-6 3q6-4 12 0" fill="none" stroke="#714123" strokeWidth="3" strokeLinecap="round" /><path d="M9 38h14" stroke="#c88b4c" strokeWidth="2" strokeLinecap="round" /></>}
  </svg>;
}
function TrucoCardView({ card, version, faceUp, owner, compact = false, discarded = false, fresh = false }: { card: TrucoCard | null; version: number; faceUp: boolean; owner: PlayerId; compact?: boolean; discarded?: boolean; fresh?: boolean }) {
  const visible = faceUp && !!card;
  const courtType: Piece['type'] = card?.rank === 11 ? 'payador' : 'faconero';
  return <span key={version} className={`force-card truco-card ${card?.suit || ''} ${owner} ${visible ? 'face-up' : 'face-down'} ${compact ? 'compact' : ''} ${discarded ? 'discarded' : ''} ${fresh ? 'fresh' : ''}`} aria-label={visible ? trucoCardLabel(card) : card ? 'Naipe de truco oculto' : 'Mazo agotado'}>{visible ? <><span className="spanish-corner top"><b>{card.rank}</b><SpanishPip suit={card.suit} /></span><span className="spanish-card-center">{card.rank >= 10 ? <span className={`court-figure rank-${card.rank}`}><CharacterArt type={courtType} /><b>{TRUCO_RANK_LABEL[card.rank]}</b></span> : <span className={`pip-field pips-${card.rank}`}>{Array.from({ length: card.rank }, (_, index) => <SpanishPip suit={card.suit} key={index} />)}</span>}</span><span className="spanish-suit-name">{card.rank} DE {TRUCO_SUIT_LABEL[card.suit]}</span><span className="spanish-corner bottom"><b>{card.rank}</b><SpanishPip suit={card.suit} /></span></> : card ? <><b>PB</b><small>NAIPE OCULTO</small><em>Carta #{version}</em></> : <><b>—</b><small>MAZO AGOTADO</small><em>Sin reemplazo</em></>}</span>;
}
