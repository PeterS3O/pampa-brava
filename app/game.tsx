'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Terrain = 'pampa' | 'monte' | 'sierra';
type BoardTerrain = Terrain | 'pulperia';
type NatureCard = Terrain | 'cabalgata' | 'boleadora';
type PlayerId = 'blue' | 'red' | 'green';
type FourSeat = 'a' | 'b' | 'c' | 'd';
type PlayerRole = PlayerId | FourSeat;
type PlayerCount = 2 | 3 | 4;
type Cell = { row: number; col: number };
type DuelRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
type DuelCard = { id: string; rank: DuelRank };
type Piece = { id: string; name?: string; owner: PlayerId; type: 'faconero' | 'payador'; card: DuelCard | null; cardVersion: number; teamCards?: Partial<Record<FourSeat, DuelCard | null>>; teamCardVersions?: Partial<Record<FourSeat, number>>; revealed: boolean; status: 'camp' | 'board' | 'goal' | 'sacrificed'; position: Cell | null };
type Player = { id: PlayerId; name: string; cards: NatureCard[]; sacrificed: boolean; arrived: number };
type Truce = { blockerId: string; protectedId: string; expiresTurn: number };
type CardRef = { pieceId: string; seat?: FourSeat };
type PieceStats = { duels: number; wins: number; losses: number; distance: number };
type GameStats = { duels: number; pieces: Record<string, PieceStats> };
type Game = { board: BoardTerrain[][]; goalTerrain: Terrain; teams: PlayerId[]; pieces: Piece[]; players: Record<PlayerId, Player>; participantNames: Partial<Record<PlayerRole, string>>; current: PlayerId; currentSeat: FourSeat | null; playerCount: PlayerCount; teamRoundActivations: Partial<Record<PlayerId, string[]>>; turn: number; turnEndsAt: number; startedAt: number; endedAt: number | null; stats: GameStats; pulperiaEnabled: boolean; roll: Terrain | null; activations: string[]; deck: NatureCard[]; natureDiscard: NatureCard[]; trucoDeck: DuelCard[]; trucoDiscard: DuelCard[]; log: string[]; winner: PlayerId | null; truce: Truce | null; limitedTurn: PlayerId | null };
type DuelStake = 'normal' | 'redouble' | 'death';
type RevealedTeamCard = { seat: FourSeat; pieceId: string; card: DuelCard | null };
type DuelNatureResult = { card: NatureCard; origin: Terrain | null; base: number; boost: number; final: number };
type Outcome = { title: string; detail: string; attackerCard: DuelCard | null; defenderCard: DuelCard | null; loserId: string | null; replacementIds: string[]; replacementRefs?: CardRef[]; revealedTeamCards?: RevealedTeamCard[]; teamScores?: Partial<Record<PlayerId, number>>; retreat: number; winner: 'attacker' | 'defender' | 'tie'; stake: DuelStake; decidedBy?: 'cards' | 'raise-refusal'; attackerNature?: DuelNatureResult | null; defenderNature?: DuelNatureResult | null };
type Duel = { attackerId: string; defenders: string[]; defenderId: string | null; target: Cell; from: Cell | null; entry: boolean; ranged: boolean; cardIndex: number | null; defenderCardIndex: number | null; death: boolean; stake: DuelStake; attackerRevealed: boolean; endsAt: number; turnRemainingMs: number; fourPlayer?: boolean; initiatorSeat?: FourSeat; responderSeat?: FourSeat; revealOrder?: FourSeat[]; revealIndex?: number; revealedSeats?: FourSeat[]; passedSeats?: FourSeat[]; raiseProposerSeat?: FourSeat; raiseResponderSeat?: FourSeat; pendingStake?: 'redouble' | 'death'; phase: 'choose-defender' | 'attacker' | 'defender' | 'defender-reveal' | 'redouble-answer' | 'death-confirmation' | 'team-reveal' | 'team-raise-answer' | 'team-outcome' | 'team-replacement' | 'outcome' | 'replacement'; outcome?: Outcome };
type RetreatChoice = { pieceId: string; paths: (Cell | null)[][]; steps: number; resolution: 'duel' | 'refusal' | 'advance' | 'ranged-retreat'; attackerId: string };
type PlayMode = 'online' | 'test' | null;
type MobileSheet = 'turn' | 'nature' | 'gauchos' | null;
type RoomSession = { code: string; token: string; role: PlayerRole; status: 'waiting' | 'active'; version: number; playerCount: PlayerCount };
type SharedSnapshot = { game: Game; duel: Duel | null; retreat: RetreatChoice | null };

// Identificador de la versión con mejoras de UX mobile. Se muestra en la cabecera
// y queda en data-ux-version para verificar qué build está viendo el usuario.
const LABEL: Record<Terrain, string> = { pampa: 'Pampa', monte: 'Monte', sierra: 'Sierra' };
const BOARD_LABEL: Record<BoardTerrain, string> = { ...LABEL, pulperia: 'Pulpería' };
const ICON: Record<Terrain, string> = { pampa: '≈', monte: '♠', sierra: '▲' };
const NATURE_LABEL: Record<NatureCard, string> = { ...LABEL, cabalgata: 'Cabalgata', boleadora: 'Boleadora' };
const NATURE_ICON: Record<NatureCard, string> = { ...ICON, cabalgata: '♞', boleadora: '◉' };
const NATURE_EFFECT: Record<NatureCard, string> = {
  pampa: '+3 al valor, hasta 12, si atacás desde Pampa.',
  monte: '+3 al valor, hasta 12, si atacás desde Monte.',
  sierra: '+3 al valor, hasta 12, si atacás desde Sierra.',
  cabalgata: 'Saltá una fila a un terreno del dado.',
  boleadora: 'Desafiá a distancia. El defensor debe pelear; no puede rechazar el ataque.',
};
const isTerrain = (card: NatureCard): card is Terrain => card === 'pampa' || card === 'monte' || card === 'sierra';
const isPulperia = (cell: Cell, board: BoardTerrain[][]) => board[cell.row]?.[cell.col] === 'pulperia';
const SACRIFICE_NATURE_CARDS: NatureCard[] = ['cabalgata', 'boleadora'];
const PLAYER: Record<PlayerId, string> = { blue: 'Azul', red: 'Rojo', green: 'Verde' };
const FOUR_SEATS: FourSeat[] = ['a', 'b', 'c', 'd'];
const SEAT_TEAM: Record<FourSeat, PlayerId> = { a: 'blue', b: 'red', c: 'blue', d: 'red' };
const SEAT_LABEL: Record<FourSeat, string> = { a: 'Jugador A', b: 'Jugador B', c: 'Jugador C', d: 'Jugador D' };
const isFourSeat = (role: PlayerRole): role is FourSeat => FOUR_SEATS.includes(role as FourSeat);
const roleTeam = (role: PlayerRole): PlayerId => isFourSeat(role) ? SEAT_TEAM[role] : role;
const nextFourSeat = (seat: FourSeat) => FOUR_SEATS[(FOUR_SEATS.indexOf(seat) + 1) % FOUR_SEATS.length];
const seatsFrom = (seat: FourSeat) => Array.from({ length: 4 }, (_, offset) => FOUR_SEATS[(FOUR_SEATS.indexOf(seat) + offset) % 4]);
const DUEL_RANKS: DuelRank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const BOARD_ROWS = 7;
const TURN_DURATION_MS = 45_000;
const DUEL_DURATION_MS = 45_000;
const GAUCHO_NAMES: Record<PlayerId, string[]> = { blue: ['Zoilo', 'Santos', 'Anselmo', 'Eulogio'], red: ['Jacinto', 'Prudencio', 'Laureano', 'Rufino'], green: ['Molina', 'Tadeo', 'Cipriano', 'Doroteo'] };
const TEAM_ORDER: PlayerId[] = ['blue', 'red', 'green'];
const nextTeam = (current: PlayerId, teams: PlayerId[]) => teams[(teams.indexOf(current) + 1) % teams.length];
const cardPower = (card: DuelCard | null) => card?.rank || 0;
const duelCardLabel = (card: DuelCard | null) => card ? `Carta de valor ${card.rank}` : 'Sin carta';
const duelCardBadge = (card: DuelCard | null) => card ? `${card.rank}` : '?';
// La revelación sólo vive dentro del resultado del duelo. En la mesa cada
// jugador ve únicamente el valor de sus propios gauchos, incluso si ese naipe
// ya había sido mostrado en un duelo anterior.
const pieceCardForRole = (piece: Piece, role: PlayerRole, playerCount: PlayerCount) => playerCount === 4 && isFourSeat(role) ? piece.teamCards?.[role] || null : piece.card;
const pieceCardVersionForRole = (piece: Piece, role: PlayerRole, playerCount: PlayerCount) => playerCount === 4 && isFourSeat(role) ? piece.teamCardVersions?.[role] || 1 : piece.cardVersion;
const isDuelCardVisible = (piece: Piece, viewer: PlayerRole) => piece.owner === roleTeam(viewer);
// Alias de compatibilidad para salas iniciadas con una versión anterior.
const trucoCardLabel = duelCardLabel;
const trucoCardBadge = duelCardBadge;
const isTrucoCardVisible = isDuelCardVisible;

function normalizeDuelCard(card: DuelCard | null) {
  if (!card) return card;
  const legacy = card as unknown as { id: string; rank: number; suit?: string };
  const isSpanishDeck = ['espada', 'basto', 'oro', 'copa'].includes(legacy.suit || '');
  const rank = (isSpanishDeck && legacy.rank >= 12 ? 12 : isSpanishDeck && legacy.rank === 11 ? 11 : isSpanishDeck && legacy.rank === 10 ? 10 : Math.max(1, Math.min(12, legacy.rank))) as DuelRank;
  return { id: legacy.id.startsWith('valor-') ? legacy.id : `valor-${rank}-${legacy.id}`, rank };
}

function normalizeNatureCard(card: NatureCard | 'mate_cocido'): NatureCard {
  return card === 'mate_cocido' ? 'boleadora' : card;
}

function normalizeSnapshot(snapshot: SharedSnapshot): SharedSnapshot {
  const normalizeOutcome = (outcome?: Outcome) => outcome && { ...outcome, attackerCard: normalizeDuelCard(outcome.attackerCard), defenderCard: normalizeDuelCard(outcome.defenderCard) };
  const normalizePlayer = (id: PlayerId, name: string): Player => {
    const player = snapshot.game.players[id];
    return player ? { ...player, cards: player.cards.map(card => normalizeNatureCard(card as NatureCard | 'mate_cocido')) } : { id, name, cards: [], sacrificed: false, arrived: 0 };
  };
  const game = {
    ...snapshot.game,
    playerCount: snapshot.game.playerCount || (snapshot.game.teams?.length === 3 ? 3 : 2),
    participantNames: snapshot.game.participantNames || {},
    currentSeat: snapshot.game.currentSeat || null,
    teamRoundActivations: snapshot.game.teamRoundActivations || {},
    startedAt: snapshot.game.startedAt || Date.now(),
    endedAt: snapshot.game.endedAt || null,
    stats: {
      duels: snapshot.game.stats?.duels || 0,
      pieces: Object.fromEntries(snapshot.game.pieces.map(piece => [piece.id, { ...emptyPieceStats(), ...(snapshot.game.stats?.pieces?.[piece.id] || {}) }])),
    },
    pulperiaEnabled: snapshot.game.pulperiaEnabled !== false,
    turnEndsAt: snapshot.game.turnEndsAt || Date.now() + TURN_DURATION_MS,
    truce: snapshot.game.truce || null,
    limitedTurn: snapshot.game.limitedTurn || null,
    deck: snapshot.game.deck.map(card => normalizeNatureCard(card as NatureCard | 'mate_cocido')),
    natureDiscard: (snapshot.game.natureDiscard || []).map(card => normalizeNatureCard(card as NatureCard | 'mate_cocido')),
    players: { blue: normalizePlayer('blue', 'Los Azules'), red: normalizePlayer('red', 'Los Rojos'), green: normalizePlayer('green', 'Los Verdes') },
    teams: snapshot.game.teams || [...new Set(snapshot.game.pieces.map(piece => piece.owner))] as PlayerId[],
    pieces: snapshot.game.pieces.map(piece => ({ ...piece, type: piece.owner === 'red' ? 'payador' as const : 'faconero' as const, card: normalizeDuelCard(piece.card), teamCards: piece.teamCards ? Object.fromEntries(Object.entries(piece.teamCards).map(([seat, card]) => [seat, normalizeDuelCard(card || null)])) : undefined, teamCardVersions: piece.teamCardVersions })),
    trucoDeck: snapshot.game.trucoDeck.map(normalizeDuelCard).filter((card): card is DuelCard => !!card),
    trucoDiscard: snapshot.game.trucoDiscard.map(normalizeDuelCard).filter((card): card is DuelCard => !!card),
  };
  const now = Date.now();
  return { ...snapshot, game, duel: snapshot.duel ? { ...snapshot.duel, endsAt: snapshot.duel.endsAt || now + DUEL_DURATION_MS, turnRemainingMs: snapshot.duel.turnRemainingMs ?? Math.max(0, game.turnEndsAt - now), fourPlayer: snapshot.duel.fourPlayer ?? false, ranged: snapshot.duel.ranged ?? false, defenderCardIndex: snapshot.duel.defenderCardIndex ?? null, stake: snapshot.duel.stake ?? (snapshot.duel.death ? 'death' : 'normal'), attackerRevealed: snapshot.duel.attackerRevealed ?? ['outcome', 'replacement'].includes(snapshot.duel.phase), outcome: normalizeOutcome(snapshot.duel.outcome) } : null };
}
const key = (c: Cell) => `${c.row}-${c.col}`;
const same = (a: Cell | null, b: Cell | null) => !!a && !!b && a.row === b.row && a.col === b.col;
const short = (p: Piece) => p.name || `${p.type === 'faconero' ? 'Faconero' : 'Payador'} ${p.id.match(/\d+$/)?.[0] || '1'}`;
const badge = (p: Piece) => p.name ? p.name.slice(0, 3).toUpperCase() : `${p.type === 'faconero' ? 'F' : 'P'}${p.id.match(/\d+$/)?.[0] || '1'}`;
const TERRAIN: Terrain[] = ['pampa', 'monte', 'sierra'];
const emptyPieceStats = (): PieceStats => ({ duels: 0, wins: 0, losses: 0, distance: 0 });

function updatePieceStats(game: Game, pieceId: string, changes: Partial<PieceStats>): Game {
  const current = game.stats.pieces[pieceId] || emptyPieceStats();
  const next = Object.fromEntries(Object.entries(changes).map(([key, amount]) => [key, current[key as keyof PieceStats] + (amount || 0)])) as Partial<PieceStats>;
  return { ...game, stats: { ...game.stats, pieces: { ...game.stats.pieces, [pieceId]: { ...current, ...next } } } };
}

function recordDuelStart(game: Game, attackerId: string, defenderId: string): Game {
  const attackerUpdated = updatePieceStats(game, attackerId, { duels: 1 });
  const bothUpdated = updatePieceStats(attackerUpdated, defenderId, { duels: 1 });
  return { ...bothUpdated, stats: { ...bothUpdated.stats, duels: bothUpdated.stats.duels + 1 } };
}

function recordDuelResult(game: Game, winnerId: string | null, loserId: string | null): Game {
  let next = game;
  if (winnerId) next = updatePieceStats(next, winnerId, { wins: 1 });
  if (loserId) next = updatePieceStats(next, loserId, { losses: 1 });
  return next;
}

function recordMovement(game: Game, pieceId: string, distance: number): Game {
  return distance > 0 ? updatePieceStats(game, pieceId, { distance }) : game;
}

function playerDisplayName(game: Game, role: PlayerRole) {
  return game.participantNames[role] || (isFourSeat(role) ? SEAT_LABEL[role] : PLAYER[role]);
}

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

function makeDuelDeck(rng: () => number = secureRandom) {
  return shuffle(DUEL_RANKS.flatMap(rank => Array.from({ length: 4 }, (_, copy) => ({ id: `valor-${rank}-${copy + 1}`, rank }))), rng);
}

function makeNatureDeck(rng: () => number = secureRandom) {
  return shuffle<NatureCard>([
    ...Array<NatureCard>(8).fill('pampa'),
    ...Array<NatureCard>(8).fill('monte'),
    ...Array<NatureCard>(8).fill('sierra'),
    ...Array<NatureCard>(3).fill('cabalgata'),
    ...Array<NatureCard>(3).fill('boleadora'),
  ], rng);
}

function takeNatureCard(deck: NatureCard[], card: NatureCard) {
  const index = deck.indexOf(card);
  return index < 0 ? null : [...deck.slice(0, index), ...deck.slice(index + 1)];
}

function makeGame(rng: () => number = secureRandom, playerCount: PlayerCount = 2, pulperiaEnabled = true): Game {
  const terrain = shuffle<Terrain>([...Array<Terrain>(12).fill('pampa'), ...Array<Terrain>(12).fill('monte'), ...Array<Terrain>(11).fill('sierra')], rng);
  const board: Terrain[][] = [];
  let at = 0;
  for (let row = 0; row < BOARD_ROWS; row += 1) { const rowLength = BOARD_ROWS + 1 - row; board.push(terrain.slice(at, at + rowLength)); at += rowLength; }
  // La Pulpería vive en la franja media: nunca es una salida inmediata desde el
  // campamento y siempre obliga a llegar a ella como una decisión de recorrido.
  const pulperiaRow = 2 + Math.floor(rng() * 3);
  const pulperiaCol = Math.floor(rng() * board[pulperiaRow].length);
  const boardWithPulperia: BoardTerrain[][] = pulperiaEnabled ? board.map((row, rowIndex) => row.map((cell, colIndex) => rowIndex === pulperiaRow && colIndex === pulperiaCol ? 'pulperia' : cell)) : board;
  const deck = makeNatureDeck(rng);
  const teams = playerCount === 4 ? TEAM_ORDER.slice(0, 2) : TEAM_ORDER.slice(0, playerCount);
  const startingNature = Object.fromEntries(teams.map(team => [team, deck.pop()!])) as Partial<Record<PlayerId, NatureCard>>;
  const trucoDeck = makeDuelDeck(rng);
  const pieces = teams.flatMap(owner => GAUCHO_NAMES[owner].map((name, index) => {
    const teamSeats = owner === 'blue' ? ['a', 'c'] as FourSeat[] : ['b', 'd'] as FourSeat[];
    return { id: `${owner}-g${index + 1}`, name, owner, type: (owner === 'red' ? 'payador' : 'faconero') as Piece['type'], card: playerCount === 4 ? null : trucoDeck.pop() || null, cardVersion: 1, teamCards: playerCount === 4 ? Object.fromEntries(teamSeats.map(seat => [seat, trucoDeck.pop() || null])) : undefined, teamCardVersions: playerCount === 4 ? Object.fromEntries(teamSeats.map(seat => [seat, 1])) : undefined, revealed: false, status: 'camp' as const, position: null };
  }));
  const currentSeat = playerCount === 4 ? FOUR_SEATS[Math.floor(rng() * FOUR_SEATS.length)] : null;
  const current = currentSeat ? SEAT_TEAM[currentSeat] : teams[Math.floor(rng() * teams.length)];
  const goalTerrain = TERRAIN[Math.floor(rng() * TERRAIN.length)];
  const now = Date.now();
  const stats: GameStats = { duels: 0, pieces: Object.fromEntries(pieces.map(piece => [piece.id, emptyPieceStats()])) };
  return { board: boardWithPulperia, goalTerrain, teams, pieces, players: { blue: { id: 'blue', name: 'Los Azules', cards: startingNature.blue ? [startingNature.blue] : [], sacrificed: false, arrived: 0 }, red: { id: 'red', name: 'Los Rojos', cards: startingNature.red ? [startingNature.red] : [], sacrificed: false, arrived: 0 }, green: { id: 'green', name: 'Los Verdes', cards: startingNature.green ? [startingNature.green] : [], sacrificed: false, arrived: 0 } }, participantNames: {}, current, currentSeat, playerCount, teamRoundActivations: {}, turn: 1, turnEndsAt: now + TURN_DURATION_MS, startedAt: now, endedAt: null, stats, pulperiaEnabled, roll: null, activations: [], deck, natureDiscard: [], trucoDeck, trucoDiscard: [], log: [`La meta es terreno de ${LABEL[goalTerrain]}.`, ...(pulperiaEnabled ? [`La Pulpería quedó instalada en la fila ${pulperiaRow + 1}.`] : ['Esta partida se juega sin Pulpería.']), `Cada bando recibió una carta de naturaleza al azar.`, playerCount === 4 ? `Cada gaucho recibió dos cartas de duelo, una por compañero.` : `Se repartió una carta de duelo a cada gaucho.`, `El sorteo eligió ${currentSeat ? `al ${SEAT_LABEL[currentSeat]} del equipo ${PLAYER[current]}` : `al ${PLAYER[current]}`}. La travesía comienza.`], winner: null, truce: null, limitedTurn: null };
}

