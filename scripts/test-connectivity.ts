import assert from "node:assert/strict";
import {createHash} from "node:crypto";

// Real SQLite, isolated from the user's matches and rankings.
process.env.SQLITE_PATH = ":memory:";

async function run(): Promise<void> {
  const { Game } = await import("../src/backend/game/domain/Game");
  const { SqliteGameRepository } = await import(
    "../src/backend/game/infrastructure/SqliteGameRepository"
  );
  const { MakeMoveUseCase } = await import(
    "../src/backend/game/application/MakeMoveUseCase"
  );
  const { SqliteRankingRepository } = await import(
    "../src/backend/ranking/infrastructure/SqliteRankingRepository"
  );
  const repository = new SqliteGameRepository();
  const move = new MakeMoveUseCase(repository, new SqliteRankingRepository());
  const game = Game.create({
    id: "race",
    code: "RACE01",
    numRows: 3,
    creator: { id: "one", name: "Uno" },
  });
  game.join({ id: "two", name: "Dos" });
  await repository.save(game);

  const results = await Promise.allSettled([
    move.execute({
      gameId: "race",
      playerId: "one",
      rowIndex: 0,
      startIndex: 0,
      removeCount: 1,
    }),
    move.execute({
      gameId: "race",
      playerId: "one",
      rowIndex: 1,
      startIndex: 0,
      removeCount: 1,
    }),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
    "A double submit must persist exactly one move",
  );
  const saved = await repository.getById("race");
  assert.equal(saved?.toPrimitives().moveHistory.length, 1);
  const revision = saved!.revision;
  await move.execute({
    gameId: "race",
    playerId: "two",
    rowIndex: 2,
    startIndex: 0,
    removeCount: 1,
    expectedRevision: revision,
  });
  await assert.rejects(
    move.execute({
      gameId: "race",
      playerId: "one",
      rowIndex: 1,
      startIndex: 0,
      removeCount: 1,
      expectedRevision: revision,
    }),
    { code: "STALE_GAME_STATE" },
  );

  const { newerSnapshot } = await import(
    "../src/features/game/lib/synchronization"
  );
  const { toGameView } = await import(
    "../src/backend/game/application/GameView"
  );
  const oldView = toGameView(saved!, "one");
  const newView = toGameView((await repository.getById("race"))!, "one");
  assert.equal(
    newerSnapshot(newView, oldView),
    newView,
    "A delayed HTTP response cannot replace a newer SSE snapshot",
  );
  assert.equal(
    newerSnapshot(newView, { ...newView }),
    newView,
    "Duplicate pings do not re-render the board",
  );

  const removed = await repository.getById("race");
  await repository.deleteById("race");
  await assert.rejects(
    repository.save(removed!),
    { code: "STALE_GAME_STATE" },
    "Stale writers cannot resurrect a cancelled table",
  );

  const final = Game.create({
    id: "final",
    code: "FINAL1",
    numRows: 3,
    creator: { id: "f1", name: "Final uno" },
  });
  final.join({ id: "f2", name: "Final dos" });
  await repository.save(final);
  const sequence = [
    [2, 0],
    [2, 1],
    [2, 2],
    [1, 0],
    [1, 1],
  ];
  for (const [index, [rowIndex, startIndex]] of sequence.entries()) {
    await move.execute({
      gameId: "final",
      playerId: index % 2 ? "f2" : "f1",
      rowIndex,
      startIndex,
      removeCount: 1,
    });
  }
  const last = await Promise.allSettled(
    [0, 1].map(() =>
      move.execute({
        gameId: "final",
        playerId: "f2",
        rowIndex: 0,
        startIndex: 0,
        removeCount: 1,
      }),
    ),
  );
  assert.equal(
    last.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const ranking = new SqliteRankingRepository();
  assert.equal(
    (await ranking.getPlayerStats("f1"))?.wins,
    1,
    "The winning turn must be scored once",
  );
  const { LeaveGameUseCase } = await import(
    "../src/backend/game/application/LeaveGameUseCase"
  );
  await new LeaveGameUseCase(repository, ranking).execute({
    gameId: "final",
    playerId: "f2",
  });
  assert.equal(
    (await repository.getById("final"))?.status,
    "finished",
    "The final snapshot remains available to a reconnecting phone",
  );

  const { GET: events } = await import(
    "../src/app/api/games/[gameId]/events/route"
  );
  const streamed = Game.create({
    id: "stream",
    code: "STREAM",
    numRows: 3,
    creator: { id: "s1", name: "Stream uno" },
  });
  streamed.join({ id: "s2", name: "Stream dos" });
  await repository.save(streamed);
  const {sqlite}=await import('../src/backend/shared/infrastructure/db/sqlite');
  const token='a'.repeat(64),cookie=`canicas_session=${token}`;
  sqlite.prepare('INSERT INTO players(id,alias,password_hash) VALUES(?,?,?)').run('s1','Stream uno','fixture');
  sqlite.prepare('INSERT INTO appearance_sessions(token_hash,player_id,expires) VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),'s1',Date.now()+60000);
  const abort = new AbortController();
  const response = await events(
    new Request("http://localhost/api/games/stream/events?playerId=s1", {
      signal: abort.signal,headers:{cookie},
    }),
    { params: Promise.resolve({ gameId: "stream" }) },
  );
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  async function readEvent(name: string): Promise<string> {
    let content = "";
    let deadline: ReturnType<typeof setTimeout>;
    try {
      return await Promise.race([
        (async () => {
          while (!content.includes(`event: ${name}\n`)) {
            const chunk = await reader.read();
            assert.equal(chunk.done, false, `SSE closed before ${name}`);
            content += decoder.decode(chunk.value);
          }
          return content;
        })(),
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(
            () => reject(new Error(`SSE ${name} timed out`)),
            2_000,
          );
        }),
      ]);
    } finally {
      clearTimeout(deadline!);
    }
  }
  try {
    assert.match(await readEvent("ready"), /"revision":1/);
    await move.execute({
      gameId: "stream",
      playerId: "s1",
      rowIndex: 0,
      startIndex: 0,
      removeCount: 1,
      expectedRevision: 1,
    });
    assert.match(await readEvent("update"), /"revision":2/);
  } finally {
    abort.abort();
  }
  assert.equal(
    (await reader.read()).done,
    true,
    "Aborting a mobile stream closes the subscription",
  );

  const { UseDiceUseCase } = await import(
    "../src/backend/game/application/UseDiceUseCase"
  );
  const diceGame = Game.create({
    id: "dice-metadata",
    code: "DICEM1",
    numRows: 4,
    creator: { id: "d1", name: "Dado uno" },
  });
  diceGame.join({ id: "d2", name: "Dado dos" });
  await repository.save(diceGame);
  let diceResult = await new UseDiceUseCase(repository, ranking).execute({
    gameId: "dice-metadata",
    playerId: "d1",
    expectedRevision: diceGame.revision,
  });
  // Tirada antigua persists a pending turn; history is appended only on release.
  if (diceResult.dice.pending) {
    const pending = (await repository.getById("dice-metadata"))!;
    const pendingView = toGameView(pending, "d1");
    assert.ok(pendingView.pendingAncientShot||pendingView.pendingTargetPower);
    assert.equal(pendingView.yourDiceAvailable, false);
    diceResult = await new UseDiceUseCase(repository, ranking).execute({
      gameId: "dice-metadata", playerId: "d1", expectedRevision: pending.revision,
      ...(pendingView.pendingTargetPower?{target:{row:3,col:0}}:{shot:{row:3,col:0,dx:4,dy:0}}),
    });
  }
  const diceReloaded = toGameView(
    (await repository.getById("dice-metadata"))!,
    "d1",
  );
  assert.deepEqual(
    diceReloaded.moveHistory[0].dice,
    diceResult.dice,
    "Power and affected cells survive refresh and response loss",
  );
  const finalGame = Game.create({
    id: "one-marble-final",
    code: "ENDONE",
    numRows: 3,
    creator: { id: "last-one", name: "Final uno" },
  });
  finalGame.join({ id: "last-two", name: "Final dos" });
  const almostEmpty = Game.rehydrate({
    ...finalGame.toPrimitives(),
    rows: [[0], [1, 1], [0, 0, 0]],
  });
  await repository.save(almostEmpty);
  const originalRandom = Math.random;
  try {
    Math.random = () => 0.16; // Rayo removes the first of the two remaining marbles.
    const oneMarble = await new UseDiceUseCase(repository, ranking).execute({
      gameId: almostEmpty.id,
      playerId: "last-one",
      expectedRevision: almostEmpty.revision,
    });
    assert.equal(oneMarble.game.status, "playing");
    assert.equal(oneMarble.game.winner, null);
    assert.equal(oneMarble.game.currentTurn, 2);
    assert.equal(
      await ranking.getPlayerStats("last-one"),
      null,
      "Leaving one marble must not award ranking points",
    );
    assert.equal(await ranking.getPlayerStats("last-two"), null);
    const persisted = (await repository.getById(almostEmpty.id))!;
    assert.equal(persisted.status, "playing");
    assert.equal(persisted.winner, null);
    await move.execute({
      gameId: persisted.id,
      playerId: "last-two",
      rowIndex: 1,
      startIndex: 1,
      removeCount: 1,
      expectedRevision: persisted.revision,
    });
    assert.equal((await repository.getById(persisted.id))!.winner, 1);
    assert.equal((await ranking.getPlayerStats("last-one"))?.wins, 1);
    assert.deepEqual(await ranking.getPlayerStats("last-two"), { wins: 0, games: 1 });
  } finally {
    Math.random = originalRandom;
  }

  const { buildCellOwnerMap } = await import(
    "../src/features/game/lib/cellOwners"
  );
  const ownership = buildCellOwnerMap([
    {
      player: 1,
      rowIndex: 0,
      startIndex: 0,
      count: 1,
      timestamp: "",
      fromDice: true,
    },

    { player: 1, rowIndex: 1, startIndex: 0, count: 2, timestamp: "" },
    {
      player: 2,
      rowIndex: 0,
      startIndex: 0,
      count: 1,
      timestamp: "",
      fromDice: true,
      dice: { power: "rayo", affected: [{ row: 2, col: 2 }] },
    },
    {
      player: 2,
      rowIndex: 1,
      startIndex: 0,
      count: 1,
      timestamp: "",
      fromDice: true,
      dice: { power: "resurreccion", affected: [{ row: 1, col: 0 }] },
    },
  ]);
  assert.equal(ownership.get("1:1"), 1);
  assert.equal(ownership.get("2:2"), 2);
  assert.equal(
    ownership.has("1:0"),
    false,
    "Revived marbles lose their previous removal marker",
  );
  assert.equal(
    ownership.has("0:0"),
    false,
    "Legacy dice coordinates must not be invented",
  );

  const { request, ApiRequestError } = await import(
    "../src/features/game/api/gameApi"
  );
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  try {
    globalThis.fetch = async (_url, init) => {
      attempts++;
      return new Promise((_resolve, reject) =>
        init?.signal?.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true },
        ),
      );
    };
    await assert.rejects(
      request("/timeout", { method: "POST" }, 10),
      (error: unknown) =>
        error instanceof ApiRequestError && error.code === "REQUEST_TIMEOUT",
    );
    assert.equal(attempts, 1, "An uncertain POST must not be retried blindly");
    globalThis.fetch = async () => new Response("not-json", { status: 200 });
    await assert.rejects(request("/malformed"), { code: "INVALID_RESPONSE" });
  } finally {
    globalThis.fetch = originalFetch;
  }
  const { classifyDiceGesture } = await import(
    "../src/features/game/lib/diceGesture"
  );
  assert.equal(
    classifyDiceGesture(2, 3),
    "tap",
    "Small finger jitter still counts as a tap",
  );
  assert.equal(
    classifyDiceGesture(0, 80),
    "cancel",
    "Scrolling the sheet must not roll the die",
  );
  assert.equal(
    classifyDiceGesture(12, 60),
    "cancel",
    "Mostly vertical drags belong to scrolling",
  );
  assert.equal(
    classifyDiceGesture(60, -41),
    "roll",
    "A deliberate diagonal sideways flick rolls",
  );
  assert.equal(
    classifyDiceGesture(-40, 0),
    "roll",
    "Either sideways direction can roll",
  );
  assert.equal(
    classifyDiceGesture(17, 0),
    "cancel",
    "A short drag does not accidentally submit",
  );
  assert.equal(classifyDiceGesture(30, 35), "cancel", "A mostly vertical gesture must never roll the die");
  assert.equal(classifyDiceGesture(-32, 29), "cancel", "A diagonal scroll is not a deliberate sideways throw");
  const { selectRange, tapSelection } = await import(
    "../src/features/game/lib/selection"
  );
  const cells = [[1, 1, 1, 0, 1]];
  assert.deepEqual(
    selectRange(cells, 0, 0, 4, 5),
    { rowIndex: 0, startIndex: 0, endIndex: 2 },
    "Dragging cannot cross an empty cell",
  );
  assert.deepEqual(
    selectRange(cells, 0, 2, 0, 2),
    { rowIndex: 0, startIndex: 1, endIndex: 2 },
    "A reverse drag respects the turn limit",
  );
  assert.deepEqual(selectRange(cells, 0, 0, 2, 1), {
    rowIndex: 0,
    startIndex: 0,
    endIndex: 0,
  });
  assert.equal(
    tapSelection(cells, { rowIndex: 0, startIndex: 0, endIndex: 0 }, 0, 0, 1),
    null,
  );
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { DiceCube } = await import(
    "../src/features/game/components/DiceDisplay"
  );
  const { AppearanceProvider } = await import("../src/features/appearance/AppearanceProvider");
  const throwing = renderToStaticMarkup(
    createElement(AppearanceProvider, {children: createElement(DiceCube, { rolling: true, power: "bomba" })}),
  );
  assert.match(throwing, /data-phase="throw"/);
  assert.doesNotMatch(
    throwing.match(/<div class="dice-scene[^>]*>/)?.[0] ?? "missing scene",
    /has-power|data-power=/,
    "A fast reply cannot reveal or settle a die still in flight",
  );
  assert.doesNotMatch(throwing, /\bis-winning\b/, "No face is highlighted while rolling");
  const landed = renderToStaticMarkup(
    createElement(AppearanceProvider, {children: createElement(DiceCube, { power: "bomba" })}),
  );
  assert.match(landed, /data-phase="result"/);
  assert.match(landed, /data-power="bomba"/);
  console.log(
    "OK: double submit, stale commands, snapshot ordering, deleted matches, single scoring, reconnect and bounded requests",
  );
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
