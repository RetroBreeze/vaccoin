import "./style.css";
import { Vector3 } from "three";
import { Assets } from "./assets";
import { Rendering } from "./rendering";
import { buildArena } from "./arena";
import { Springboards } from "./springboards";
import { Player } from "./player";
import { LARGE_CRATE_COINS } from "./coin-counts";
import { Coins } from "./coins";
import { Vacuum } from "./vacuum";
import { Destructibles } from "./destructibles";
import { Effects } from "./effects";
import { AudioEngine } from "./audio";
import { Round } from "./round";
import { Leaderboard } from "./supagame";
import { UI, UIState } from "./ui";
import { PlayIntent } from "./input";

async function boot() {
  const canvas = document.querySelector<HTMLCanvasElement>("#world")!,
    uiCanvas = document.querySelector<HTMLCanvasElement>("#ui")!,
    button = document.querySelector<HTMLButtonElement>("#play")!,
    soundButton = document.querySelector<HTMLButtonElement>("#sound")!,
    status = document.querySelector<HTMLParagraphElement>("#status")!;
  const view = new Rendering(canvas),
    assets = new Assets();
  await assets.load();
  const emblem = buildArena(view.scene, assets);
  const shape = assets.coin(),
    coins = new Coins(shape.geometry, shape.material);
  view.scene.add(coins.mesh);
  const player = new Player(),
    vacuum = new Vacuum(view.camera),
    effects = new Effects(view.scene, view.camera),
    audio = new AudioEngine(),
    round = new Round(),
    leaderboard = new Leaderboard(),
    ui = new UI(uiCanvas, button, soundButton);
  const destructibles = new Destructibles(
    view.scene,
    assets,
    coins,
    (x, y, z, count) => {
      effects.shatter(x, y, z, count >= LARGE_CRATE_COINS);
      audio.burst();
    },
  );
  const springboards = new Springboards(view.scene);
  const intent = new PlayIntent();
  const keys = new Set<string>(),
    eye = new Vector3(),
    direction = new Vector3();
  let mouseDown = false,
    locked = false,
    last = performance.now(),
    accumulator = 0,
    rate = 0,
    gainedFrame = 0,
    countdown = 60,
    error = "",
    requesting = false,
    ignoreNextLook = false;
  const uiState: UIState = {
    phase: "title",
    score: 0,
    remaining: 60,
    best: leaderboard.best,
    sucking: false,
    locked: false,
    time: 0,
    muted: false,
    entries: [],
    error: "",
    persisted: leaderboard.persisted,
  };
  status.classList.add("hidden");
  status.textContent = "Ready. Play Vaccoin. Headphones recommended.";
  void leaderboard.connect();
  function stopInput() {
    keys.clear();
    mouseDown = false;
    audio.motorUpdate(false, 0);
  }
  function cameraToPlayer() {
    view.camera.position.copy(player.position);
    view.camera.position.y += 1.7;
    view.camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");
    view.camera.updateMatrixWorld();
    eye.copy(view.camera.position);
    view.camera.getWorldDirection(direction);
  }
  function startRound() {
    round.start(performance.now());
    player.reset();
    coins.reset();
    destructibles.reset();
    springboards.reset();
    effects.reset();
    rate = 0;
    accumulator = 0;
    countdown = 60;
    stopInput();
    cameraToPlayer();
    audio.start();
    status.textContent = "Round started. 60 seconds.";
    error = "";
  }
  function captureAcquired() {
    locked = document.pointerLockElement === canvas;
    if (!locked) return;
    const action = intent.acquired(round.phase);
    if (action !== "none") ignoreNextLook = true;
    if (action === "start") startRound();
    error = "";
    requesting = false;
  }
  async function play(restart = false) {
    if (requesting) return;
    requesting = true;
    intent.request(restart);
    void audio.unlock();
    try {
      if (document.pointerLockElement === canvas) {
        captureAcquired();
        return;
      }
      await canvas.requestPointerLock();
      if (document.pointerLockElement === canvas) captureAcquired();
    } catch {
      intent.cancel();
      requesting = false;
      error = "MOUSE CAPTURE BLOCKED / CLICK PLAY TO RETRY";
    }
  }
  button.addEventListener("click", () => void play());
  canvas.addEventListener("click", () => {
    if (!locked && round.phase === "playing") void play();
  });
  soundButton.addEventListener("click", () => {
    void audio.unlock();
    audio.setMuted(!audio.muted);
  });
  document.addEventListener("pointerlockchange", () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) stopInput();
    else captureAcquired();
  });
  document.addEventListener("pointerlockerror", () => {
    intent.cancel();
    requesting = false;
    error = "MOUSE CAPTURE BLOCKED / CLICK PLAY TO RETRY";
  });
  document.addEventListener("mousemove", (e) => {
    if (locked && round.phase === "playing") {
      // Browsers may report the cursor recentering as the first locked delta.
      if (ignoreNextLook) {
        ignoreNextLook = false;
        return;
      }
      player.look(e.movementX, e.movementY);
    }
  });
  document.addEventListener("mousedown", (e) => {
    if (e.button === 0 && locked && round.phase === "playing") mouseDown = true;
  });
  document.addEventListener("mouseup", (e) => {
    if (e.button === 0) mouseDown = false;
  });
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("keydown", (e) => {
    if (
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "Space",
        "KeyR",
        "KeyM",
        "Enter",
      ].includes(e.code)
    )
      e.preventDefault();
    if (e.code === "KeyM" && !e.repeat) audio.setMuted(!audio.muted);
    if (e.code === "KeyR" && !e.repeat) {
      if (locked) startRound();
      else void play(true);
    }
    if (e.code === "Enter" && !e.repeat && !locked) void play();
    if (locked) keys.add(e.code);
  });
  document.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => {
    stopInput();
    if (document.pointerLockElement) document.exitPointerLock();
  });
  function finishIfExpired() {
    if (!round.tick(performance.now())) return;
    stopInput();
    if (document.pointerLockElement) document.exitPointerLock();
    audio.finish();
    const run = { id: round.id, score: round.score, durationMs: 60000 };
    void leaderboard.complete(run);
    status.textContent = `Round complete. ${round.score} coins collected. Play again.`;
  }
  document.addEventListener("visibilitychange", () => {
    stopInput();
    finishIfExpired();
  });
  setInterval(finishIfExpired, 250);
  window.addEventListener("resize", () => {
    view.resize();
    ui.resize();
  });
  function simulate(dt: number) {
    player.update(
      dt,
      Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
      Number(keys.has("KeyW")) - Number(keys.has("KeyS")),
      keys.has("Space"),
    );
    keys.delete("Space");
    if (springboards.update(dt, player)) {
      audio.tone(180, 0.14, 0.12, "triangle");
      audio.tone(540, 0.18, 0.09, "sine", 0.06);
    }
    cameraToPlayer();
    vacuum.update(dt, performance.now() / 1000, mouseDown, player.speed, rate);
    round.destroyed += destructibles.update(
      dt,
      performance.now() / 1000,
      player,
      eye,
      direction,
      mouseDown,
    );
    gainedFrame += coins.update(dt, eye, direction, vacuum.target, mouseDown);
  }
  let frames = 0,
    totalFrameMs = 0,
    maxFrameMs = 0;
  function frame(now: number) {
    requestAnimationFrame(frame);
    const elapsed = Math.min((now - last) / 1000, 0.1);
    const raw = now - last;
    last = now;
    finishIfExpired();
    gainedFrame = 0;
    if (round.phase === "playing" && locked && !document.hidden) {
      accumulator = Math.min(accumulator + elapsed, 0.1);
      while (accumulator >= 1 / 120) {
        simulate(1 / 120);
        accumulator -= 1 / 120;
      }
      round.collect(gainedFrame);
      rate +=
        (gainedFrame / Math.max(elapsed, 0.001) - rate) *
        (1 - Math.exp(-5 * elapsed));
      audio.coins(gainedFrame);
      if (gainedFrame > 5 && Math.random() < 0.25)
        effects.burst(vacuum.target.x, vacuum.target.y, vacuum.target.z, 2);
      const second = Math.ceil(round.remaining(now));
      if (second !== countdown) {
        countdown = second;
        if (second > 0 && second <= 10) audio.countdown(second);
      }
      frames++;
      totalFrameMs += raw;
      maxFrameMs = Math.max(maxFrameMs, raw);
    } else {
      accumulator = 0;
      rate *= Math.exp(-5 * elapsed);
    }
    const sucking = round.phase === "playing" && locked && mouseDown;
    audio.motorUpdate(sucking, rate);
    coins.flush();
    effects.update(elapsed, now / 1000, sucking);
    vacuum.group.visible = round.phase !== "title";
    if (round.phase === "title") {
      const t = now * 0.00007;
      view.camera.position.set(19 + Math.sin(t) * 4, 15, 25);
      view.camera.lookAt(-2, 1, -6);
      emblem.rotation.y = Math.sin(now * 0.0005) * 0.15;
    } else {
      const desired = 78 + (player.speed / 14) * 3;
      if (Math.abs(view.camera.fov - desired) > 0.05) {
        view.camera.fov += (desired - view.camera.fov) * 0.15;
        view.camera.updateProjectionMatrix();
      }
    }
    uiState.phase = round.phase;
    uiState.score = round.score;
    uiState.remaining = round.phase === "playing" ? round.remaining(now) : 60;
    uiState.best = leaderboard.best;
    uiState.sucking = sucking;
    uiState.locked = locked;
    uiState.time =
      round.phase === "playing" ? (now - round.startedAt) / 1000 : now / 1000;
    uiState.muted = audio.muted;
    uiState.entries = leaderboard.entries;
    uiState.error = error;
    uiState.persisted = leaderboard.persisted;
    view.draw();
    ui.draw(uiState, elapsed);
  }
  // Deliberately dev-only QA hooks; stripped out of the production build.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("qa")) {
    Object.assign(window, {
      vaccoinQA: {
        snapshot: () => ({
          phase: round.phase,
          score: round.score,
          remaining: round.remaining(performance.now()),
          best: leaderboard.best,
          coins: coins.count,
          alive: coins.countAlive(),
          active: coins.activeCount,
          collected: coins.collected,
          position: player.position.toArray(),
          velocity: player.velocity.toArray(),
          locked,
          destroyed: round.destroyed,
          drawCalls: view.renderer.info.render.calls,
          triangles: view.renderer.info.render.triangles,
          averageFrameMs: totalFrameMs / Math.max(1, frames),
          maxFrameMs,
          online: leaderboard.status,
          muted: audio.muted,
        }),
        teleport: (x: number, y: number, z: number, yaw = 0, pitch = -0.12) => {
          player.position.set(x, y, z);
          player.velocity.set(0, 0, 0);
          player.yaw = yaw;
          player.pitch = pitch;
          cameraToPlayer();
        },
        expire: () => {
          round.startedAt = performance.now() - 60001;
          finishIfExpired();
        },
        resetStats: () => {
          frames = 0;
          totalFrameMs = 0;
          maxFrameMs = 0;
        },
      },
    });
  }
  requestAnimationFrame(frame);
}
boot().catch((error) => {
  console.error(error);
  const status = document.querySelector<HTMLParagraphElement>("#status")!;
  status.classList.remove("hidden");
  status.textContent =
    "Could not open the mint. Check WebGL support and reload.";
});