function withLog(game: Game, message: string): Game {
  return { ...game, log: [message, ...game.log].slice(0, 12) };
}

function passTurn(game: Game, reason: string): Game {
  if (game.winner) return game;
  const nextSeat = game.playerCount === 4 && game.currentSeat ? nextFourSeat(game.currentSeat) : null;
  const next = nextSeat ? SEAT_TEAM[nextSeat] : nextTeam(game.current, game.teams);
  const resetTeam = nextSeat === 'a' ? 'blue' : nextSeat === 'b' ? 'red' : null;
  const teamRoundActivations = resetTeam ? { ...game.teamRoundActivations, [resetTeam]: [] } : game.teamRoundActivations;
  const nextRole: PlayerRole = nextSeat || next;
  return withLog({ ...game, current: next, currentSeat: nextSeat, teamRoundActivations, turn: game.turn + 1, turnEndsAt: Date.now() + TURN_DURATION_MS, roll: null, activations: [], limitedTurn: game.limitedTurn === game.current ? null : game.limitedTurn }, `${reason} Ahora juega ${playerDisplayName(game, nextRole)}${nextSeat ? ` · equipo ${PLAYER[next]}` : ''}.`);
}

function completeActivation(game: Game, pieceId: string): Game {
  const activations = [...game.activations, pieceId];
  const teamRoundActivations = game.playerCount === 4 ? { ...game.teamRoundActivations, [game.current]: [...(game.teamRoundActivations[game.current] || []).filter(id => id !== pieceId), pieceId] } : game.teamRoundActivations;
  const updated = { ...game, activations, teamRoundActivations };
  const actionLimit = game.limitedTurn === game.current ? 1 : 2;
  return activations.length >= actionLimit ? passTurn(updated, `${PLAYER[game.current]} completó sus ${actionLimit} ${actionLimit === 1 ? 'acción' : 'acciones'}.`) : updated;
}

function resumeTurnTimer(game: Game, duel: Duel): Game {
  return { ...game, turnEndsAt: Date.now() + Math.max(0, duel.turnRemainingMs) };
}

function replaceCardRefs(game: Game, refs: CardRef[], rng: () => number = secureRandom) {
  let duelDeck = [...game.trucoDeck], duelDiscard = [...game.trucoDiscard];
  const replacements = new Map<string, DuelCard | null>();
  refs.forEach(ref => {
    const piece = game.pieces.find(p => p.id === ref.pieceId);
    const card = ref.seat ? piece?.teamCards?.[ref.seat] : piece?.card;
    if (card) duelDiscard.push(card);
  });
  const recycled = duelDeck.length < refs.length && duelDiscard.length > 0;
  if (recycled) { duelDeck = shuffle([...duelDeck, ...duelDiscard], rng); duelDiscard = []; }
  refs.forEach(ref => replacements.set(`${ref.pieceId}:${ref.seat || 'solo'}`, duelDeck.pop() || null));
  const pieces = game.pieces.map(piece => {
    const pieceRefs = refs.filter(ref => ref.pieceId === piece.id);
    if (!pieceRefs.length) return piece;
    let updated = { ...piece };
    pieceRefs.forEach(ref => {
      const replacement = replacements.get(`${ref.pieceId}:${ref.seat || 'solo'}`) || null;
      if (ref.seat) updated = { ...updated, teamCards: { ...updated.teamCards, [ref.seat]: replacement }, teamCardVersions: { ...updated.teamCardVersions, [ref.seat]: (updated.teamCardVersions?.[ref.seat] || 1) + 1 }, revealed: false };
      else updated = { ...updated, card: replacement, cardVersion: updated.cardVersion + 1, revealed: false };
    });
    return updated;
  });
  const updated = { ...game, pieces, trucoDeck: duelDeck, trucoDiscard: duelDiscard };
  return recycled ? withLog(updated, 'Se agotó la baraja: se mezclaron los naipes descartados y se repartieron de nuevo.') : updated;
}

function replacePlayedCards(game: Game, pieceIds: string[], rng: () => number = secureRandom) {
  return replaceCardRefs(game, pieceIds.map(pieceId => ({ pieceId })), rng);
}

const outcomeCardRefs = (outcome: Outcome) => outcome.replacementRefs || outcome.replacementIds.map(pieceId => ({ pieceId }));

function neighbors(c: Cell, board: BoardTerrain[][]) {
  const out: Cell[] = [];
  if (c.col > 0) out.push({ row: c.row, col: c.col - 1 });
  if (c.col + 1 < board[c.row].length) out.push({ row: c.row, col: c.col + 1 });
  if (c.row < board.length - 1) {
    if (c.col > 0 && c.col - 1 < board[c.row + 1].length) out.push({ row: c.row + 1, col: c.col - 1 });
    if (c.col < board[c.row + 1].length) out.push({ row: c.row + 1, col: c.col });
  }
  return out;
}

function cabalgataTargets(piece: Piece, board: BoardTerrain[][]): Cell[] {
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
  return Array.from(new Map(all.map(p => [p.map(c => c ? key(c) : 'camp').join('|'), p])).values());
}

function availableRetreatPaths(start: Cell, steps: number, pieces: Piece[], movingId: string) {
  const paths = retreatPaths(start, steps).filter(path => {
    return path.every(cell => !cell || !pieces.some(piece => piece.id !== movingId && piece.status === 'board' && same(piece.position, cell)));
  });
  return paths.length ? paths : [[null]];
}

function isForcedCampRetreat(paths: (Cell | null)[][]) {
  return paths.length > 0 && paths.every(path => !path.at(-1));
}

function advanceCells(start: Cell | null, steps: number, board: BoardTerrain[][]) {
  let cells: (Cell | null)[] = [start];
  for (let step = 0; step < steps; step += 1) {
    cells = cells.flatMap(cell => {
      if (!cell) return board[0].map((_, col) => ({ row: 0, col }));
      if (cell.row >= board.length - 1) return [cell];
      return [{ row: cell.row + 1, col: Math.max(0, cell.col - 1) }, { row: cell.row + 1, col: Math.min(board[cell.row + 1].length - 1, cell.col) }];
    });
    cells = Array.from(new Map(cells.map(cell => [cell ? key(cell) : 'camp', cell])).values());
  }
  return cells.filter((cell): cell is Cell => !!cell);
}

function resolveBoleadoraPositions(game: Game, duel: Duel, winner: 'attacker' | 'defender', steps: number, autoAdvance = true): Game {
  if (!duel.defenderId) return game;
  const attacker = game.pieces.find(piece => piece.id === duel.attackerId);
  const defender = game.pieces.find(piece => piece.id === duel.defenderId);
  if (!attacker || !defender) return game;
  const winnerPiece = winner === 'attacker' ? attacker : defender;
  const loserPiece = winner === 'attacker' ? defender : attacker;
  const movingIds = new Set([winnerPiece.id, loserPiece.id]);
  const isOpen = (cell: Cell | null, pieces: Piece[], pieceId: string) => !cell || !pieces.some(piece => piece.id !== pieceId && !movingIds.has(piece.id) && piece.status === 'board' && same(piece.position, cell));
  const retreat = loserPiece.position ? availableRetreatPaths(loserPiece.position, steps, game.pieces.filter(piece => piece.id !== winnerPiece.id), loserPiece.id).map(path => path.at(-1) || null).find(cell => isOpen(cell, game.pieces, loserPiece.id)) || null : null;
  let pieces = game.pieces.map(piece => piece.id === loserPiece.id ? { ...piece, status: retreat ? 'board' as const : 'camp' as const, position: retreat } : piece);
  // Sólo el atacante gana filas: el defensor que gana conserva su casillero.
  const advance = autoAdvance && winner === 'attacker' ? advanceCells(winnerPiece.position, steps, game.board).find(cell => isOpen(cell, pieces, winnerPiece.id)) : undefined;
  if (advance) pieces = pieces.map(piece => piece.id === winnerPiece.id ? { ...piece, status: 'board' as const, position: advance } : piece);
  return { ...game, pieces };
}

// Casilleros a los que puede avanzar el atacante que ganó con boleadora: los elige él.
function boleadoraAdvanceOptions(game: Game, pieceId: string, steps: number): Cell[] {
  const piece = game.pieces.find(value => value.id === pieceId);
  if (!piece) return [];
  return advanceCells(piece.status === 'board' ? piece.position : null, steps, game.board)
    .filter((cell): cell is Cell => !!cell && !same(cell, piece.position) && !game.pieces.some(other => other.id !== pieceId && other.status === 'board' && same(other.position, cell)));
}

// Retirada elegida por el perdedor de un duelo con boleadora.
function resolveRangedRetreat(game: Game, choice: RetreatChoice, destination: Cell | null): Game | null {
  if (choice.resolution !== 'ranged-retreat') return null;
  const piece = game.pieces.find(value => value.id === choice.pieceId);
  if (!piece) return null;
  if (!choice.paths.some(path => { const end = path.at(-1) || null; return !end && !destination || same(end, destination); })) return null;
  if (destination && (same(piece.position, destination) || game.pieces.some(other => other.id !== choice.pieceId && other.status === 'board' && same(other.position, destination)))) return null;
  return { ...game, pieces: game.pieces.map(value => value.id === choice.pieceId ? { ...value, position: destination, status: destination ? 'board' as const : 'camp' as const } : value) };
}

function resolveBoleadoraAdvance(game: Game, choice: RetreatChoice, destination: Cell | null): Game | null {
  if (choice.resolution !== 'advance' || !destination) return null;
  if (!choice.paths.some(path => same(path.at(-1) || null, destination))) return null;
  if (game.pieces.some(piece => piece.id !== choice.pieceId && piece.status === 'board' && same(piece.position, destination))) return null;
  if (!game.pieces.some(piece => piece.id === choice.pieceId)) return null;
  return { ...game, pieces: game.pieces.map(piece => piece.id === choice.pieceId ? { ...piece, status: 'board' as const, position: destination } : piece) };
}

function duelNeighbors(cell: Cell, board: BoardTerrain[][]): Cell[] {
  return neighbors(cell, board);
}

function attackTargetsForPiece(piece: Piece, pieces: Piece[], board: BoardTerrain[][]): Cell[] {
  if (piece.status === 'board' && piece.position && isPulperia(piece.position, board)) return [];
  const candidates = piece.status === 'camp'
    ? board[0].map((_, col) => ({ row: 0, col }))
    : piece.status === 'board' && piece.position ? duelNeighbors(piece.position, board) : [];
  return candidates.filter(cell => !pieces.some(otherPiece => otherPiece.owner === piece.owner && otherPiece.status === 'board' && same(otherPiece.position, cell)) && pieces.some(otherPiece => otherPiece.owner !== piece.owner && otherPiece.status === 'board' && same(otherPiece.position, cell)));
}

function boleadoraTargetsForPiece(piece: Piece, pieces: Piece[], board?: BoardTerrain[][]): Cell[] {
  if (piece.status === 'goal' || piece.status === 'sacrificed') return [];
  if (board && piece.status === 'board' && piece.position && isPulperia(piece.position, board)) return [];
  return pieces.filter(otherPiece => otherPiece.owner !== piece.owner && otherPiece.status === 'board' && !!otherPiece.position).map(otherPiece => otherPiece.position!);
}

function canEnterByMovementDie(cell: Cell, board: BoardTerrain[][], roll: Terrain) {
  return isPulperia(cell, board) || board[cell.row][cell.col] === roll;
}

function resolveDuelCards(attacker: Piece, defender: Piece, nature: NatureCard | null, origin: Terrain | null, death: boolean, defenderNature: NatureCard | null = null, defenderOrigin: Terrain | null = origin) {
  const natureBoost = nature && nature === origin ? Math.min(3, 12 - cardPower(attacker.card)) : 0;
  const defenderNatureBoost = defenderNature && defenderNature === defenderOrigin ? Math.min(3, 12 - cardPower(defender.card)) : 0;
  const attackerOrder = cardPower(attacker.card) + natureBoost;
  const defenderOrder = cardPower(defender.card) + defenderNatureBoost;
  const winner: Outcome['winner'] = attackerOrder === defenderOrder ? 'tie' : attackerOrder > defenderOrder ? 'attacker' : 'defender';
  const loserId = winner === 'attacker' ? defender.id : winner === 'defender' ? attacker.id : null;
  const retreatSteps = winner === 'tie' ? 0 : death ? (nature || defenderNature ? 4 : 3) : 2;
  return { natureBoost, defenderNatureBoost, attackerOrder, defenderOrder, winner, loserId, retreatSteps };
}

function advanceDuelToReveal(duel: Duel, stake: DuelStake): Duel {
  return { ...duel, stake, death: stake === 'death', attackerRevealed: true, phase: 'defender-reveal' };
}

function makeRaiseRefusalOutcome(game: Game, duel: Duel, loserSide: 'attacker' | 'defender', acceptedStake: 'normal' | 'redouble', rejectedRaise: 'redouble' | 'death'): Outcome | null {
  if (!duel.defenderId) return null;
  const attacker = game.pieces.find(piece => piece.id === duel.attackerId);
  const defender = game.pieces.find(piece => piece.id === duel.defenderId);
  if (!attacker || !defender) return null;
  const loser = loserSide === 'attacker' ? attacker : defender;
  const winner = loserSide === 'attacker' ? defender : attacker;
  const replacementIds = duel.attackerRevealed ? [attacker.id] : [];
  const raiseLabel = rejectedRaise === 'redouble' ? 'el redoble' : 'el duelo a muerte';
  const stakeLabel = acceptedStake === 'normal' ? 'duelo normal' : 'duelo redoblado';
  return {
    title: `¡Ganó el equipo ${PLAYER[winner.owner]}!`,
    detail: `${short(loser)} rechazó ${raiseLabel}; pierde el ${stakeLabel}, que era la apuesta ya aceptada.`,
    attackerCard: attacker.card,
    defenderCard: defender.card,
    loserId: loser.id,
    replacementIds,
    retreat: acceptedStake === 'redouble' ? 3 : 2,
    winner: loserSide === 'attacker' ? 'defender' : 'attacker',
    stake: acceptedStake,
    decidedBy: 'raise-refusal',
  };
}

function resolveRefusalPositions(game: Game, duel: Duel): Game | null {
  if (!duel.defenderId || duel.phase !== 'defender') return null;
  const attacker = game.pieces.find(piece => piece.id === duel.attackerId);
  const defender = game.pieces.find(piece => piece.id === duel.defenderId);
  if (!attacker || !defender || attacker.owner === defender.owner || attacker.owner !== game.current || !same(defender.position, duel.target)) return null;
  if (duel.from ? !same(attacker.position, duel.from) : attacker.status !== 'camp') return null;
  const pieces = game.pieces.map(piece => {
    if (piece.id === attacker.id) return { ...piece, status: 'board' as const, position: duel.target };
    if (piece.id === defender.id) return { ...piece, status: duel.from ? 'board' as const : 'camp' as const, position: duel.from };
    return piece;
  });
  return { ...game, pieces };
}

function resolveRetreatPositions(game: Game, duel: Duel, retreat: RetreatChoice, destination: Cell | null): Game | null {
  if (!duel.defenderId || retreat.attackerId !== duel.attackerId) return null;
  const attacker = game.pieces.find(piece => piece.id === duel.attackerId);
  const defender = game.pieces.find(piece => piece.id === duel.defenderId);
  if (!attacker || !defender || attacker.owner === defender.owner || attacker.owner !== game.current || !same(defender.position, duel.target)) return null;
  if (duel.from ? !same(attacker.position, duel.from) : attacker.status !== 'camp') return null;
  const defenderRefused = retreat.resolution === 'refusal' && duel.phase === 'defender' && retreat.pieceId === duel.defenderId;
  const lostAcceptedDuel = retreat.resolution === 'duel' && ['outcome', 'team-outcome'].includes(duel.phase) && retreat.pieceId === duel.outcome?.loserId;
  if (!defenderRefused && !lostAcceptedDuel) return null;
  const retreatingPiece = game.pieces.find(piece => piece.id === retreat.pieceId);
  if (!retreatingPiece) return null;
  const allowedDestination = retreat.paths?.some(path => {
    const pathDestination = path.at(-1) || null;
    return !pathDestination && !destination || same(pathDestination, destination);
  });
  if (retreat.paths?.length && !allowedDestination) return null;
  if (destination && same(retreatingPiece.position, destination)) return null;
  const attackerOccupiesTarget = defenderRefused || lostAcceptedDuel && retreat.pieceId === duel.defenderId;
  // Cuando el defensor pierde, el atacante toma la casilla disputada. Su casilla de
  // origen queda libre también durante la retirada, incluso si el camino la atraviesa.
  const attackerLeavesOrigin = lostAcceptedDuel && retreat.pieceId === duel.defenderId;
  if (destination && game.pieces.some(piece => piece.id !== retreat.pieceId && !(attackerLeavesOrigin && piece.id === duel.attackerId) && piece.status === 'board' && same(piece.position, destination))) return null;
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
  const [playerName, setPlayerName] = useState('');
  const [roomBusy, setRoomBusy] = useState(false), [roomError, setRoomError] = useState('');
  const [withPulperia, setWithPulperia] = useState(true);
  const [clock, setClock] = useState(() => Date.now());
  const [selected, setSelected] = useState<string | null>(null);
  const [rideIndex, setRideIndex] = useState<number | null>(null);
  const [pulperiaSwapTarget, setPulperiaSwapTarget] = useState<string | null>(null);
  const [retreat, setRetreat] = useState<RetreatChoice | null>(null), [duel, setDuel] = useState<Duel | null>(null);
  const [rules, setRules] = useState(false), [confirmSacrifice, setConfirmSacrifice] = useState(false), [sacrificeChoice, setSacrificeChoice] = useState<NatureCard | null>(null);
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const isMobileLayout = useMediaQuery('(max-width: 900px)');
  const [boardZoom, setBoardZoom] = useState(false);
  useEffect(() => {
    const wrap = document.querySelector<HTMLElement>('.board-wrap');
    if (wrap) wrap.scrollLeft = boardZoom ? (wrap.scrollWidth - wrap.clientWidth) / 2 : 0;
  }, [boardZoom]);
  const lastSnapshot = useRef('');
  const pendingSnapshot = useRef('');
  const roomVersion = useRef(0);
  const writeInFlight = useRef(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [syncRetry, setSyncRetry] = useState(0);
  const viewerRole: PlayerRole = mode === 'test' ? game.current : room?.role || game.current;
  const viewer = roleTeam(viewerRole);
  const currentRole: PlayerRole = game.playerCount === 4 && game.currentSeat ? game.currentSeat : game.current;
  const isMyTurn = mode === 'test' || mode === 'online' && viewerRole === currentRole;
  const activeRoomCode = room?.code, activeRoomToken = room?.token, activeRoomStatus = room?.status, activeRoomVersion = room?.version;
  const player = game.players[viewer], selectedPiece = game.pieces.find(p => p.id === selected) || null;
  const availableNatureCount = (card: NatureCard) => game.deck.filter(value => value === card).length;
  const actionLimit = game.limitedTurn === game.current ? 1 : 2;
  const secondsLeft = duel ? Math.max(0, Math.ceil(duel.turnRemainingMs / 1000)) : Math.max(0, Math.ceil((game.turnEndsAt - clock) / 1000));
  const duelSecondsLeft = duel ? Math.max(0, Math.ceil((duel.endsAt - clock) / 1000)) : 0;
  const rivalNatureCount = game.teams.filter(team => team !== viewer).reduce((total, team) => total + game.players[team].cards.length, 0);
  const log = withLog;

  const installRoom = (data: RoomSession & { snapshot: SharedSnapshot }) => {
    const snapshot = normalizeSnapshot(data.snapshot);
    const serialized = JSON.stringify(snapshot);
    lastSnapshot.current = serialized;
    pendingSnapshot.current = '';
    roomVersion.current = data.version;
    writeInFlight.current = false;
    setGame(snapshot.game); setDuel(snapshot.duel); setRetreat(snapshot.retreat);
    setRoom({ code: data.code, token: data.token, role: data.role, status: data.status, playerCount: data.playerCount, version: data.version });
    setMode('online'); setSelected(null); setRideIndex(null); setPulperiaSwapTarget(null); setRoomError('');
  };
  const createRoom = async (playerCount: PlayerCount) => {
    const name = playerName.trim().slice(0, 24); if (!name) { setRoomError('Escribí tu nombre para crear la sala.'); return; }
    setRoomBusy(true); setRoomError('');
    try {
      const initialGame = makeGame(secureRandom, playerCount, withPulperia);
      const hostRole: PlayerRole = playerCount === 4 ? 'a' : 'blue';
      const snapshot: SharedSnapshot = { game: { ...initialGame, participantNames: { [hostRole]: name } }, duel: null, retreat: null };
      const response = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snapshot, playerCount, name }) });
      const data = await response.json() as RoomSession & { snapshot: SharedSnapshot; error?: string }; if (!response.ok) throw new Error(data.error || 'No se pudo crear la sala.');
      installRoom(data);
    } catch (error) { setRoomError(error instanceof Error ? error.message : 'No se pudo crear la sala.'); }
    finally { setRoomBusy(false); }
  };
  const joinRoom = async () => {
    const code = roomCode.trim().toUpperCase(), name = playerName.trim().slice(0, 24); if (!code) return; if (!name) { setRoomError('Escribí tu nombre para entrar a la sala.'); return; }
    setRoomBusy(true); setRoomError('');
    try {
      const response = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'join', code, name }) });
      const data = await response.json() as RoomSession & { snapshot: SharedSnapshot; error?: string }; if (!response.ok) throw new Error(data.error || 'No se pudo entrar a la sala.');
      installRoom(data);
    } catch (error) { setRoomError(error instanceof Error ? error.message : 'No se pudo entrar a la sala.'); }
    finally { setRoomBusy(false); }
  };

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (mode === null || !isMyTurn || duel || retreat || game.winner || clock < game.turnEndsAt) return;
    const timeout = window.setTimeout(() => {
      setGame(state => {
        if (state.current !== viewer || state.winner || Date.now() < state.turnEndsAt) return state;
        const timedRole: PlayerRole = state.playerCount === 4 && state.currentSeat ? state.currentSeat : state.current;
        return passTurn(state, `Se agotaron los 45 segundos del turno de ${playerDisplayName(state, timedRole)}.`);
      });
      setSelected(null); setRideIndex(null); setPulperiaSwapTarget(null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [clock, game.turnEndsAt, game.winner, isMyTurn, duel, retreat, mode, viewer]);

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
          const snapshot = normalizeSnapshot(data.snapshot as SharedSnapshot);
          lastSnapshot.current = JSON.stringify(snapshot);
          setGame(snapshot.game); setDuel(snapshot.duel); setRetreat(snapshot.retreat); setSelected(null); setRideIndex(null); setPulperiaSwapTarget(null);
        }
        roomVersion.current = Math.max(roomVersion.current, data.version);
        setRoom(current => current ? { ...current, status: data.status, playerCount: data.playerCount || current.playerCount, version: Math.max(current.version, data.version) } : current);
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
        const data = await response.json() as { version: number; status?: RoomSession['status']; playerCount?: PlayerCount; snapshot?: SharedSnapshot };
        if (response.ok) {
          lastSnapshot.current = serialized;
          if (pendingSnapshot.current === serialized) pendingSnapshot.current = '';
          roomVersion.current = data.version;
          setRoom(current => current ? { ...current, version: data.version } : current);
          setSyncNotice('');
        } else if (response.status === 409 && data.snapshot) {
          const snapshot = normalizeSnapshot(data.snapshot);
          lastSnapshot.current = JSON.stringify(snapshot);
          pendingSnapshot.current = '';
          roomVersion.current = data.version;
          setGame(snapshot.game); setDuel(snapshot.duel); setRetreat(snapshot.retreat);
          setSelected(null); setRideIndex(null); setPulperiaSwapTarget(null);
          setRoom(current => current ? { ...current, version: data.version, status: data.status || current.status, playerCount: data.playerCount || current.playerCount } : current);
          setSyncNotice('La jugada del rival llegó primero. Se actualizó la partida; revisá el tablero.');
        }
      } catch {
        setSyncNotice('No se pudo guardar la jugada. Reintentando la conexión…');
        window.setTimeout(() => setSyncRetry(value => value + 1), 1000);
      } finally {
        writeInFlight.current = false;
        // Una segunda acción puede ocurrir mientras la primera se está guardando.
        // Forzamos un nuevo ciclo para que nunca quede un paso del duelo sólo en este dispositivo.
        if (pendingSnapshot.current && pendingSnapshot.current !== lastSnapshot.current) setSyncRetry(value => value + 1);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [game, duel, retreat, activeRoomCode, activeRoomToken, activeRoomStatus, activeRoomVersion, syncRetry]);

  const destinations = useMemo(() => {
    if (!selectedPiece || !game.roll) return [] as Cell[];
    const roll = game.roll;
    const available = (cell: Cell) => !game.pieces.some(piece => piece.id !== selectedPiece.id && piece.status === 'board' && same(piece.position, cell));
    if (rideIndex !== null && player.cards[rideIndex] === 'cabalgata') return cabalgataTargets(selectedPiece, game.board).filter(cell => game.board[cell.row][cell.col] === game.roll && available(cell));
    if (selectedPiece.status === 'camp') return game.board[0].map((_, col) => ({ row: 0, col })).filter(c => game.board[0][c.col] === game.roll && available(c));
    if (selectedPiece.status !== 'board' || !selectedPiece.position) return [] as Cell[];
    return neighbors(selectedPiece.position, game.board).filter(cell => canEnterByMovementDie(cell, game.board, roll) && available(cell));
  }, [selectedPiece, game.roll, game.board, game.pieces, player.cards, rideIndex]);
  const highlighted = new Set(destinations.map(key));
  const attackTargetsFor = (piece: Piece) => attackTargetsForPiece(piece, game.pieces, game.board).filter(cell => {
    const truce = game.truce;
    return !truce || truce.blockerId !== piece.id || truce.expiresTurn !== game.turn || !game.pieces.some(otherPiece => otherPiece.id === truce.protectedId && otherPiece.status === 'board' && same(otherPiece.position, cell));
  });
  const boleadoraTargetsFor = (piece: Piece) => boleadoraTargetsForPiece(piece, game.pieces, game.board).filter(cell => {
    const truce = game.truce;
    return !truce || truce.blockerId !== piece.id || truce.expiresTurn !== game.turn || !game.pieces.some(otherPiece => otherPiece.id === truce.protectedId && otherPiece.status === 'board' && same(otherPiece.position, cell));
  });
  const armedNature = rideIndex === null ? null : player.cards[rideIndex] || null;
  const boleadoraArmed = armedNature === 'boleadora';
  const usedByTeammateThisRound = (pieceId: string) => game.playerCount === 4 && (game.teamRoundActivations[viewer] || []).includes(pieceId) && !game.activations.includes(pieceId);
  const challengeCells = selectedPiece && isMyTurn && !usedByTeammateThisRound(selectedPiece.id)
    ? boleadoraArmed ? boleadoraTargetsFor(selectedPiece) : attackTargetsFor(selectedPiece)
    : [];
  const challengeKeys = new Set(challengeCells.map(key));
  const friendlyBlocked = !!selectedPiece && !!game.roll && (selectedPiece.status === 'camp' ? game.board[0].map((_, col) => ({ row: 0, col })) : selectedPiece.status === 'board' && selectedPiece.position ? neighbors(selectedPiece.position, game.board) : []).some(cell => canEnterByMovementDie(cell, game.board, game.roll!) && game.pieces.some(piece => piece.id !== selectedPiece.id && piece.owner === selectedPiece.owner && piece.status === 'board' && same(piece.position, cell)));

  const selectable = (p: Piece) => isMyTurn && !duel && !retreat && game.activations.length < 2 && p.owner === viewer && !usedByTeammateThisRound(p.id) && !['goal', 'sacrificed'].includes(p.status) && (p.status === 'board' && !!p.position && isPulperia(p.position, game.board) || attackTargetsFor(p).length > 0 || player.cards.includes('boleadora') && boleadoraTargetsFor(p).length > 0 || !!game.roll && (p.status !== 'camp' || game.board[0].includes(game.roll) || player.cards.includes('cabalgata') && cabalgataTargets(p, game.board).some(cell => game.board[cell.row][cell.col] === game.roll)));
  const selectGaucho = (p: Piece) => {
    if (!selectable(p)) return;
    setSelected(current => current === p.id ? null : p.id);
    setRideIndex(null);
    setPulperiaSwapTarget(null);
    setConfirmSacrifice(false);
    setSacrificeChoice(null);
  };
  const rollTerrain = () => { if (!isMyTurn || game.roll || duel || retreat || game.winner) return; const t = TERRAIN[randomIndex(TERRAIN.length)]; setGame(s => log({ ...s, roll: t }, `Turno ${s.turn}: el dado marca ${LABEL[t]}.`)); setSelected(null); setRideIndex(null); };

  const finishMove = (pieceId: string, dest: Cell) => {
    setGame(s => {
      const mover = s.pieces.find(p => p.id === pieceId)!;
      const occupied = s.pieces.some(p => p.id !== pieceId && p.status === 'board' && same(p.position, dest));
      if (occupied) return log(s, `${short(mover)} no puede avanzar: ese terreno ya está ocupado.`);
      const distance = mover.status === 'camp' || !mover.position ? 1 : Math.max(1, Math.abs(dest.row - mover.position.row), Math.abs(dest.col - mover.position.col));
      const pieces = s.pieces.map(p => p.id === pieceId ? { ...p, status: 'board' as const, position: dest } : p);
      const arrivedAtPulperia = isPulperia(dest, s.board);
      const moved = recordMovement(log({ ...s, pieces }, `${PLAYER[mover.owner]}: ${short(mover)} avanza hasta la fila ${dest.row + 1}${arrivedAtPulperia ? ' y entra a la Pulpería.' : '.'}`), pieceId, distance);
      return completeActivation(moved, pieceId);
    });
    setSelected(null);
    setPulperiaSwapTarget(null);
  };
  const pulperiaPiece = selectedPiece?.status === 'board' && selectedPiece.position && isPulperia(selectedPiece.position, game.board) ? selectedPiece : null;
  const controlsPulperia = !!pulperiaPiece && isMyTurn && pulperiaPiece.owner === viewer && !usedByTeammateThisRound(pulperiaPiece.id);
  const pulperiaAllies = pulperiaPiece ? game.pieces.filter(piece => piece.owner === pulperiaPiece.owner && piece.id !== pulperiaPiece.id && piece.status === 'board') : [];
  const settlePulperia = (choice: 'redraw' | 'swap') => {
    if (!pulperiaPiece || !controlsPulperia || duel || retreat) return;
    const swapTarget = choice === 'swap' ? pulperiaAllies.find(piece => piece.id === pulperiaSwapTarget) : null;
    if (choice === 'swap' && !swapTarget) return;
    setGame(state => {
      const visitor = state.pieces.find(piece => piece.id === pulperiaPiece.id);
      const usedByOtherTeammate = state.playerCount === 4 && (state.teamRoundActivations[state.current] || []).includes(visitor?.id || '') && !state.activations.includes(visitor?.id || '');
      if (!visitor || visitor.owner !== state.current || usedByOtherTeammate || !visitor.position || !isPulperia(visitor.position, state.board)) return state;
      let next = state;
      if (choice === 'redraw') {
        next = state.playerCount === 4 && isFourSeat(viewerRole) ? replaceCardRefs(next, [{ pieceId: visitor.id, seat: viewerRole }]) : replacePlayedCards(next, [visitor.id]);
        next = log(next, `${PLAYER[visitor.owner]} usa la Pulpería: ${short(visitor)} descarta su naipe y recibe otro.`);
      }
      if (choice === 'swap' && swapTarget) {
        const latestTarget = next.pieces.find(piece => piece.id === swapTarget.id);
        if (!latestTarget) return state;
        next = { ...next, pieces: next.pieces.map(piece => {
          if (state.playerCount === 4 && isFourSeat(viewerRole)) {
            if (piece.id === visitor.id) return { ...piece, teamCards: { ...piece.teamCards, [viewerRole]: latestTarget.teamCards?.[viewerRole] || null }, teamCardVersions: { ...piece.teamCardVersions, [viewerRole]: (piece.teamCardVersions?.[viewerRole] || 1) + 1 }, revealed: false };
            if (piece.id === latestTarget.id) return { ...piece, teamCards: { ...piece.teamCards, [viewerRole]: visitor.teamCards?.[viewerRole] || null }, teamCardVersions: { ...piece.teamCardVersions, [viewerRole]: (piece.teamCardVersions?.[viewerRole] || 1) + 1 }, revealed: false };
            return piece;
          }
          return piece.id === visitor.id ? { ...piece, card: latestTarget.card, cardVersion: piece.cardVersion + 1, revealed: false } : piece.id === latestTarget.id ? { ...piece, card: visitor.card, cardVersion: piece.cardVersion + 1, revealed: false } : piece;
        }) };
        next = log(next, `${PLAYER[visitor.owner]} usa la Pulpería: ${short(visitor)} intercambia su naipe con ${short(latestTarget)}.`);
      }
      return completeActivation(next, visitor.id);
    });
    setSelected(null); setRideIndex(null); setPulperiaSwapTarget(null);
  };
  const isLegalDuelTarget = (attacker: Piece, target: Cell, ranged = false) => isMyTurn && !retreat && !game.winner && game.activations.length < 2 && attacker.owner === viewer && attacker.owner === game.current && !usedByTeammateThisRound(attacker.id) && (ranged ? boleadoraTargetsFor(attacker) : attackTargetsFor(attacker)).some(cell => same(cell, target));
  const canStartDuel = (attacker: Piece, target: Cell, ranged = false) => !duel && isLegalDuelTarget(attacker, target, ranged);
  const beginDuel = (pieceId: string, target: Cell, from: Cell | null, entry: boolean, natureIndex: number | null = null) => {
    const attacker = game.pieces.find(p => p.id === pieceId);
    const ranged = natureIndex !== null && game.players[attacker?.owner || game.current].cards[natureIndex] === 'boleadora';
    if (!attacker || !canStartDuel(attacker, target, ranged) || game.pieces.some(p => p.id !== pieceId && p.owner === attacker.owner && p.status === 'board' && same(p.position, target))) return;
    const defenders = game.pieces.filter(p => p.owner !== attacker.owner && p.status === 'board' && same(p.position, target)).map(p => p.id);
    if (!defenders.length) return;
    const fourPlayer = game.playerCount === 4 && !!game.currentSeat;
    const initiatorSeat = fourPlayer ? game.currentSeat! : undefined;
    const now = clock;
    setDuel({ attackerId: pieceId, defenders, defenderId: defenders.length === 1 ? defenders[0] : null, target, from, entry, ranged, cardIndex: ranged ? natureIndex : null, defenderCardIndex: null, death: false, stake: 'normal', attackerRevealed: false, endsAt: now + DUEL_DURATION_MS, turnRemainingMs: Math.max(0, game.turnEndsAt - now), fourPlayer, initiatorSeat, responderSeat: initiatorSeat ? nextFourSeat(initiatorSeat) : undefined, revealOrder: initiatorSeat ? seatsFrom(initiatorSeat) : undefined, revealIndex: 0, revealedSeats: [], passedSeats: [], phase: defenders.length > 1 ? 'choose-defender' : 'attacker' });
  };
  const canControlAttacker = (state: Duel) => mode === 'test' || (state.fourPlayer ? viewerRole === state.initiatorSeat : game.pieces.find(piece => piece.id === state.attackerId)?.owner === viewer);
  const canControlDefender = (state: Duel) => mode === 'test' || (state.fourPlayer ? viewerRole === state.responderSeat : !!state.defenderId && game.pieces.find(piece => piece.id === state.defenderId)?.owner === viewer);
  const cancelDuelPlanning = () => {
    if (!duel || !['choose-defender', 'attacker'].includes(duel.phase) || !canControlAttacker(duel)) return;
    setGame(state => resumeTurnTimer(state, duel));
    setDuel(null);
    setRideIndex(null);
  };
  const chooseDuelDefender = (defenderId: string) => {
    if (!duel || duel.phase !== 'choose-defender' || !canControlAttacker(duel) || !duel.defenders.includes(defenderId)) return;
    const defender = game.pieces.find(piece => piece.id === defenderId);
    if (!defender || defender.owner === game.current || defender.status !== 'board' || !same(defender.position, duel.target)) return;
    setDuel({ ...duel, defenderId, phase: 'attacker' });
  };
  const toggleDuelNature = (cardIndex: number) => {
    if (!duel || duel.phase !== 'attacker' || !canControlAttacker(duel)) return;
    if (duel.ranged) return;
    const attacker = game.pieces.find(piece => piece.id === duel.attackerId);
    if (!attacker || !game.players[attacker.owner].cards[cardIndex]) return;
    setDuel({ ...duel, cardIndex: duel.cardIndex === cardIndex ? null : cardIndex });
  };
  const sendDuelChallenge = () => {
    if (!duel || duel.phase !== 'attacker' || !duel.defenderId || !canControlAttacker(duel)) return;
    const attacker = game.pieces.find(piece => piece.id === duel.attackerId);
    const defender = game.pieces.find(piece => piece.id === duel.defenderId);
    const validRangedAttack = duel.ranged && duel.cardIndex !== null && game.players[attacker?.owner || game.current].cards[duel.cardIndex] === 'boleadora';
    if (!attacker || !defender || !isLegalDuelTarget(attacker, duel.target, validRangedAttack) || defender.owner === attacker.owner || defender.status !== 'board' || !same(defender.position, duel.target)) return;
    setGame(state => recordDuelStart(state, attacker.id, defender.id));
    setDuel({ ...duel, phase: 'defender' });
  };
  const offerRedouble = () => {
    if (!duel || !['defender', 'defender-reveal'].includes(duel.phase) || duel.stake !== 'normal' || !canControlDefender(duel)) return;
    if (duel.fourPlayer) { offerTeamRaise('redouble'); return; }
    setDuel({ ...duel, phase: 'redouble-answer' });
  };
  const toggleDefenderNature = (cardIndex: number) => {
    if (!duel?.defenderId || duel.phase !== 'defender' || !canControlDefender(duel)) return;
    const defender = game.pieces.find(piece => piece.id === duel.defenderId);
    if (!defender || !game.players[defender.owner].cards[cardIndex]) return;
    setDuel({ ...duel, defenderCardIndex: duel.defenderCardIndex === cardIndex ? null : cardIndex });
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
    const isAttack = challengeKeys.has(key(dest));
    if (isAttack) { const boleadoraIndex = boleadoraArmed ? rideIndex : null; setRideIndex(null); beginDuel(selectedPiece.id, dest, selectedPiece.position, selectedPiece.status === 'camp', boleadoraIndex); return; }
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
    travel(selectedPiece.id, [dest]);
  };
  const stay = () => { if (!selectedPiece) return; setGame(s => completeActivation(log(s, `${PLAYER[selectedPiece.owner]}: ${short(selectedPiece)} permanece en su lugar.`), selectedPiece.id)); setSelected(null); setRideIndex(null); };
  const goalReachable = !duel && !retreat && rideIndex === null && !!selectedPiece && selectedPiece.position?.row === game.board.length - 1 && game.roll === game.goalTerrain;
  const reachGoal = () => {
    if (!selectedPiece || !goalReachable) return;
    setGame(s => { const current = s.players[s.current], arrived = current.arrived + 1, players = { ...s.players, [s.current]: { ...current, arrived } }, winner = arrived >= 2 ? s.current : null; const pieces = s.pieces.map(p => p.id === selectedPiece.id ? { ...p, status: 'goal' as const, position: null } : p); const updated = recordMovement({ ...s, pieces, players, winner, endedAt: winner ? Date.now() : s.endedAt }, selectedPiece.id, 1); return completeActivation(log(updated, winner ? `¡${players[s.current].name} gana la partida!` : `${PLAYER[s.current]}: ${short(selectedPiece)} alcanza la meta.`), selectedPiece.id); }); setSelected(null);
  };
  const sacrifice = () => {
    if (!selectedPiece || !sacrificeChoice || !SACRIFICE_NATURE_CARDS.includes(sacrificeChoice) || !isMyTurn || player.sacrificed || duel || retreat || game.winner) return;
    setGame(s => { const deck = takeNatureCard(s.deck, sacrificeChoice); if (!deck) return s; const pieces = s.pieces.map(p => p.id === selectedPiece.id ? { ...p, status: 'sacrificed' as const, position: null } : p), current = s.players[s.current], players = { ...s.players, [s.current]: { ...current, sacrificed: true, cards: [...current.cards, sacrificeChoice] } }; return completeActivation(log({ ...s, deck, pieces, players }, `${PLAYER[s.current]} sacrifica a ${short(selectedPiece)} y toma la carta de naturaleza ${NATURE_LABEL[sacrificeChoice]}.`), selectedPiece.id); }); setSelected(null); setRideIndex(null); setConfirmSacrifice(false); setSacrificeChoice(null); setMobileSheet(null);
  };
  const discardDuelNature = (s: Game, d: Duel, includeDefender = false) => {
    const attacker = s.pieces.find(piece => piece.id === d.attackerId);
    const defender = d.defenderId ? s.pieces.find(piece => piece.id === d.defenderId) : null;
    let players = s.players;
    const natureDiscard = [...s.natureDiscard];
    if (attacker && d.cardIndex !== null) {
      const card = players[attacker.owner].cards[d.cardIndex];
      if (card) natureDiscard.push(card);
      players = { ...players, [attacker.owner]: { ...players[attacker.owner], cards: players[attacker.owner].cards.filter((_, i) => i !== d.cardIndex) } };
    }
    if (includeDefender && defender && d.defenderCardIndex !== null) {
      const card = players[defender.owner].cards[d.defenderCardIndex];
      if (card) natureDiscard.push(card);
      players = { ...players, [defender.owner]: { ...players[defender.owner], cards: players[defender.owner].cards.filter((_, i) => i !== d.defenderCardIndex) } };
    }
    return { ...s, players, natureDiscard };
  };
  const refuse = () => {
    if (!duel?.defenderId || duel.phase !== 'defender') return;
    if (duel.ranged) return;
    if (!canControlDefender(duel)) return;
    setGame(s => {
      const resumed = resumeTurnTimer(s, duel);
      const defender = resumed.pieces.find(p => p.id === duel.defenderId)!;
      const attacker = resumed.pieces.find(p => p.id === duel.attackerId)!;
      if (duel.ranged) {
        const resolved = resolveBoleadoraPositions(discardDuelNature(resumed, duel), duel, 'attacker', 1);
        return completeActivation(log(resolved, `${short(defender)} (${PLAYER[defender.owner]}) rechaza la boleadora: retrocede 1 fila y ${short(attacker)} avanza 1 fila.`), duel.attackerId);
      }
      const swapped = resolveRefusalPositions(resumed, duel);
      if (!swapped) return resumed;
      const afterNature = discardDuelNature(swapped, duel, true);
      const protectedGame = duel.cardIndex !== null ? { ...afterNature, truce: { blockerId: defender.id, protectedId: attacker.id, expiresTurn: resumed.turn + 1 } } : afterNature;
      return completeActivation(log(protectedGame, `${short(defender)} (${PLAYER[defender.owner]}) rechaza el duelo: intercambia posición con ${short(attacker)}.${duel.cardIndex !== null ? ` En su próximo turno no podrá desafiar a ${short(attacker)}.` : ''}`), duel.attackerId);
    });
    setDuel(null); setSelected(null);
  };
  const acceptChallenge = () => {
    if (!duel?.defenderId || duel.phase !== 'defender' || !canControlDefender(duel)) return;
    if (duel.fourPlayer && duel.initiatorSeat) {
      setDuel({ ...duel, attackerRevealed: true, revealedSeats: [duel.initiatorSeat], revealIndex: 1, phase: 'team-reveal' });
      return;
    }
    setDuel(advanceDuelToReveal(duel, 'normal'));
  };
  const currentTeamRevealSeat = duel?.fourPlayer ? duel.revealOrder?.[duel.revealIndex || 0] : undefined;
  const teamCardPiece = (state: Duel, seat: FourSeat) => SEAT_TEAM[seat] === game.pieces.find(piece => piece.id === state.attackerId)?.owner ? game.pieces.find(piece => piece.id === state.attackerId) : game.pieces.find(piece => piece.id === state.defenderId);
  const resolveFourPlayerDuel = (state: Duel, revealedSeats: FourSeat[]) => {
    if (!state.defenderId || !state.initiatorSeat || !state.responderSeat) return;
    const attacker = game.pieces.find(piece => piece.id === state.attackerId)!;
    const defender = game.pieces.find(piece => piece.id === state.defenderId)!;
    const revealedTeamCards: RevealedTeamCard[] = revealedSeats.map(seat => {
      const piece = SEAT_TEAM[seat] === attacker.owner ? attacker : defender;
      return { seat, pieceId: piece.id, card: piece.teamCards?.[seat] || null };
    });
    const baseScores: Partial<Record<PlayerId, number>> = { blue: 0, red: 0 };
    revealedTeamCards.forEach(item => { const team = SEAT_TEAM[item.seat]; baseScores[team] = (baseScores[team] || 0) + cardPower(item.card); });
    const attackerNature = state.cardIndex === null ? null : game.players[attacker.owner].cards[state.cardIndex];
    const defenderNature = state.defenderCardIndex === null ? null : game.players[defender.owner].cards[state.defenderCardIndex];
    const attackerTerrain = state.from ? game.board[state.from.row][state.from.col] : null;
    const defenderTerrain = game.board[state.target.row][state.target.col];
    const scores = { ...baseScores };
    if (attackerNature && attackerNature === attackerTerrain) scores[attacker.owner] = Math.min(24, (scores[attacker.owner] || 0) + 3);
    if (defenderNature && defenderNature === defenderTerrain) scores[defender.owner] = Math.min(24, (scores[defender.owner] || 0) + 3);
    const attackerScore = scores[attacker.owner] || 0, defenderScore = scores[defender.owner] || 0;
    const winner: Outcome['winner'] = attackerScore === defenderScore ? 'tie' : attackerScore > defenderScore ? 'attacker' : 'defender';
    const loserId = winner === 'attacker' ? defender.id : winner === 'defender' ? attacker.id : null;
    const winningPiece = winner === 'attacker' ? attacker : winner === 'defender' ? defender : null;
    const rangedSteps = state.stake === 'death' ? 4 : state.stake === 'redouble' ? 3 : 2;
    const retreat = winner === 'tie' ? 0 : state.ranged ? rangedSteps : state.stake === 'redouble' ? 3 : state.stake === 'death' ? 0 : 2;
    const replacementRefs = revealedTeamCards.map(item => ({ pieceId: item.pieceId, seat: item.seat }));
    const title = winningPiece ? `¡Ganó el equipo ${PLAYER[winningPiece.owner]}!` : '¡Fuerzas iguales!';
    const detail = `Azul suma ${scores.blue || 0} y Rojo suma ${scores.red || 0}.${loserId ? state.stake === 'death' ? ` ${short(winner === 'attacker' ? defender : attacker)} vuelve al campamento.` : ` Pierde ${short(winner === 'attacker' ? defender : attacker)}.` : ''}`;
    const outcome: Outcome = { title, detail, attackerCard: attacker.teamCards?.[state.initiatorSeat] || null, defenderCard: defender.teamCards?.[state.responderSeat] || null, loserId, replacementIds: [...new Set(replacementRefs.map(ref => ref.pieceId))], replacementRefs, revealedTeamCards, teamScores: scores, retreat, winner, stake: state.stake, decidedBy: 'cards' };
    setGame(s => recordDuelResult(log(discardDuelNature(s, state, true), `${title} ${detail}`), winningPiece?.id || null, loserId));
    setDuel({ ...state, revealedSeats, phase: 'team-outcome', outcome });
  };
  const revealOrPassTeamCard = (reveal: boolean) => {
    if (!duel?.fourPlayer || duel.phase !== 'team-reveal' || !currentTeamRevealSeat || viewerRole !== currentTeamRevealSeat) return;
    const mandatory = [duel.initiatorSeat, duel.responderSeat].includes(currentTeamRevealSeat);
    if (!reveal && mandatory) return;
    const revealedSeats = reveal ? [...(duel.revealedSeats || []), currentTeamRevealSeat] : duel.revealedSeats || [];
    const passedSeats = reveal ? duel.passedSeats || [] : [...(duel.passedSeats || []), currentTeamRevealSeat];
    const nextIndex = (duel.revealIndex || 0) + 1;
    if (nextIndex >= (duel.revealOrder?.length || 0)) { resolveFourPlayerDuel(duel, revealedSeats); return; }
    setDuel({ ...duel, revealedSeats, passedSeats, revealIndex: nextIndex });
  };
  const offerTeamRaise = (stake: 'redouble' | 'death') => {
    if (!duel?.fourPlayer) return;
    const proposer = duel.phase === 'defender' ? duel.responderSeat : currentTeamRevealSeat;
    if (!proposer || viewerRole !== proposer || stake === 'redouble' && duel.stake !== 'normal' || stake === 'death' && duel.stake !== 'redouble') return;
    setDuel({ ...duel, raiseProposerSeat: proposer, raiseResponderSeat: nextFourSeat(proposer), pendingStake: stake, phase: 'team-raise-answer' });
  };
  const settleFourRaiseRefusal = () => {
    if (!duel?.fourPlayer || duel.phase !== 'team-raise-answer' || viewerRole !== duel.raiseResponderSeat || !duel.raiseResponderSeat || !duel.defenderId) return;
    const attacker = game.pieces.find(piece => piece.id === duel.attackerId)!;
    const defender = game.pieces.find(piece => piece.id === duel.defenderId)!;
    const loserTeam = SEAT_TEAM[duel.raiseResponderSeat];
    const loser = loserTeam === attacker.owner ? attacker : defender;
    const winnerPiece = loser.id === attacker.id ? defender : attacker;
    const revealedTeamCards: RevealedTeamCard[] = (duel.revealedSeats || []).map(seat => { const piece = SEAT_TEAM[seat] === attacker.owner ? attacker : defender; return { seat, pieceId: piece.id, card: piece.teamCards?.[seat] || null }; });
    const replacementRefs = revealedTeamCards.map(item => ({ pieceId: item.pieceId, seat: item.seat }));
    const acceptedStake: 'normal' | 'redouble' = duel.pendingStake === 'death' ? 'redouble' : 'normal';
    const title = `¡Ganó el equipo ${PLAYER[winnerPiece.owner]}!`;
    const detail = `${SEAT_LABEL[duel.raiseResponderSeat]} rechazó ${duel.pendingStake === 'death' ? 'el duelo a muerte' : 'el redoble'}; su equipo pierde el ${acceptedStake === 'normal' ? 'duelo normal' : 'duelo redoblado'}.`;
    const outcome: Outcome = { title, detail, attackerCard: attacker.teamCards?.[duel.initiatorSeat!] || null, defenderCard: defender.teamCards?.[duel.responderSeat!] || null, loserId: loser.id, replacementIds: [...new Set(replacementRefs.map(ref => ref.pieceId))], replacementRefs, revealedTeamCards, retreat: acceptedStake === 'redouble' ? 3 : 2, winner: loser.id === attacker.id ? 'defender' : 'attacker', stake: acceptedStake, decidedBy: 'raise-refusal' };
    setGame(s => recordDuelResult(log(discardDuelNature(s, duel, true), `${title} ${detail}`), winnerPiece.id, loser.id));
    setDuel({ ...duel, stake: acceptedStake, death: false, phase: 'team-outcome', outcome });
  };
  const acceptFourRaise = () => {
    if (!duel?.fourPlayer || duel.phase !== 'team-raise-answer' || viewerRole !== duel.raiseResponderSeat || !duel.pendingStake) return;
    setDuel({ ...duel, stake: duel.pendingStake, death: duel.pendingStake === 'death', raiseProposerSeat: undefined, raiseResponderSeat: undefined, pendingStake: undefined, phase: 'team-reveal' });
  };
  const counterFourRaiseToDeath = () => {
    if (!duel?.fourPlayer || duel.phase !== 'team-raise-answer' || duel.pendingStake !== 'redouble' || viewerRole !== duel.raiseResponderSeat || !duel.raiseResponderSeat) return;
    const proposer = duel.raiseResponderSeat;
    setDuel({ ...duel, stake: 'redouble', raiseProposerSeat: proposer, raiseResponderSeat: nextFourSeat(proposer), pendingStake: 'death' });
  };
  const settleRaiseRefusal = (loserSide: 'attacker' | 'defender', acceptedStake: 'normal' | 'redouble', rejectedRaise: 'redouble' | 'death') => {
    if (!duel?.defenderId) return;
    const outcome = makeRaiseRefusalOutcome(game, duel, loserSide, acceptedStake, rejectedRaise);
    if (!outcome) return;
    setGame(s => {
      const afterNature = discardDuelNature(s, duel, true);
      const pieces = afterNature.pieces.map(piece => outcome.replacementIds.includes(piece.id) ? { ...piece, revealed: true } : piece);
      const winnerId = outcome.winner === 'attacker' ? duel.attackerId : duel.defenderId;
      return recordDuelResult(log({ ...afterNature, pieces }, `${outcome.title} ${outcome.detail}`), winnerId || null, outcome.loserId);
    });
    setDuel({ ...duel, stake: acceptedStake, death: false, phase: 'outcome', outcome });
  };
  const rejectRedouble = () => {
    if (!duel || duel.phase !== 'redouble-answer' || !canControlAttacker(duel)) return;
    settleRaiseRefusal('attacker', 'normal', 'redouble');
  };
  const acceptRedouble = () => {
    if (!duel || duel.phase !== 'redouble-answer' || !canControlAttacker(duel)) return;
    setDuel(advanceDuelToReveal(duel, 'redouble'));
  };
  const callDuelToDeath = () => {
    if (!duel || duel.phase !== 'redouble-answer' || !canControlAttacker(duel)) return;
    setDuel({ ...duel, stake: 'redouble', death: true, phase: 'death-confirmation' });
  };
  const rejectDeath = () => {
    if (!duel || duel.phase !== 'death-confirmation' || !canControlDefender(duel)) return;
    settleRaiseRefusal('defender', 'redouble', 'death');
  };
  const acceptDeath = () => {
    if (!duel || duel.phase !== 'death-confirmation' || !canControlDefender(duel)) return;
    setDuel(advanceDuelToReveal(duel, 'death'));
  };
  const revealDefenderAndResolve = () => {
    if (!duel?.defenderId || duel.phase !== 'defender-reveal' || !duel.attackerRevealed || !canControlDefender(duel)) return;
    const currentStake = duel.stake;
    const a = game.pieces.find(p => p.id === duel.attackerId)!, d = game.pieces.find(p => p.id === duel.defenderId)!;
    const card = duel.cardIndex === null ? null : game.players[a.owner].cards[duel.cardIndex], defenderCard = duel.defenderCardIndex !== null ? game.players[d.owner].cards[duel.defenderCardIndex] : null, originCell = duel.from ? game.board[duel.from.row][duel.from.col] : null, origin = originCell && originCell !== 'pulperia' ? originCell : null, defenderCell = game.board[duel.target.row][duel.target.col], defenderOrigin = defenderCell === 'pulperia' ? null : defenderCell;
    const { natureBoost, defenderNatureBoost, attackerOrder, defenderOrder, winner, loserId } = resolveDuelCards(a, d, card, origin, currentStake === 'death', defenderCard, defenderOrigin);
    const rangedSteps = currentStake === 'death' ? 4 : currentStake === 'redouble' ? 3 : 2;
    const retreatSteps = winner === 'tie' ? 0 : duel.ranged ? rangedSteps : currentStake === 'redouble' ? 3 : currentStake === 'death' ? 0 : 2;
    const winningPiece = winner === 'attacker' ? a : winner === 'defender' ? d : null;
    const title = winningPiece ? `¡Ganó el equipo ${PLAYER[winningPiece.owner]}! ¡Bravo el gaucho ${short(winningPiece)}!` : '¡Fuerzas iguales!';
    const detail = `${short(a)} juega ${duelCardLabel(a.card)} (valor ${attackerOrder}); ${short(d)} juega ${duelCardLabel(d.card)} (valor ${defenderOrder}).${card ? ` El atacante usó una carta de naturaleza${natureBoost ? ` y elevó su carta hasta ${attackerOrder}.` : ' como farol: no recibió bonificación.'}` : ''}${defenderCard ? ` El defensor usó una carta de naturaleza${defenderNatureBoost ? ` y elevó su carta hasta ${defenderOrder}.` : ' como farol: no recibió bonificación.'}` : ''}${loserId ? duel.ranged ? (winner === 'attacker' ? ` La boleadora desplaza el resultado: ${short(a)} avanza ${rangedSteps} filas desde su casillero y ${short(d)} retrocede ${rangedSteps}; no intercambian lugares.` : ` ${short(d)} resiste la boleadora y mantiene su casillero; ${short(a)} retrocede ${rangedSteps} filas.`) : currentStake === 'death' ? ` ${short(winner === 'attacker' ? d : a)} vuelve al campamento y su equipo tendrá una sola acción en su próximo turno.` : ` Retrocede ${short(winner === 'attacker' ? d : a)} del equipo ${PLAYER[winner === 'attacker' ? d.owner : a.owner]}.` : ''}`;
    const replacementIds = [a.id, d.id];
    setGame(s => { const n = discardDuelNature(s, duel, true); const pieces = n.pieces.map(p => [a.id, d.id].includes(p.id) ? { ...p, revealed: true } : p); return recordDuelResult(log({ ...n, pieces }, `${title} ${detail}`), winningPiece?.id || null, loserId); });
    setDuel({ ...duel, death: currentStake === 'death', phase: 'outcome', outcome: { title, detail, attackerCard: a.card, defenderCard: d.card, loserId, replacementIds, retreat: retreatSteps, winner, stake: currentStake, decidedBy: 'cards', attackerNature: card ? { card, origin, base: cardPower(a.card), boost: natureBoost, final: attackerOrder } : null, defenderNature: defenderCard ? { card: defenderCard, origin: defenderOrigin, base: cardPower(d.card), boost: defenderNatureBoost, final: defenderOrder } : null } });
  };
  const continueOutcome = () => {
    if (!duel?.outcome || !['outcome', 'team-outcome'].includes(duel.phase) || !canControlAttacker(duel) && !canControlDefender(duel)) return;
    const replacementPhase = duel.fourPlayer ? 'team-replacement' as const : 'replacement' as const;
    if (duel.outcome.winner === 'tie') { setGame(s => replaceCardRefs(s, outcomeCardRefs(duel.outcome!))); setDuel({ ...duel, phase: replacementPhase }); return; }
    if (duel.ranged) {
      const steps = duel.outcome.stake === 'death' ? 4 : duel.outcome.stake === 'redouble' ? 3 : 2;
      // El perdedor elige su retirada; si ganó el atacante, después elige su avance.
      const rangedLoserId = duel.outcome.winner === 'attacker' ? duel.defenderId! : duel.attackerId;
      const rangedLoser = game.pieces.find(p => p.id === rangedLoserId)!;
      const withCards = replaceCardRefs(game, outcomeCardRefs(duel.outcome));
      if (rangedLoser.status === 'board' && rangedLoser.position) {
        const paths = availableRetreatPaths(rangedLoser.position, steps, game.pieces, rangedLoserId);
        if (!isForcedCampRetreat(paths)) {
          setGame(log(withCards, `La boleadora: ${short(rangedLoser)} elige por dónde retroceder ${steps} filas.`));
          setRetreat({ pieceId: rangedLoserId, paths, steps, resolution: 'ranged-retreat', attackerId: duel.attackerId });
          return;
        }
      }
      const toCamp = { ...withCards, pieces: withCards.pieces.map(p => p.id === rangedLoserId ? { ...p, status: 'camp' as const, position: null } : p) };
      continueAfterRangedRetreat(toCamp, `${short(rangedLoser)} retrocede más allá de la primera fila y vuelve al campamento.`);
      return;
    }
    const loserId = duel.outcome.loserId!;
    if (duel.outcome.stake === 'death') { setGame(s => replaceCardRefs({ ...s, limitedTurn: game.pieces.find(piece => piece.id === loserId)!.owner, pieces: s.pieces.map(p => p.id === loserId ? { ...p, status: 'camp' as const, position: null } : p.id === duel.attackerId && loserId === duel.defenderId ? { ...p, status: 'board' as const, position: duel.target } : p) }, outcomeCardRefs(duel.outcome!))); setDuel({ ...duel, phase: replacementPhase }); return; }
    if (duel.entry && loserId === duel.attackerId) { setGame(s => replaceCardRefs({ ...s, pieces: s.pieces.map(p => p.id === loserId ? { ...p, status: 'camp' as const, position: null } : p) }, outcomeCardRefs(duel.outcome!))); setDuel({ ...duel, phase: replacementPhase }); return; }
    const start = loserId === duel.attackerId ? duel.from : duel.target;
    if (start) {
      // Si el defensor pierde, el atacante avanza a la casilla disputada: su origen
      // ya no bloquea los caminos de retirada que pasan por allí.
      const piecesBlockingRetreat = loserId === duel.defenderId ? game.pieces.filter(piece => piece.id !== duel.attackerId) : game.pieces;
      const paths = availableRetreatPaths(start, duel.outcome.retreat, piecesBlockingRetreat, loserId);
      const nextRetreat: RetreatChoice = { pieceId: loserId, paths, steps: duel.outcome.retreat, resolution: 'duel', attackerId: duel.attackerId };
      if (isForcedCampRetreat(paths)) {
        const resolved = resolveRetreatPositions(game, duel, nextRetreat, null);
        if (!resolved) { setSyncNotice('No se pudo completar la retirada. La partida sigue esperando una resolución válida.'); return; }
        const loser = game.pieces.find(p => p.id === loserId)!;
        setGame(replaceCardRefs(log(resolved, `${short(loser)} retrocede más allá de la primera fila y vuelve al campamento.`), outcomeCardRefs(duel.outcome)));
        setRetreat(null); setDuel({ ...duel, phase: replacementPhase }); return;
      }
      setRetreat(nextRetreat);
    }
  };
  const continueAfterRangedRetreat = (state: Game, message: string) => {
    if (!duel?.outcome) return;
    const replacementPhase = duel.fourPlayer ? 'team-replacement' as const : 'replacement' as const;
    const steps = duel.outcome.stake === 'death' ? 4 : duel.outcome.stake === 'redouble' ? 3 : 2;
    if (duel.outcome.winner === 'attacker') {
      const attackerPiece = state.pieces.find(p => p.id === duel.attackerId)!;
      const options = boleadoraAdvanceOptions(state, duel.attackerId, steps);
      if (options.length) {
        setGame(log(state, `${message} ${short(attackerPiece)} elige por dónde avanzar.`));
        setRetreat({ pieceId: duel.attackerId, paths: options.map(cell => [cell]), steps, resolution: 'advance', attackerId: duel.attackerId });
        return;
      }
      setGame(log(state, `${message} ${short(attackerPiece)} no tiene casilleros libres para avanzar y se queda en su lugar.`));
    } else setGame(log(state, `${message} El defensor mantiene su casillero.`));
    setRetreat(null); setDuel({ ...duel, phase: replacementPhase });
  };
  const chooseRetreat = (path: (Cell | null)[]) => {
    if (!retreat || !duel) return; const dest = path.at(-1) || null;
    if (mode === 'online' && room?.role && roleTeam(room.role) !== game.pieces.find(piece => piece.id === retreat.pieceId)?.owner) return;
    if (retreat.resolution === 'ranged-retreat') {
      const moved = resolveRangedRetreat(game, retreat, dest);
      if (!moved) { setSyncNotice('Ese destino de retirada ya no está disponible. Elegí otro terreno iluminado.'); return; }
      const loser = game.pieces.find(p => p.id === retreat.pieceId)!;
      setRetreat(null);
      continueAfterRangedRetreat(moved, `${short(loser)} retrocede a ${dest ? `la fila ${dest.row + 1}` : 'su campamento'}.`);
      return;
    }
    if (retreat.resolution === 'advance') {
      const advanced = resolveBoleadoraAdvance(game, retreat, dest);
      if (!advanced || !dest) { setSyncNotice('Ese avance ya no está disponible. Elegí otro terreno iluminado.'); return; }
      const mover = game.pieces.find(p => p.id === retreat.pieceId)!;
      setGame(log(advanced, `${short(mover)} avanza con la boleadora hasta la fila ${dest.row + 1}.`));
      setRetreat(null); setDuel({ ...duel, phase: duel.fourPlayer ? 'team-replacement' : 'replacement' }); return;
    }
    const resolved = resolveRetreatPositions(game, duel, retreat, dest);
    if (!resolved) {
      setSyncNotice('Ese destino de retirada ya no está disponible. Elegí otro terreno iluminado.');
      return;
    }
    if (retreat.resolution === 'refusal') {
      const loser = game.pieces.find(p => p.id === retreat.pieceId)!;
      const occupation = retreat.pieceId === duel.defenderId ? ` ${short(game.pieces.find(p => p.id === duel.attackerId)!)} ocupa la casilla disputada.` : '';
      setGame(completeActivation(log(resumeTurnTimer(resolved, duel), `${short(loser)} (${PLAYER[loser.owner]}) retrocede a ${dest ? `la fila ${dest.row + 1}` : 'su campamento'}.${occupation}`), duel.attackerId));
      setRetreat(null); setDuel(null); setSelected(null); return;
    }
    setGame(duel.outcome ? replaceCardRefs(resolved, outcomeCardRefs(duel.outcome)) : resolved);
    setRetreat(null); setDuel({ ...duel, phase: duel.fourPlayer ? 'team-replacement' : 'replacement' });
  };
  const finishReplacement = () => { if (!duel || !['replacement', 'team-replacement'].includes(duel.phase) || !canControlAttacker(duel) && !canControlDefender(duel)) return; setGame(s => completeActivation(resumeTurnTimer(s, duel), duel.attackerId)); setDuel(null); setSelected(null); };
  const endTurn = () => { if (!isMyTurn || duel || retreat || game.winner) return; setGame(s => { const role: PlayerRole = s.playerCount === 4 && s.currentSeat ? s.currentSeat : s.current; return passTurn(s, `${playerDisplayName(s, role)} terminó su turno.`); }); setSelected(null); setRideIndex(null); };
  const startTest = () => { setGame(makeGame(secureRandom, 2, withPulperia)); setRoom(null); setMode('test'); setSelected(null); setRideIndex(null); setDuel(null); setRetreat(null); setRoomError(''); };
  const restart = () => { if (mode === 'online' && room && room.role !== (room.playerCount === 4 ? 'a' : 'blue')) return; const nextGame = makeGame(secureRandom, room?.playerCount || 2, game.pulperiaEnabled); setGame({ ...nextGame, participantNames: game.participantNames }); setSelected(null); setRideIndex(null); setDuel(null); setRetreat(null); };
  const leaveRoom = () => { setRoom(null); setMode(null); setSelected(null); setRideIndex(null); setDuel(null); setRetreat(null); setGame(makeGame(seededRandom(0x50414d50))); };
  const rosterOwner = viewer;
  const rosterPieces = game.pieces.filter(p => p.owner === rosterOwner && !['goal', 'sacrificed'].includes(p.status));
  const duelAttacker = duel ? game.pieces.find(p => p.id === duel.attackerId) || null : null;
  const duelDefender = duel?.defenderId ? game.pieces.find(p => p.id === duel.defenderId) || null : null;
  const controlsAttack = mode === 'test' || (duel?.fourPlayer ? viewerRole === duel?.initiatorSeat || !!duel && ['team-outcome', 'team-replacement'].includes(duel.phase) && [duel.initiatorSeat, duel.responderSeat].includes(viewerRole as FourSeat) : duelAttacker?.owner === viewer || !!duel && ['outcome', 'replacement'].includes(duel.phase) && duelDefender?.owner === viewer);
  const controlsDefense = mode === 'test' || (duel?.fourPlayer ? viewerRole === duel?.responderSeat : duelDefender?.owner === viewer);
  const cellDescription = (cell: Cell | null) => cell ? `Fila ${cell.row + 1} · Casillero ${cell.col + 1} · ${BOARD_LABEL[game.board[cell.row][cell.col]]}` : 'Campamento';
  const duelNature = duel?.cardIndex !== null && duel?.cardIndex !== undefined && duelAttacker ? game.players[duelAttacker.owner].cards[duel.cardIndex] : null;
  const defenderNature = duel?.defenderCardIndex !== null && duel?.defenderCardIndex !== undefined && duelDefender ? game.players[duelDefender.owner].cards[duel.defenderCardIndex] : null;
  const hasDuelNature = !!duelNature || !!defenderNature;
  const terrainAt = (cell: Cell | null | undefined): Terrain | null => { if (!cell) return null; const t = game.board[cell.row][cell.col]; return t === 'pulperia' ? null : t; };
  const attackerPlace = duel?.entry ? 'el campamento' : 'la Pulpería';
  const natureEffect = (card: NatureCard, origin: Terrain | null, piece: Piece | null, place: string) => { const boost = isTerrain(card) && card === origin && piece ? Math.min(3, 12 - cardPower(piece.card)) : 0; const text = boost > 0 ? `Suma +${boost}: juega desde ${LABEL[origin!]}.` : !isTerrain(card) ? 'Farol: esta carta no suma fuerza.' : card === origin ? 'Coincide, pero el naipe ya vale 12.' : `Farol: juega desde ${origin ? LABEL[origin] : place}, no suma.`; return { boost, text }; };
  // En modo prueba un solo dispositivo maneja ambos equipos: la mano mostrada debe
// seguir al jugador que decide en cada fase, nunca revelar el naipe del atacante
// durante la defensa.
const testDuelViewer: PlayerId = duel && duelAttacker && duelDefender && ['defender', 'defender-reveal', 'death-confirmation'].includes(duel.phase) ? duelDefender.owner : duelAttacker?.owner || viewer;
const duelViewer: PlayerId = mode === 'test' ? testDuelViewer : viewer;
const duelOwnPiece = duel && !duel.fourPlayer ? [duelAttacker, duelDefender].find(piece => piece?.owner === duelViewer) || null : null;
  const teamRevealPiece = duel && currentTeamRevealSeat ? teamCardPiece(duel, currentTeamRevealSeat) || null : null;
  const teamRevealOwnCard = teamRevealPiece && currentTeamRevealSeat ? teamRevealPiece.teamCards?.[currentTeamRevealSeat] || null : null;
  const controlsTeamReveal = !!duel?.fourPlayer && duel.phase === 'team-reveal' && viewerRole === currentTeamRevealSeat;
  const teamRevealMandatory = !!currentTeamRevealSeat && [duel?.initiatorSeat, duel?.responderSeat].includes(currentTeamRevealSeat);
  const controlsTeamRaiseAnswer = !!duel?.fourPlayer && duel.phase === 'team-raise-answer' && viewerRole === duel.raiseResponderSeat;
  const controlsRetreat = !!retreat && (mode === 'test' || game.pieces.find(piece => piece.id === retreat.pieceId)?.owner === viewer);
  const canRestart = mode !== null && (mode === 'test' || room?.role === (room?.playerCount === 4 ? 'a' : 'blue'));
  const participantName = (role: PlayerRole) => playerDisplayName(game, role);
  const currentTurnLabel = game.currentSeat ? `${participantName(game.currentSeat)} · equipo ${PLAYER[game.current]}` : participantName(game.current);
  const winnerLabel = game.winner ? game.playerCount === 4 ? FOUR_SEATS.filter(seat => SEAT_TEAM[seat] === game.winner).map(participantName).join(' + ') : participantName(game.winner) : '';
  const retreatDestinations = new Map<string, (Cell | null)[]>();
  retreat?.paths.forEach(path => { const destination = path.at(-1) || null; if (destination) retreatDestinations.set(key(destination), path); });
  const retreatToCamp = retreat?.paths.find(path => !path.at(-1));

  return <main className={`game-shell player-${viewer}`}>
    <header className="topbar"><div className="brand-mark">PB</div><div><p className="eyebrow">{mode === 'test' ? 'Modo prueba' : 'Juego online'}</p><h1>Pampa Brava</h1></div><div className="score-strip">{game.teams.map(team => <span className={`team-score ${team}`} key={team}><i />{PLAYER[team]} {game.players[team].arrived}/2</span>)}</div>{room && <div className="room-pill"><small>Sala</small><b>{room.code}</b><span className={room.status}>{room.status === 'active' ? `${room.playerCount} conectados` : `Esperando ${room.playerCount} jugadores`}</span></div>}{mode === 'test' && <div className="room-pill test-pill"><small>Modo</small><b>PRUEBA</b><span className="active">Azul y Rojo en este equipo</span></div>}<button className="header-button ux-help-button" onClick={() => setRules(true)}>Cómo jugar</button>{mode !== null && <button className="header-button" onClick={leaveRoom}>{mode === 'test' ? 'Salir de prueba' : 'Salir de la sala'}</button>}<ConfirmButton className="header-button" label="Reiniciar partida" confirmLabel="Tocá otra vez para reiniciar" onConfirm={restart} disabled={!canRestart} /></header>
    <section className={`play-layout ${isMobileLayout && boardZoom ? 'board-zoomed' : ''}`}>
      {duel && !retreat && <div className={`duel-timer ${duelSecondsLeft <= 10 ? 'urgent' : ''}`} role="timer" aria-label={`${duelSecondsLeft} segundos restantes para el duelo`}><div><small>RELOJ DEL DUELO</small><span>El reloj del turno está pausado</span></div><b>00:{String(duelSecondsLeft).padStart(2, '0')}</b></div>}
      {duel && !retreat && duelAttacker && duelDefender && <div className="duel-gaucho-alerts" role="status" aria-live="polite"><div className={`duel-gaucho-alert attacker ${duelAttacker.owner}`}><span className="duel-alert-portrait"><CharacterArt type={duelAttacker.type} /></span><div><small>GAUCHO ATACANTE</small><b>{short(duelAttacker)}</b><em>{cellDescription(duel.from)}</em></div><strong>ATACA</strong></div><span className="duel-alert-versus">VS</span><div className={`duel-gaucho-alert defender ${duelDefender.owner}`}><span className="duel-alert-portrait"><CharacterArt type={duelDefender.type} /></span><div><small>GAUCHO DEFENSOR</small><b>{short(duelDefender)}</b><em>{cellDescription(duel.target)}</em></div><strong>DEFIENDE</strong></div></div>}

      <section className={`board-wrap ${duel ? 'duel-active' : ''} ${retreat ? 'retreat-active' : ''}`} aria-label="Tablero triangular">{duel && !retreat && duelAttacker && <div className="board-duel-marker"><small>DUELO EN CURSO</small><b>{short(duelAttacker)} → {duelDefender ? short(duelDefender) : 'rival por elegir'}</b><span>{cellDescription(duel.target)}</span></div>}{retreat && <div className="retreat-board-instruction"><small>{retreat.resolution === 'advance' ? controlsRetreat ? 'ELEGÍ TU AVANCE' : 'AVANCE RIVAL' : controlsRetreat ? 'ELEGÍ TU RETIRADA' : 'RETIRADA RIVAL'}</small><b>{retreat.resolution === 'advance' ? controlsRetreat ? `Ganaste con la boleadora: tocá un terreno iluminado para avanzar ${retreat.steps} filas con ${short(game.pieces.find(piece => piece.id === retreat.pieceId)!)}` : 'El rival está eligiendo por dónde avanzar.' : controlsRetreat ? `Tocá un terreno iluminado para retirar a ${short(game.pieces.find(piece => piece.id === retreat.pieceId)!)}` : 'El rival está eligiendo su destino en el tablero.'}</b>{controlsRetreat && retreatToCamp && <button onClick={() => chooseRetreat(retreatToCamp)}>Volver al campamento</button>}</div>}<div className="board-stage"><button className={`goal ${game.goalTerrain} ${goalReachable ? 'reachable' : ''}`} disabled={!goalReachable} onClick={reachGoal} aria-label={`Meta de ${LABEL[game.goalTerrain]}`}><HexOutline /><span>{ICON[game.goalTerrain]}</span><b>META</b><small>{LABEL[game.goalTerrain]}</small></button><div className="board">
        {game.board.slice().reverse().map((row, ri) => { const r = game.board.length - 1 - ri; return <div className="board-row" key={r}>{row.map((terrain, col) => { const cell = { row: r, col }, retreatPath = controlsRetreat ? retreatDestinations.get(key(cell)) : undefined, canMoveHere = !retreat && (highlighted.has(key(cell)) || challengeKeys.has(key(cell))), cellInteractive = canMoveHere || !!retreatPath, occupants = game.pieces.filter(p => p.status === 'board' && same(p.position, cell)), duelOrigin = !retreat && !!duel?.from && same(duel.from, cell), duelTarget = !retreat && !!duel && same(duel.target, cell), terrainVariant = (r * 3 + col) % 4; return <div className={`hex ${terrain} terrain-variant-${terrainVariant} ${canMoveHere ? 'reachable' : ''} ${retreatPath ? 'retreat-destination' : ''} ${!retreat && challengeKeys.has(key(cell)) ? 'challenge-cell' : ''} ${duelOrigin ? 'duel-origin' : ''} ${duelTarget ? 'duel-target' : ''}`} role={cellInteractive ? 'button' : undefined} aria-label={retreatPath ? `${retreat?.resolution === 'advance' ? 'Avanzar' : 'Retirarse'} a la fila ${r + 1}, casillero ${col + 1}` : undefined} tabIndex={cellInteractive ? 0 : -1} key={key(cell)} onClick={() => retreatPath ? chooseRetreat(retreatPath) : canMoveHere && chooseDestination(cell)} onKeyDown={event => cellInteractive && (event.key === 'Enter' || event.key === ' ') && (retreatPath ? chooseRetreat(retreatPath) : chooseDestination(cell))}><HexOutline />{retreatPath && <span className={`retreat-label ${retreat?.resolution === 'advance' ? 'advance' : ''}`} aria-hidden="true">{retreat?.resolution === 'advance' ? 'Avanzar aquí' : 'Retirarse aquí'}</span>}<span className={`occupants count-${Math.min(occupants.length, 8)}`}>{occupants.map(p => { const known = isTrucoCardVisible(p, viewerRole), ownCard = pieceCardForRole(p, viewerRole, game.playerCount), cardMark = known ? trucoCardBadge(ownCard) : '●', canSelect = selectable(p), canChallenge = !retreat && p.owner !== viewer && challengeKeys.has(key(cell)) && !!selectedPiece; return <i className={`board-token ${p.owner} ${p.type} ${selected === p.id ? 'selected' : ''} ${canSelect ? 'selectable' : ''} ${canChallenge ? 'challengeable' : ''} ${!retreat && duel?.attackerId === p.id ? 'duel-attacker-target' : ''} ${!retreat && duel?.defenderId === p.id ? 'duel-defender-target' : ''} ${retreat?.pieceId === p.id ? 'retreating' : ''}`} role={canSelect || canChallenge ? 'button' : undefined} tabIndex={canSelect || canChallenge ? 0 : -1} key={p.id} title={canChallenge ? `Desafiar a ${short(p)}` : `${short(p)} · ${known ? trucoCardLabel(ownCard) : 'naipe oculto'}`} aria-label={canChallenge ? `Desafiar a ${short(p)}` : `${PLAYER[p.owner]} ${short(p)}; ${known ? `naipe ${trucoCardLabel(ownCard)}` : 'naipe oculto'}`} onClick={event => { event.stopPropagation(); if (canChallenge) chooseDestination(cell); else selectGaucho(p); }} onKeyDown={event => { if ((canSelect || canChallenge) && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); if (canChallenge) chooseDestination(cell); else selectGaucho(p); } }}><CharacterArt type={p.type} /><b>{short(p)}</b><span className="combat-stats"><em>{cardMark}</em></span></i>; })}</span></div>; })}</div>; })}
      </div></div><div className="terrain-legend"><span><i className="pampa" /> Pampa</span><span><i className="monte" /> Monte</span><span><i className="sierra" /> Sierra</span>{game.pulperiaEnabled && <span><i className="pulperia" /> Pulpería</span>}<span className="equal-base">En duelo, 12 es el valor más alto y 1 el más bajo</span></div></section>
      <aside className={`turn-status-panel mobile-sheet ${mobileSheet === 'turn' ? 'sheet-open' : ''}`} aria-label="Estado del turno" inert={isMobileLayout && mobileSheet !== 'turn' ? true : undefined}>
        <button className="mobile-sheet-close" onClick={() => setMobileSheet(null)} aria-label="Cerrar estado del turno">×</button>
        <div className="turn-dashboard">
          <div className={`turn-owner ${game.current}`}>
            <span>{isMyTurn ? 'TU TURNO' : 'TURNO RIVAL'}</span>
            <b>{currentTurnLabel}</b>
            <small>Ronda {game.turn} · {game.players[game.current].arrived}/2 en la meta</small>
          </div>
          <div className="turn-count"><strong>{game.activations.length}<span>/{actionLimit}</span></strong><small>{actionLimit === 1 ? 'acción por sanción' : 'activaciones realizadas'}</small></div>
          <div className={`turn-timer ${secondsLeft <= 10 ? 'urgent' : ''} ${duel ? 'paused' : ''}`} aria-label={`${secondsLeft} segundos restantes${duel ? '; reloj en pausa' : ''}`}><b>00:{String(secondsLeft).padStart(2, '0')}</b><small>{duel ? 'reloj en pausa' : 'reloj del turno'}</small></div>
          <div className="rival-hand-count" aria-label={`Los rivales tienen ${rivalNatureCount} ${rivalNatureCount === 1 ? 'carta' : 'cartas'} de naturaleza`}><span aria-hidden="true">▣</span><div><b>{rivalNatureCount}</b><small>{rivalNatureCount === 1 ? 'carta rival' : 'cartas rivales'}</small></div></div>
        </div>
        <div className="turn-guidance" aria-live="polite"><b>{duel ? 'Duelo en curso' : retreat ? 'Elegí la retirada' : isMyTurn ? game.roll ? game.activations.length ? 'Te queda una acción' : 'Elegí tu primer gaucho' : 'Tirá el dado o desafiá' : 'Esperá tu turno'}</b><span>{duel ? 'Seguí los pasos del desafío en el panel de duelo.' : retreat ? 'El gaucho que perdió debe elegir por dónde retroceder.' : isMyTurn ? game.roll ? 'Podés mover según el dado o desafiar a un rival contiguo. Al completar dos acciones, el turno pasa solo.' : 'El dado habilita el movimiento; un rival contiguo puede ser desafiado sin tirarlo.' : `Juega ${currentTurnLabel}. Sus acciones aparecen acá.`}</span></div>
        {syncNotice && <p className="sync-notice" role="status">{syncNotice}</p>}
        <section className="recent-actions" aria-label="Últimas acciones" aria-live="polite"><b>Últimas acciones</b>{game.log.slice(0, 3).map((entry, index) => <p key={`${game.turn}-${index}-${entry}`}>{entry}</p>)}</section>
        <div className="mobile-utility-actions"><button onClick={() => setRules(true)}>Cómo jugar</button><ConfirmButton className="" label="Reiniciar" confirmLabel="¿Reiniciar? Tocá otra vez" onConfirm={restart} disabled={!canRestart} /><button onClick={leaveRoom}>{mode === 'test' ? 'Salir de prueba' : 'Salir de la sala'}</button></div>
      </aside>
      {isMobileLayout && !retreat && <button className="board-zoom-toggle" aria-pressed={boardZoom} onClick={() => setBoardZoom(value => !value)}>{boardZoom ? '− Ajustar' : '+ Ampliar'}</button>}
      {isMobileLayout && !retreat && <div className="mobile-nature-tray" aria-label="Cartas de naturaleza y acciones especiales">{player.cards.map((card, index) => <button key={`${card}-${index}`} className={`mini-nature ${card} ${rideIndex === index ? 'armed' : ''}`} onClick={() => setMobileSheet(current => current === 'nature' ? null : 'nature')} aria-label={`${NATURE_LABEL[card]}. Abrir acciones de naturaleza`}><small>Carta {index + 1}</small><b>{NATURE_LABEL[card]}</b></button>)}{isMobileLayout && controlsPulperia && <button className="camp-pulperia" onClick={() => setMobileSheet('nature')}><small>Servicio</small><b>Pulpería</b></button>}{isMobileLayout && !player.sacrificed && <button className="camp-sacrifice" disabled={!isMyTurn || !selectedPiece || !SACRIFICE_NATURE_CARDS.some(card => game.deck.includes(card)) || !!duel || !!retreat || !!game.winner} onClick={() => { setConfirmSacrifice(true); setSacrificeChoice(null); setMobileSheet('nature'); }}><small>Sacrificar</small><b>{selectedPiece ? short(selectedPiece) : 'Elegí gaucho'}</b></button>}</div>}
      <aside className={`action-panel mobile-sheet ${mobileSheet === 'nature' ? 'sheet-open' : ''}`} aria-label="Acciones y cartas de naturaleza">
        <button className="mobile-sheet-close" onClick={() => setMobileSheet(null)} aria-label="Cerrar acciones y naturaleza">×</button>
        <div className="roll-column">
          <div><p className="eyebrow">La tierra decide</p><h2>{isMyTurn ? game.roll ? 'Elegí tu camino' : 'Tirá el dado' : 'Observá la jugada rival'}</h2></div>
          <button className="primary roll-button" disabled={!isMyTurn || !!game.roll || !!duel || !!retreat || !!game.winner} onClick={() => { rollTerrain(); setMobileSheet(null); }}>{game.roll ? 'Dado lanzado' : isMyTurn ? 'Tirar dado' : 'Esperá al rival'} <span aria-hidden="true">◆</span></button>
          <div className={`dice-result ${game.roll || 'waiting'}`} role="status" aria-live="polite"><span>{game.roll ? ICON[game.roll] : '?'}</span><div><small>RESULTADO</small><b>{game.roll ? LABEL[game.roll].toUpperCase() : 'POR TIRAR'}</b></div></div>
        </div>
        {pulperiaPiece && <section className="pulperia-flow" aria-live="polite"><div><span className="eyebrow">Servicio de Pulpería</span><h3>{short(pulperiaPiece)} está en la Pulpería</h3><p>{controlsPulperia ? 'En cada uno de sus turnos puede usar una activación para gestionar su naipe.' : 'Este gaucho podrá gestionar su naipe en el próximo turno de su equipo.'}</p></div>{controlsPulperia && <div className="pulperia-actions"><button className="secondary" onClick={() => settlePulperia('redraw')}>Cambiar mi naipe · 1 acción</button>{pulperiaAllies.length > 0 && <><div className="pulperia-swap-targets">{pulperiaAllies.map(piece => <button className={pulperiaSwapTarget === piece.id ? 'chosen' : ''} aria-pressed={pulperiaSwapTarget === piece.id} onClick={() => setPulperiaSwapTarget(piece.id)} key={piece.id}>{short(piece)}</button>)}</div><button className="secondary" disabled={!pulperiaSwapTarget} onClick={() => settlePulperia('swap')}>Intercambiar con el aliado elegido · 1 acción</button></>}<button className="text-button" onClick={() => { setSelected(null); setPulperiaSwapTarget(null); }}>Cancelar</button></div>}</section>}
        <section className={`nature-vault ${player.sacrificed ? 'sacrifice-used' : ''}`} aria-label="Tus cartas de naturaleza">
          <div className="nature-heading"><div><span className="eyebrow">Tu mano secreta</span><h2>Cartas de naturaleza</h2></div></div>
          <div className={`nature-hand illustrated ${player.cards.length > 1 ? 'multiple' : ''}`}>
            {player.cards.length ? player.cards.map((card, index) => <article className={`nature-card illustrated-nature-card ${card} ${rideIndex === index ? 'armed' : ''}`} aria-label={`${NATURE_LABEL[card]}. ${NATURE_EFFECT[card]} También sirve como farol en un ataque.`} key={`${card}-${index}`}>
              <NatureCardArt card={card} />
              {card === 'cabalgata' && <button className="nature-card-action" disabled={!isMyTurn || !game.roll || !selectedPiece || !!duel || !!retreat || !!game.winner} onClick={() => { setRideIndex(current => current === index ? null : index); setMobileSheet(null); }}>{rideIndex === index ? 'Cancelar cabalgata' : selectedPiece ? 'Usar con este gaucho' : 'Elegí un gaucho para usarla'}</button>}
              {card === 'boleadora' && <button className="nature-card-action" disabled={!isMyTurn || !selectedPiece || !!duel || !!retreat || !!game.winner} onClick={() => { setRideIndex(current => current === index ? null : index); setMobileSheet(null); }}>{rideIndex === index ? 'Cancelar boleadora' : selectedPiece ? 'Atacar a distancia' : 'Elegí un gaucho para usarla'}</button>}
            </article>) : <div className="empty-nature"><b>Sin cartas en la mano</b><span>Podés sacrificar un gaucho para tomar una Cabalgata o una Boleadora.</span></div>}
          </div>
          {!player.sacrificed && <div className="nature-sacrifice"><div><b>Sacrificar un gaucho</b><small>Retirá un gaucho y tomá una Cabalgata o Boleadora. Una vez por partida.</small></div>{confirmSacrifice && selectedPiece ? <div className="sacrifice-confirm"><div className="sacrifice-card-choices" aria-label="Carta especial elegida">{SACRIFICE_NATURE_CARDS.map(card => { const remaining = availableNatureCount(card); return <button className={sacrificeChoice === card ? 'chosen' : ''} aria-pressed={sacrificeChoice === card} disabled={!remaining} key={card} onClick={() => setSacrificeChoice(card)}><NatureCardArt card={card} compact /><span>{NATURE_LABEL[card]}</span>{!remaining && <small>Agotada</small>}</button>; })}</div><button disabled={!sacrificeChoice || !SACRIFICE_NATURE_CARDS.includes(sacrificeChoice) || !game.deck.includes(sacrificeChoice)} onClick={sacrifice}>{sacrificeChoice ? `Confirmar: ${NATURE_LABEL[sacrificeChoice]}` : 'Elegí una carta'}</button><button onClick={() => { setConfirmSacrifice(false); setSacrificeChoice(null); setMobileSheet(null); }}>Cancelar</button></div> : <button disabled={!isMyTurn || !selectedPiece || !SACRIFICE_NATURE_CARDS.some(card => game.deck.includes(card)) || !!duel || !!retreat || !!game.winner} onClick={() => { setConfirmSacrifice(true); setSacrificeChoice(null); }}>{selectedPiece ? `Sacrificar a ${short(selectedPiece)}` : 'Seleccioná un gaucho'}</button>}</div>}
        </section>
        {isMyTurn && !duel && !retreat && game.activations.length > 0 && !game.roll && challengeCells.length === 0 && !boleadoraArmed && !pulperiaPiece && <div className="action-flow action-flow-escape"><p className="hint">El desafío ya contó como una acción. Podés elegir otro gaucho o cerrar tu turno para que juegue el rival.</p><button className="primary end-turn" onClick={endTurn}>Finalizar con un gaucho</button></div>}
        {isMyTurn && !duel && !retreat && (game.roll || challengeCells.length > 0 || boleadoraArmed || !!pulperiaPiece) && <div className={`action-flow ${challengeCells.length > 0 ? 'action-flow-expanded action-flow-challenges' : selectedPiece && game.roll && !destinations.length && !goalReachable && rideIndex === null ? 'action-flow-expanded action-flow-stay' : ''}`}><p className="hint">{pulperiaPiece ? 'Este gaucho puede usar el servicio de Pulpería o salir cuando el dado habilite un terreno vecino.' : boleadoraArmed ? selectedPiece ? challengeCells.length ? 'Boleadora lista: elegí cualquier gaucho rival en el tablero.' : 'No hay rivales en el tablero para alcanzar con la boleadora.' : 'Elegí un gaucho para usar la boleadora.' : rideIndex !== null ? selectedPiece ? destinations.length ? `Cabalgata lista: elegí un terreno ${LABEL[game.roll!]} dos filas más adelante.` : 'No hay un destino válido para Cabalgata con este dado.' : 'Elegí un gaucho antes de usar Cabalgata.' : selectedPiece ? challengeCells.length ? 'Hay rivales al alcance: podés desafiarlos sin depender del dado.' : game.roll ? goalReachable ? `La meta de ${LABEL[game.goalTerrain]} está habilitada.` : destinations.length ? `Elegí un terreno ${LABEL[game.roll]} vecino o la Pulpería.` : friendlyBlocked ? `El terreno ${LABEL[game.roll]} disponible está ocupado por un aliado.` : selectedPiece.position?.row === game.board.length - 1 ? `La meta requiere ${LABEL[game.goalTerrain]}.` : `Este gaucho no tiene un terreno ${LABEL[game.roll]} vecino ni la Pulpería al alcance.` : 'Podés desafiar a un rival contiguo sin tirar el dado.' : game.activations.length >= 2 ? 'Ya realizaste las dos activaciones.' : 'Elegí un gaucho del tablero o del campamento.'}</p>{challengeCells.length > 0 && selectedPiece && <div className="challenge-box"><b>{boleadoraArmed ? 'Objetivos de la boleadora' : 'Desafíos disponibles'}</b>{challengeCells.map(cell => { const rivals = game.pieces.filter(piece => piece.owner !== viewer && piece.status === 'board' && same(piece.position, cell)); return <button key={key(cell)} onClick={() => chooseDestination(cell)}>{boleadoraArmed ? 'Lanzar boleadora a' : 'Desafiar a'} {rivals.map(short).join(' / ')}</button>; })}</div>}{selectedPiece && game.roll && !destinations.length && !goalReachable && !challengeCells.length && rideIndex === null && <button className="secondary" onClick={stay}>Quedarse y cerrar activación</button>}<button className="primary end-turn" onClick={endTurn}>{game.activations.length >= 2 ? 'Finalizar turno' : game.activations.length === 1 ? 'Finalizar con un gaucho' : 'Pasar turno'}</button></div>}
        <details className="game-history"><summary>Ver registro de la partida</summary><div className="game-log">{game.log.map((x, i) => <div className="log-entry" key={`${x}-${i}`}><span>{String(game.log.length - i).padStart(2, '0')}</span><p>{x}</p></div>)}</div></details>
      </aside>
          <div className={`camp-ground ${rosterOwner} mobile-sheet ${mobileSheet === 'gauchos' ? 'sheet-open' : ''}`} aria-label="Tus gauchos y sus cartas"><button className="mobile-sheet-close" onClick={() => setMobileSheet(null)} aria-label="Cerrar gauchos">×</button><div className="camp-heading"><span>{game.playerCount === 4 && isFourSeat(viewerRole) ? `Tus gauchos · carta de ${SEAT_LABEL[viewerRole]}` : 'Tus gauchos'}</span><i>{game.trucoDeck.length} cartas sin jugar · {game.trucoDiscard.length} descartadas</i></div><div className="camp-pieces">{rosterPieces.map(p => { const known = isTrucoCardVisible(p, viewerRole), ownCard = pieceCardForRole(p, viewerRole, game.playerCount), ownVersion = pieceCardVersionForRole(p, viewerRole, game.playerCount), cardMark = known ? trucoCardBadge(ownCard) : '?', canSelect = selectable(p), inCamp = p.status === 'camp'; return <div className={`camp-unit ${p.owner} ${inCamp ? 'in-camp' : 'deployed'}`} key={p.id}><button className={`standing-piece ${inCamp ? '' : 'roster-piece'} ${p.owner} ${p.type} ${selected === p.id ? 'selected' : ''}`} disabled={!canSelect} aria-pressed={selected === p.id} onClick={() => { selectGaucho(p); setMobileSheet(null); }} title={inCamp ? `${short(p)} · ${known ? trucoCardLabel(ownCard) : 'carta oculta'}` : `${short(p)} · fila ${p.position!.row + 1}. Seleccionar en tablero`}><CharacterArt type={p.type} /><b>{badge(p)}</b><span className="combat-stats"><em>{cardMark}</em></span></button><strong className="gaucho-name">{short(p)}</strong><span className="camp-card-label">{known && ownCard ? trucoCardLabel(ownCard) : 'Carta de duelo oculta'}</span><TrucoCardView card={ownCard} version={ownVersion} faceUp={known} owner={p.owner} characterType={p.type} selected={selected === p.id} onSelect={canSelect ? () => { selectGaucho(p); setMobileSheet(null); } : undefined} /><small className="unit-location">{inCamp ? 'Campamento' : `Fila ${p.position!.row + 1} · tocar para seleccionar`}</small></div>; })}</div></div>

      {mode !== null && <><div className={`mobile-quick-bar ${game.roll ? 'has-roll' : ''}`} aria-label="Controles principales"><button className="quick-die" disabled={!isMyTurn || !!game.roll || !!duel || !!retreat || !!game.winner} onClick={() => { rollTerrain(); setMobileSheet(null); }} aria-label={isMyTurn ? game.roll ? game.activations.length ? 'Continuar eligiendo gaucho' : 'Elegir un gaucho' : 'Tirar dado de terreno' : 'Esperar el dado del rival'}><span aria-hidden="true">{game.roll ? '✓' : '◆'}</span><b>{game.roll ? game.activations.length ? 'Seguí jugando' : 'Elegí gaucho' : isMyTurn ? 'Tirar dado' : 'Esperando'}</b></button><div className={`quick-terrain-result ${game.roll || 'waiting'}`} role="status" aria-live="polite" aria-label={game.roll ? `Resultado del dado: ${LABEL[game.roll]}` : 'Terreno por definir'}><span aria-hidden="true">{game.roll ? ICON[game.roll] : '?'}</span><div><small>{game.roll ? 'DADO' : 'TERRENO'}</small><b>{game.roll ? LABEL[game.roll] : 'Por tirar'}</b></div></div><button className={`quick-turn-state ${game.current}`} onClick={() => setMobileSheet(current => current === 'turn' ? null : 'turn')} aria-expanded={mobileSheet === 'turn'} aria-label={`${game.activations.length} de 2 acciones y ${secondsLeft} segundos. Ver estado del turno.`}><strong>{game.activations.length}<i>/2</i></strong><small>{isMyTurn ? `00:${String(secondsLeft).padStart(2, '0')}` : currentTurnLabel}</small></button><button className="quick-end-turn" disabled={!isMyTurn || !!duel || !!retreat || !!game.winner} onClick={() => { endTurn(); setMobileSheet(null); }} aria-label={game.activations.length ? 'Cerrar el turno ahora' : 'Pasar el turno'}><span aria-hidden="true">↦</span><b>{game.activations.length ? 'Cerrar turno' : 'Pasar turno'}</b></button></div><button className={`mobile-sheet-scrim ${mobileSheet === 'turn' ? 'visible' : ''}`} onClick={() => setMobileSheet(null)} aria-label="Cerrar panel" tabIndex={mobileSheet === 'turn' ? 0 : -1} /></>}

    </section>
    {mode === null && <div className="privacy-overlay lobby-overlay"><div className="privacy-card lobby-card">
      <div className="wax-seal blue">PB</div><p className="eyebrow">Partida online</p><h2>Una pampa, hasta cuatro jugadores</h2><p>Cada jugador entra desde su dispositivo. En cuatro jugadores, A y C forman el equipo Azul; B y D, el Rojo.</p>
      <label className="player-name-field"><span>¿Cómo te llamás?</span><input value={playerName} maxLength={24} autoComplete="name" placeholder="Ejemplo: Nico" onChange={event => setPlayerName(event.target.value)} /><small>Aparecerá en los turnos y habilita la creación de la sala.</small></label>
      <div className="setup-choice"><div><b>¿Con Pulpería?</b><small>{withPulperia ? 'Aparece un terreno especial para renovar o intercambiar naipes.' : 'Partida directa, sólo Pampa, Monte y Sierra.'}</small></div><button className={`setup-switch ${withPulperia ? 'on' : 'off'}`} role="switch" aria-checked={withPulperia} aria-label="Usar Pulpería" onClick={() => setWithPulperia(value => !value)}><span className="setup-switch-track" aria-hidden="true"><i /></span><b>{withPulperia ? 'Activada' : 'Desactivada'}</b></button></div>
      <div className="mode-grid"><button className="mode-choice featured" disabled={roomBusy || !playerName.trim()} onClick={() => createRoom(2)}><b>{roomBusy ? 'Preparando la sala…' : 'Crear sala de 2'}</b><small>Azul contra Rojo</small></button><button className="mode-choice featured three-player" disabled={roomBusy || !playerName.trim()} onClick={() => createRoom(3)}><b>{roomBusy ? 'Preparando la sala…' : 'Crear sala de 3'}</b><small>Azul, Rojo y Verde</small></button><button className="mode-choice featured four-player" disabled={roomBusy || !playerName.trim()} onClick={() => createRoom(4)}><b>{roomBusy ? 'Preparando la sala…' : 'Crear sala de 4'}</b><small>A + C contra B + D</small></button></div>
      <button className="mode-choice test-shortcut" onClick={startTest}><b>Acceso rápido de prueba</b><small>Jugá Azul y Rojo en este dispositivo, sin crear una sala</small></button><div className="join-divider"><span>¿Ya tenés un código?</span></div><div className="join-form"><input value={roomCode} maxLength={6} placeholder="CÓDIGO DE SALA" aria-label="Código de sala" autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} onChange={event => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onKeyDown={event => event.key === 'Enter' && joinRoom()} /><button className="primary" disabled={roomBusy || roomCode.length < 6 || !playerName.trim()} onClick={joinRoom}>{roomBusy ? 'Conectando…' : 'Entrar a la sala'}</button></div>{roomError && <p className="room-error">{roomError}</p>}
    </div></div>}
    {room?.status === 'waiting' && <div className="privacy-overlay lobby-overlay"><div className="privacy-card waiting-room"><div className="wax-seal blue">PB</div><p className="eyebrow">Sala creada</p><h2>Invitá a los jugadores</h2><p>Compartí este código. La partida comienza al reunirse los {room.playerCount} jugadores.</p><strong className="room-code">{room.code}</strong><div className="waiting-turn"><span className="sync-dot" /><b>Esperando jugadores…</b><small>{`${participantName(room.role)} · equipo ${PLAYER[roleTeam(room.role)]}. La sala se activará cuando estén todos.`}</small></div><button className="text-button" onClick={leaveRoom}>Cancelar sala</button></div></div>}
    {duel && !retreat && (!['choose-defender', 'attacker'].includes(duel.phase) || controlsAttack) && <DuelPanel phase={duel.phase}>{!['outcome', 'replacement'].includes(duel.phase) && <><div className="duel-brief"><div className="duel-route"><div className={`duelist ${duelAttacker?.owner || 'blue'}`}><span className="duelist-portrait"><CharacterArt type={duelAttacker?.type || 'faconero'} /></span><small>ATACANTE</small><b>{duelAttacker ? short(duelAttacker) : 'Gaucho'}</b><em>{cellDescription(duel.from)}</em></div><div className="duel-arrow"><span>DESAFÍA</span><b>→</b><em>{cellDescription(duel.target)}</em></div><div className={`duelist ${duelDefender?.owner || nextTeam(duelAttacker?.owner || 'blue', game.teams)}`}><span className="duelist-portrait"><CharacterArt type={duelDefender?.type || 'faconero'} /></span><small>DEFENSOR</small><b>{duelDefender ? short(duelDefender) : 'Por elegir'}</b><em>{cellDescription(duel.target)}</em></div></div><div className={`power-commitment ${hasDuelNature ? 'active' : 'inactive'}`}><span>{hasDuelNature ? '⚡' : '—'}</span><div><small>CARTAS DE NATURALEZA</small><b>{duel.cardIndex !== null ? 'El atacante está usando una carta de naturaleza.' : 'El atacante no usa carta extra'}{duel.death && (duel.defenderCardIndex !== null ? ' · El defensor está usando una carta de naturaleza.' : ' · Defensa sin carta extra')}</b></div></div></div><DuelHandInfo own={duelOwnPiece} attacker={duelAttacker} viewer={duelViewer} natureCommitted={duel.cardIndex !== null} ownNature={controlsAttack ? duelNature : null} attackerRevealed={duel.attackerRevealed} ownNatureNote={duelNature && controlsAttack ? natureEffect(duelNature, terrainAt(duel.from), duelAttacker, attackerPlace).text : undefined} locator={isMobileLayout ? <DuelMiniBoard board={game.board} from={duel.from} target={duel.target} /> : null} /></>}{duel.phase === 'choose-defender' && (controlsAttack ? <><p className="eyebrow">Varios rivales</p><GauchoDialogue piece={duelAttacker} speaker={`${short(duelAttacker!)} · Atacante`}>¡Que salga uno a sostener con coraje lo que defiende con la mirada!</GauchoDialogue><h2 className="choice-title">¿A quién desafiás?</h2><div className="choice-grid defender-choices">{duel.defenders.map(id => { const p = game.pieces.find(x => x.id === id)!; return <button key={id} onClick={() => chooseDuelDefender(id)}><span className={`character-token ${p.owner}`}><CharacterArt type={p.type} /></span><b>{short(p)}</b><small>Naipe oculto</small></button>; })}</div><button className="secondary duel-back" onClick={cancelDuelPlanning}>Volver al tablero</button></> : <WaitingStep piece={duelAttacker} text="El atacante está eligiendo a quién desafiar." />)}
      {duel.phase === 'attacker' && (controlsAttack ? <><p className="eyebrow">Prepará tu desafío</p><GauchoDialogue piece={duelAttacker} speaker={short(duelAttacker!)}>¡Eh, {duelDefender ? short(duelDefender) : 'forastero'}! No hay tranquera que frene mi paso. ¿Te animás a medir fuerzas?</GauchoDialogue><p className="duel-explainer">{duel.ranged ? 'La boleadora ya está comprometida: este desafío puede alcanzar cualquier distancia.' : 'Tocá una carta de naturaleza para comprometerla; tocala otra vez para retirarla. Si no potencia tu carta, sirve como farol y se descarta igual.'}</p>{game.players[duelAttacker!.owner].cards.length > 0 && <div className="choice-grid nature-choices illustrated">{game.players[duelAttacker!.owner].cards.map((c, i) => <button className={`${duel.cardIndex === i ? 'chosen' : ''} ${natureEffect(c, terrainAt(duel.from), duelAttacker, attackerPlace).boost ? 'effect-boost' : 'effect-bluff'}`} disabled={duel.ranged} aria-pressed={duel.cardIndex === i} key={`${c}-${i}`} onClick={() => toggleDuelNature(i)}><NatureCardArt card={c} compact /><span><b>{NATURE_LABEL[c]}</b><small>{duel.ranged && duel.cardIndex === i ? 'Comprometida para este desafío a distancia.' : natureEffect(c, terrainAt(duel.from), duelAttacker, attackerPlace).text}</small></span><i className="nature-effect-badge">{duel.cardIndex === i ? '✓ ' : ''}{natureEffect(c, terrainAt(duel.from), duelAttacker, attackerPlace).boost ? `+${natureEffect(c, terrainAt(duel.from), duelAttacker, attackerPlace).boost}` : 'Farol'}</i></button>)}</div>}<button className="primary" onClick={sendDuelChallenge}>{duel.ranged ? 'Enviar desafío a distancia' : duel.cardIndex === null ? 'Enviar desafío' : 'Invocar naturaleza y desafiar'}</button><button className="secondary duel-back" onClick={cancelDuelPlanning}>Cancelar y volver al tablero</button>{duel.entry && <p className="rule-note">Desde el campamento, una carta comprometida funciona como farol.</p>}</> : <WaitingStep piece={duelAttacker} text="El rival está preparando su desafío." />)}
      {duel.phase === 'defender' && (controlsDefense ? <><p className="eyebrow">Te llegó un desafío</p><GauchoDialogue piece={duelAttacker} speaker={`${short(duelAttacker!)} · Rival`}>¡Hacé sonar esa guitarra o desenvainá el facón! Esta tierra sabrá quién manda.</GauchoDialogue><div className="challenge-status">{duel.ranged ? 'La boleadora te alcanzó a distancia: este ataque es obligatorio. Si aceptás, el atacante mostrará primero su naipe.' : `${duel.cardIndex !== null ? 'El atacante invocó naturaleza: puede favorecer su naipe o ser un farol. ' : 'El atacante viene sin carta de naturaleza. '}Si aceptás, el atacante muestra primero su naipe; después decidís si revelás el tuyo o redoblás.`}</div>{game.players[duelDefender!.owner].cards.length > 0 && <><p className="duel-explainer">Podés comprometer una carta de naturaleza ahora. Al aceptar queda fija y no podrás cambiarla después de ver el naipe rival.</p><div className="choice-grid nature-choices illustrated">{game.players[duelDefender!.owner].cards.map((c, i) => <button className={`${duel.defenderCardIndex === i ? 'chosen' : ''} ${natureEffect(c, terrainAt(duel.target), duelDefender, 'la Pulpería').boost ? 'effect-boost' : 'effect-bluff'}`} aria-pressed={duel.defenderCardIndex === i} key={`${c}-${i}`} onClick={() => toggleDefenderNature(i)}><NatureCardArt card={c} compact /><span><b>{NATURE_LABEL[c]}</b><small>{natureEffect(c, terrainAt(duel.target), duelDefender, 'la Pulpería').text}</small></span><i className="nature-effect-badge">{duel.defenderCardIndex === i ? '✓ ' : ''}{natureEffect(c, terrainAt(duel.target), duelDefender, 'la Pulpería').boost ? `+${natureEffect(c, terrainAt(duel.target), duelDefender, 'la Pulpería').boost}` : 'Farol'}</i></button>)}</div></>}<div className="duel-actions">{!duel.ranged && <ConfirmButton className="secondary" label={`${short(duelDefender!)} rechaza · intercambian posición`} confirmLabel="Tocá otra vez: confirmar rechazo e intercambio" onConfirm={refuse} />}<button className="primary" onClick={acceptChallenge}>{duel.ranged ? 'Pelear · que revele el atacante' : 'Aceptar · que revele el atacante'}</button><button className="death-button" onClick={offerRedouble}>{defenderNature ? 'Redoblar con carta comprometida · 3 filas' : 'Redoblar · se juegan 3 filas'}</button></div></> : <WaitingStep piece={duelDefender} text="El defensor está respondiendo al desafío." />)}
      {duel.phase === 'defender-reveal' && <><p className="eyebrow">El atacante reveló su naipe</p><h2>{duel.stake === 'normal' ? '¿Mostrás el tuyo o redoblás?' : duel.stake === 'redouble' ? 'El redoble está aceptado' : 'El duelo a muerte está aceptado'}</h2><div className="duel-force-cards"><div><span>Atacante · revelada</span><TrucoCardView card={duelAttacker?.card || null} version={duelAttacker?.cardVersion || 1} faceUp owner={duelAttacker?.owner || 'blue'} characterType={duelAttacker?.type || 'faconero'} /></div><b>VS</b><div><span>Defensor · oculta</span><TrucoCardView card={duelDefender?.card || null} version={duelDefender?.cardVersion || 1} faceUp={false} owner={duelDefender?.owner || 'red'} characterType={duelDefender?.type || 'payador'} /></div></div>{(duel.cardIndex !== null || defenderNature) && <div className="duel-nature-pending">{duel.cardIndex !== null && <span className="nature-chip hidden-nature">Atacante · carta de naturaleza oculta</span>}{defenderNature && <span className="nature-chip">{controlsDefense ? `Tu ${NATURE_LABEL[defenderNature]} · ${natureEffect(defenderNature, terrainAt(duel.target), duelDefender, 'la Pulpería').boost ? `+${natureEffect(defenderNature, terrainAt(duel.target), duelDefender, 'la Pulpería').boost}` : 'farol'}` : 'Defensor · carta de naturaleza comprometida'}</span>}</div>}{controlsDefense ? <><div className="challenge-status">La carta atacante ya está a la vista. Tu carta de naturaleza quedó fijada antes de la revelación.</div><div className="duel-actions"><button className="primary" onClick={revealDefenderAndResolve}>Mostrar mi carta · resolver {duel.stake === 'normal' ? 'duelo normal' : duel.stake === 'redouble' ? 'redoble' : 'duelo a muerte'}</button>{duel.stake === 'normal' && <button className="death-button" onClick={offerRedouble}>Redoblar antes de mostrar · 3 filas</button>}</div></> : <WaitingStep piece={duelDefender} text="El defensor vio la carta atacante y decide si revela la suya o eleva la apuesta." />}</>}
      {duel.phase === 'redouble-answer' && (controlsAttack ? <><p className="eyebrow">El defensor redobla</p><GauchoDialogue piece={duelDefender} speaker={`${short(duelDefender!)} · Rival`}>¡No me venga con medias tintas! Si quiere esta tierra, va a tener que jugarse más.</GauchoDialogue><div className="challenge-status">El redoble pone en juego 3 filas.{duel.attackerRevealed ? ' El defensor ya vio tu naipe, pero todavía no mostró el suyo.' : ''}{duel.defenderCardIndex !== null ? ' El defensor comprometió una carta de naturaleza.' : ''}</div><div className="duel-actions"><button className="secondary" onClick={rejectRedouble}>{short(duelAttacker!)} rechaza · pierde el duelo normal</button><button className="primary" onClick={acceptRedouble}>Aceptar redoble · el defensor revela</button><ConfirmButton className="death-button" label="Elevar a muerte antes de su carta" confirmLabel="Tocá otra vez: confirmar elevar a muerte" onConfirm={callDuelToDeath} /></div></> : <WaitingStep piece={duelAttacker} text="El atacante está respondiendo al redoble." />)}
      {duel.phase === 'death-confirmation' && (controlsDefense ? <><p className="eyebrow">El atacante eleva a muerte</p><GauchoDialogue piece={duelAttacker} speaker={`${short(duelAttacker!)} · Atacante`}>¡Entonces que se juegue entero! Hoy uno vuelve al campamento.</GauchoDialogue><div className="challenge-status">El redoble ya quedó aceptado. Si rechazás la muerte, perdés el duelo redoblado; si aceptás, mostrás tu carta y el perdedor vuelve al campamento.</div><div className="duel-actions"><button className="secondary" onClick={rejectDeath}>Rechazar muerte · perder el redoble</button><button className="death-button" onClick={acceptDeath}>Aceptar muerte · revelar mi carta</button></div></> : <WaitingStep piece={duelDefender} text="El defensor decide si acepta el duelo a muerte antes de mostrar su carta." />)}
      {duel.phase === 'team-reveal' && duel.fourPlayer && <><p className="eyebrow">Revelación circular · {duel.stake === 'normal' ? 'duelo normal' : duel.stake === 'redouble' ? 'redoble' : 'a muerte'}</p><h2>Le toca a {currentTeamRevealSeat ? SEAT_LABEL[currentTeamRevealSeat] : 'un jugador'}</h2><div className="duel-force-cards team-duel-cards">{duel.revealOrder?.map(seat => { const piece = teamCardPiece(duel, seat); const revealed = duel.revealedSeats?.includes(seat); const passed = duel.passedSeats?.includes(seat); const privatelyVisible = viewerRole === seat; return <div key={seat}><span>{SEAT_LABEL[seat]} · {PLAYER[SEAT_TEAM[seat]]}{passed ? ' · reservada' : revealed ? ' · revelada' : ' · pendiente'}</span><TrucoCardView card={piece?.teamCards?.[seat] || null} version={piece?.teamCardVersions?.[seat] || 1} faceUp={!!revealed || privatelyVisible} owner={SEAT_TEAM[seat]} characterType={piece?.type || 'faconero'} /></div>; })}</div>{controlsTeamReveal ? <><div className="challenge-status">{teamRevealMandatory ? 'Tu participación es obligatoria.' : 'Podés aportar tu carta o reservarla sin renovarla.'} La apuesta puede elevarse antes de mostrar.</div><div className="duel-actions"><button className="primary" onClick={() => revealOrPassTeamCard(true)}>Mostrar mi carta {teamRevealOwnCard ? `· valor ${teamRevealOwnCard.rank}` : ''}</button>{!teamRevealMandatory && <button className="secondary" onClick={() => revealOrPassTeamCard(false)}>Reservar mi carta</button>}{duel.stake === 'normal' && <button className="death-button" onClick={() => offerTeamRaise('redouble')}>Redoblar antes de mostrar</button>}{duel.stake === 'redouble' && <button className="death-button" onClick={() => offerTeamRaise('death')}>Elevar a muerte antes de mostrar</button>}</div></> : <WaitingStep piece={teamRevealPiece} text={`${currentTeamRevealSeat ? SEAT_LABEL[currentTeamRevealSeat] : 'El jugador'} decide si aporta su carta o eleva la apuesta.`} />}</>}
      {duel.phase === 'team-raise-answer' && duel.fourPlayer && <><p className="eyebrow">La apuesta sube</p><h2>{duel.raiseProposerSeat ? SEAT_LABEL[duel.raiseProposerSeat] : 'Un jugador'} propone {duel.pendingStake === 'death' ? 'duelo a muerte' : 'redoble'}</h2><div className="challenge-status">Debe responder {duel.raiseResponderSeat ? SEAT_LABEL[duel.raiseResponderSeat] : 'el rival siguiente'}. Si rechaza, su equipo pierde con el nivel anterior.</div>{controlsTeamRaiseAnswer ? <div className="duel-actions"><button className="secondary" onClick={settleFourRaiseRefusal}>Rechazar · mi equipo pierde {duel.pendingStake === 'death' ? 'el redoble' : 'el duelo normal'}</button><button className="primary" onClick={acceptFourRaise}>Aceptar {duel.pendingStake === 'death' ? 'muerte' : 'redoble'}</button>{duel.pendingStake === 'redouble' && <button className="death-button" onClick={counterFourRaiseToDeath}>Elevar a muerte</button>}</div> : <WaitingStep text={`${duel.raiseResponderSeat ? SEAT_LABEL[duel.raiseResponderSeat] : 'El rival'} está respondiendo la subida.`} />}</>}
      {duel.phase === 'team-outcome' && duel.outcome && <><p className="eyebrow">{duel.outcome.decidedBy === 'raise-refusal' ? 'Subida rechazada' : 'Resultado por equipos'}</p><h2>{duel.outcome.title}</h2>{duel.outcome.revealedTeamCards && <div className="duel-force-cards team-duel-cards">{duel.outcome.revealedTeamCards.map(item => { const piece = game.pieces.find(p => p.id === item.pieceId)!; return <div key={item.seat}><span>{SEAT_LABEL[item.seat]} · {PLAYER[SEAT_TEAM[item.seat]]}</span><TrucoCardView card={item.card} version={piece.teamCardVersions?.[item.seat] || 1} faceUp owner={piece.owner} characterType={piece.type} /></div>; })}</div>}<p>{duel.outcome.detail}</p><p className="penalty">{duel.outcome.replacementRefs?.length || 0} carta{(duel.outcome.replacementRefs?.length || 0) === 1 ? '' : 's'} revelada{(duel.outcome.replacementRefs?.length || 0) === 1 ? '' : 's'} se renovará{(duel.outcome.replacementRefs?.length || 0) === 1 ? '' : 'n'}.</p>{controlsAttack ? <button className="primary" onClick={continueOutcome}>Resolver consecuencia y reparto</button> : <WaitingStep text="El desafiante o el defensor está resolviendo el resultado." />}</>}
      {duel.phase === 'team-replacement' && duel.outcome && <><p className="eyebrow">Duelo cerrado</p><h2>{duel.outcome.replacementRefs?.length ? 'Cartas reveladas renovadas' : 'Las cartas permanecen ocultas'}</h2><p>Las cartas reservadas no cambiaron. Cada participante sólo puede ver su nuevo naipe.</p>{controlsAttack ? <button className="primary" onClick={finishReplacement}>Continuar la partida</button> : <WaitingStep text="El desafiante o el defensor está cerrando el duelo." />}</>}
      {duel.phase === 'outcome' && duel.outcome && <><p className="eyebrow">{duel.outcome.decidedBy === 'raise-refusal' ? 'La subida fue rechazada' : 'Las cartas se revelan'}</p><h2>{duel.outcome.title}</h2><div className="duel-force-cards"><div><span>Atacante</span><TrucoCardView card={duel.outcome.attackerCard} version={game.pieces.find(p => p.id === duel.attackerId)?.cardVersion || 1} faceUp={duel.outcome.replacementIds.includes(duel.attackerId)} owner={game.pieces.find(p => p.id === duel.attackerId)?.owner || 'blue'} characterType={duelAttacker?.type || 'faconero'} />{duel.outcome.attackerNature && <DuelNatureVerdict result={duel.outcome.attackerNature} place={attackerPlace} />}</div><b>VS</b><div><span>Defensor</span><TrucoCardView card={duel.outcome.defenderCard} version={game.pieces.find(p => p.id === duel.defenderId)?.cardVersion || 1} faceUp={!!duel.defenderId && duel.outcome.replacementIds.includes(duel.defenderId)} owner={game.pieces.find(p => p.id === duel.defenderId)?.owner || 'red'} characterType={duelDefender?.type || 'payador'} />{duel.outcome.defenderNature && <DuelNatureVerdict result={duel.outcome.defenderNature} place="la Pulpería" />}</div></div>{duel.outcome.decidedBy !== 'raise-refusal' && <p className="duel-card-verdict">Gana el valor más alto: 12 vence a 11 y 1 es el más bajo.</p>}<p>{duel.outcome.detail}</p>{duel.outcome.winner !== 'tie' && <p className="penalty">{duel.outcome.stake === 'death' ? `${duel.outcome.loserId && short(game.pieces.find(p => p.id === duel.outcome!.loserId)!)} vuelve al campamento y su equipo tendrá una sola acción.` : `${duel.outcome.loserId && short(game.pieces.find(p => p.id === duel.outcome!.loserId)!)} pierde y retrocede ${duel.outcome.retreat} filas.`} {duel.outcome.replacementIds.length === 2 ? 'Las dos cartas reveladas se renuevan.' : duel.outcome.replacementIds.length === 1 ? 'Sólo la carta revelada se renueva.' : 'No se reveló ninguna carta; ambas se conservan.'}</p>}{duel.outcome.winner === 'tie' && <p className="penalty">Las dos cartas reveladas se descartan y ambos gauchos recibirán una nueva.</p>}{controlsAttack ? <button className="primary" onClick={continueOutcome}>{duel.outcome.winner === 'tie' ? 'Repartir nuevas cartas' : 'Resolver consecuencia y reparto'}</button> : <WaitingStep text="Un jugador del duelo está resolviendo el resultado." />}</>}
      {duel.phase === 'replacement' && duel.outcome && <><p className="eyebrow">{duel.outcome.replacementIds.length ? 'Nuevo reparto' : 'Duelo cerrado'}</p><h2>{duel.outcome.replacementIds.length ? 'Cartas renovadas' : 'Las cartas permanecen ocultas'}</h2><p>{duel.outcome.replacementIds.length === 2 ? 'Las dos cartas reveladas quedaron en el descarte. Cada gaucho recibió la siguiente carta disponible.' : duel.outcome.replacementIds.length === 1 ? 'Sólo la carta revelada quedó en el descarte y recibió un reemplazo. La otra se conserva.' : 'Como la subida se rechazó antes de revelar cartas, ninguno de los gauchos cambia su naipe.'}</p>{duel.outcome.replacementIds.length > 0 && <div className="replacement-list">{duel.outcome.replacementIds.map(id => { const p = game.pieces.find(piece => piece.id === id)!; const oldCard = id === duel.attackerId ? duel.outcome!.attackerCard : duel.outcome!.defenderCard; return <div className="replacement-row" key={id}><span className="replacement-name">{short(p)}</span><TrucoCardView card={oldCard} version={p.cardVersion - 1} faceUp owner={p.owner} characterType={p.type} discarded /><b>→</b><TrucoCardView card={p.card} version={p.cardVersion} faceUp={p.owner === viewer} owner={p.owner} characterType={p.type} fresh /></div>; })}</div>}{controlsAttack ? <button className="primary" onClick={finishReplacement}>{duel.outcome.replacementIds.length ? 'Guardar cartas y continuar' : 'Continuar la partida'}</button> : <WaitingStep text="Un jugador del duelo está cerrando la resolución." />}</>}</DuelPanel>}
    {rules && <Modal><button className="close" onClick={() => setRules(false)}>×</button><p className="eyebrow">Ayuda rápida</p><h2>Cómo se juega</h2><ol><li>Jugá de a 2 (Azul y Rojo), de a 3 (Azul, Rojo y Verde) o de a 4: A + C contra B + D. Cada equipo tiene cuatro gauchos y una naturaleza inicial.</li><li>Se usa una baraja de duelo de 48 naipes, cuatro por cada valor del 1 al 12. En cuatro jugadores cada gaucho recibe dos cartas secretas, una para cada compañero; sólo cada dueño puede ver la suya.</li><li>Tenés 45 segundos y hasta dos activaciones por turno; podés usar dos veces el mismo gaucho. Podés mover, desafiar, usar la Pulpería o sacrificar. Al sacrificar sólo podés tomar una Cabalgata o una Boleadora disponible. Durante un duelo, el reloj del turno se pausa y corre otro de 45 segundos. El dado sólo habilita movimientos: avanzá un casillero lateral o hacia adelante a un terreno coincidente.</li><li>No se comparte terreno. Desde el campamento entrás a la primera fila; en el tablero podés desafiar a un rival vecino de la misma fila o la siguiente, nunca hacia atrás. La Boleadora alcanza cualquier distancia.</li><li>Al aceptar, el atacante revela primero. Antes de mostrar su naipe, el defensor puede jugar normal o redoblar; el atacante puede aceptar, rechazar o elevar ese redoble a muerte. Rechazar una subida hace perder el nivel anterior: normal ante el redoble y redoblado ante la muerte.</li><li>En cuatro jugadores los turnos y la revelación siguen A → B → C → D. Las cartas obligatorias son las del desafiante y el primer defensor; sus aliados pueden sumar la propia o reservarla. Gana la suma A + C o B + D más alta.</li><li>Al jugador que le toca revelar puede subir la apuesta antes de mostrar su propia carta. Responde el rival siguiente; si rechaza, su equipo pierde en el nivel anterior. Sólo se renuevan las cartas reveladas.</li><li>La Pulpería se puede entrar desde un vecino sin depender del dado. Mientras permanezca allí, un gaucho puede gastar una activación en cada turno para cambiar su naipe o intercambiarlo con un aliado desplegado; desde allí no ataca.</li><li>La baraja de naturaleza contiene 30 cartas: 8 de Pampa, 8 de Monte, 8 de Sierra, 3 Cabalgatas y 3 Boleadoras. Pampa, Monte o Sierra dan hasta +3 si coinciden con el terreno correspondiente; Cabalgata salta una fila a un terreno indicado por el dado; Boleadora obliga al rival a pelear.</li><li>Al comprometer una naturaleza, el rival sabe que hay una carta, pero no cuál: puede ser un farol. La Naturaleza queda fijada antes de revelar naipes y se descarta aunque luego se rechace una subida.</li><li>La Meta tiene su propio terreno: desde la última fila sólo se entra si coincide con el dado. Llegar no entrega naturaleza. Dos gauchos en la Meta ganan.</li></ol><a className="rules-download" href="/reglamento/Pampa_Brava_Reglamento_Fisico_v7.pdf" target="_blank" rel="noreferrer">Abrir reglamento completo (PDF)</a></Modal>}
    {game.winner && <VictoryScreen game={game} winnerLabel={winnerLabel} onRestart={restart} />}
  </main>;
}

function VictoryScreen({ game, winnerLabel, onRestart }: { game: Game; winnerLabel: string; onRestart: () => void }) {
  const ranked = game.pieces.map(piece => ({ piece, stats: game.stats.pieces[piece.id] || emptyPieceStats() }));
  const leader = (metric: keyof PieceStats) => {
    const highest = Math.max(0, ...ranked.map(item => item.stats[metric]));
    if (!highest) return { name: 'Sin registros', value: 0 };
    const names = ranked.filter(item => item.stats[metric] === highest).map(item => short(item.piece));
    return { name: names.join(' / '), value: highest };
  };
  const mostDuels = leader('duels'), mostWins = leader('wins'), mostLosses = leader('losses'), mostDistance = leader('distance');
  const durationSeconds = Math.max(0, Math.round(((game.endedAt || game.startedAt) - game.startedAt) / 1000));
  const duration = durationSeconds >= 3600 ? `${Math.floor(durationSeconds / 3600)} h ${Math.floor(durationSeconds % 3600 / 60)} min` : `${Math.floor(durationSeconds / 60)} min ${durationSeconds % 60} s`;
  const threePlayerEnding = game.playerCount === 3;
  const illustrationLabel = threePlayerEnding
    ? `El gaucho ${PLAYER[game.winner!].toLowerCase()} celebra su victoria junto a los gauchos de los otros dos equipos`
    : game.winner === 'red'
      ? 'Un payador rojo consuela a un faconero azul al final de la partida'
      : 'Un faconero azul consuela a un payador rojo al final de la partida';
  return <div className="privacy-overlay victory"><div className={`privacy-card victory-card ${game.winner} ${threePlayerEnding ? 'three-player' : ''}`}><div className={`wax-seal ${game.winner}`}>★</div><p className="eyebrow">Final</p><h2>¡Victoria de {winnerLabel || game.players[game.winner!].name}!</h2><p>Dos gauchos completaron la travesía.</p><div className="victory-illustration" role="img" aria-label={illustrationLabel} /><section className="match-stats" aria-label="Estadísticas de la partida"><div className="match-stats-heading"><div><small>RESUMEN DE LA PARTIDA</small><h3>Los números de la travesía</h3></div><span>{duration}</span></div><div className="match-stat-totals"><div><b>{game.turn}</b><small>turnos</small></div><div><b>{game.stats.duels}</b><small>duelos</small></div><div><b>{duration}</b><small>duración</small></div></div><div className="match-stat-leaders"><article><span>⚔</span><div><small>EL QUE MÁS PELEÓ</small><b>{mostDuels.name}</b><em>{mostDuels.value} duelo{mostDuels.value === 1 ? '' : 's'}</em></div></article><article><span>★</span><div><small>MÁS VICTORIAS</small><b>{mostWins.name}</b><em>{mostWins.value} ganada{mostWins.value === 1 ? '' : 's'}</em></div></article><article><span>↓</span><div><small>MÁS DERROTAS</small><b>{mostLosses.name}</b><em>{mostLosses.value} perdida{mostLosses.value === 1 ? '' : 's'}</em></div></article><article><span>→</span><div><small>EL QUE MÁS AVANZÓ</small><b>{mostDistance.name}</b><em>{mostDistance.value} casillero{mostDistance.value === 1 ? '' : 's'}</em></div></article></div></section><button className="primary" onClick={onRestart}>Jugar otra partida</button></div></div>;
}

function Modal({ children }: { children: React.ReactNode }) { return <div className="modal-backdrop"><div className="modal">{children}</div></div>; }
function DuelPanel({ children, phase }: { children: React.ReactNode; phase: string }) {
  const decisionPhase = ['attacker', 'defender', 'defender-reveal', 'redouble-answer', 'death-confirmation', 'team-reveal', 'team-raise-answer'].includes(phase);
  return <aside className={`duel-panel-shell phase-${phase} ${decisionPhase ? 'duel-decision' : ''}`} aria-label="Duelo en curso"><div className="duel-panel">{children}</div></aside>;
}
function DuelHandInfo({ own, attacker, viewer, natureCommitted, ownNature, attackerRevealed, locator, ownNatureNote }: { own: Piece | null; attacker: Piece | null; viewer: PlayerId; natureCommitted: boolean; ownNature: NatureCard | null; attackerRevealed: boolean; locator?: React.ReactNode; ownNatureNote?: string }) {
  if (!own || !attacker) return null;
  const defending = attacker.owner !== viewer;
  return <section className="duel-hand-info" aria-label="Cartas en juego"><div className="duel-hand-own"><div><small>TU NAIPE</small><b>{short(own)}</b></div><TrucoCardView card={own.card} version={own.cardVersion} faceUp owner={own.owner} characterType={own.type} compact /></div>{defending ? <div className="duel-hand-attacker"><div><small>CARTAS DEL ATACANTE</small><b>{attackerRevealed ? 'Naipe revelado' : natureCommitted ? '2 cartas ocultas' : '1 carta oculta'}</b></div><div className="duel-hidden-cards"><TrucoCardView card={attacker.card} version={attacker.cardVersion} faceUp={attackerRevealed} owner={attacker.owner} characterType={attacker.type} compact />{natureCommitted && <span className="duel-nature-back" aria-label="Carta de naturaleza del atacante oculta"><b>PB</b><small>NATURALEZA</small></span>}</div><em>{attackerRevealed ? 'Podés elevar la apuesta antes de mostrar tu naipe.' : 'El valor se revela cuando aceptás el duelo.'}</em></div> : <div className="duel-hand-attacker own-attack"><small>TU ATAQUE</small>{ownNature ? <><b>{NATURE_ICON[ownNature]} {NATURE_LABEL[ownNature]}</b><em>{ownNatureNote || 'Carta extra comprometida.'}</em></> : <><b>Sin carta extra</b><em>Podés usar una naturaleza como farol.</em></>}</div>}{locator}</section>;
}
function GauchoDialogue({ piece, speaker, children }: { piece?: Piece | null; speaker: string; children: React.ReactNode }) {
  const owner = piece?.owner || 'blue';
  return <div className={`gaucho-dialogue ${owner}`}><span className={`dialogue-portrait ${owner}`}><CharacterArt type={piece?.type || 'faconero'} /></span><div className="speech-bubble"><small>{speaker}</small><p>{children}</p></div></div>;
}
function WaitingStep({ text, piece }: { text: string; piece?: Piece | null }) { return <div className="privacy-step waiting-step">{piece && <span className={`waiting-portrait ${piece.owner}`}><CharacterArt type={piece.type} /></span>}<span className="sync-dot" /><p className="eyebrow">Partida sincronizada</p><h2>Esperando al otro jugador</h2><p>{text}</p></div>; }
function HexOutline() { return null; }
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

// Botón de decisión irreversible: el primer toque arma la acción y el segundo la
// confirma. Si no se confirma en 4 segundos, vuelve a su estado normal.
function DuelNatureVerdict({ result, place }: { result: DuelNatureResult; place: string }) {
  const boosted = result.boost > 0;
  const reason = boosted ? `Naipe ${result.base} → ${result.final}` : !isTerrain(result.card) ? 'Esta carta no suma fuerza' : result.card === result.origin ? 'El naipe ya valía 12' : `Jugó desde ${result.origin ? LABEL[result.origin] : place}`;
  return <><i className={`duel-nature-stamp ${boosted ? 'boost' : 'bluff'}`} aria-hidden="true">{boosted ? `+${result.boost}` : 'Farol'}</i><div className={`duel-nature-verdict ${boosted ? 'boost' : 'bluff'}`}><NatureCardArt card={result.card} compact /><div><small>{NATURE_LABEL[result.card]}</small><b>{boosted ? `Sumó +${result.boost}` : 'Farol · no sumó'}</b><em>{reason}</em></div></div></>;
}

function DuelMiniBoard({ board, from, target }: { board: BoardTerrain[][]; from: Cell | null; target: Cell }) {
  return <div className="duel-mini-board" role="img" aria-label="Ubicación del duelo en el tablero">{board.slice().reverse().map((row, ri) => { const r = board.length - 1 - ri; return <div className="mini-row" key={r}>{row.map((terrain, c) => <i key={c} className={`mini-cell ${terrain} ${from && from.row === r && from.col === c ? 'from' : ''} ${target.row === r && target.col === c ? 'target' : ''}`} />)}</div>; })}</div>;
}

function ConfirmButton({ className, label, confirmLabel, onConfirm, disabled = false }: { className: string; label: string; confirmLabel: string; onConfirm: () => void; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);
  return <button className={`${className} ux-confirm ${armed ? 'ux-confirm-armed' : ''}`} disabled={disabled} onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }} aria-live="polite">{armed ? confirmLabel : label}</button>;
}

function CharacterArt({ type }: { type: Piece['type'] }) { return <span className={`piece-art ${type}`} aria-hidden="true" />; }
function NatureCardArt({ card, compact = false }: { card: NatureCard; compact?: boolean }) { return <span className={`nature-card-art ${card} ${compact ? 'compact' : ''}`} aria-hidden="true" />; }
function DuelCardView({ card, version, faceUp, owner, characterType = 'faconero', compact = false, discarded = false, fresh = false, selected = false, onSelect }: { card: DuelCard | null; version: number; faceUp: boolean; owner: PlayerId; characterType?: Piece['type']; compact?: boolean; discarded?: boolean; fresh?: boolean; selected?: boolean; onSelect?: () => void }) {
  const visible = faceUp && !!card;
  return <span key={version} className={`force-card duel-card ${owner} ${visible ? 'face-up' : 'face-down'} ${compact ? 'compact' : ''} ${discarded ? 'discarded' : ''} ${fresh ? 'fresh' : ''} ${onSelect ? 'card-selectable' : ''} ${selected ? 'card-selected' : ''}`} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} aria-pressed={onSelect ? selected : undefined} aria-label={`${visible ? duelCardLabel(card) : card ? 'Carta de duelo oculta' : 'Mazo agotado'}${onSelect ? '; seleccionar gaucho' : ''}`} onClick={onSelect} onKeyDown={event => { if (onSelect && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect(); } }}>{visible ? <><strong className="duel-card-number">{card.rank}</strong><span className="duel-card-hero"><CharacterArt type={characterType} /></span></> : card ? <><b>PB</b><small>CARTA OCULTA</small><em>Carta #{version}</em></> : <><b>—</b><small>MAZO AGOTADO</small><em>Sin reemplazo</em></>}</span>;
}
const TrucoCardView = DuelCardView;
