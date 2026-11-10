import { titleLayout } from "./title-screen";
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
import { configuredGameServices } from "./game-services";
import { UI, UIState } from "./ui";
import { DisplayName } from "./display-name";
import { PlayIntent } from "./input";
import { GamepadControls } from "./controls";
import { TouchControls } from "./touch-controls";
import { ImmersiveDisplay } from "./immersive";

async function boot() {
  const canvas = document.querySelector<HTMLCanvasElement>("#world")!,
    uiCanvas = document.querySelector<HTMLCanvasElement>("#ui")!,
    button = document.querySelector<HTMLButtonElement>("#play")!,
    soundButton = document.querySelector<HTMLButtonElement>("#sound")!,
    status = document.querySelector<HTMLParagraphElement>("#status")!;
  const namePanel = document.querySelector<HTMLDivElement>("#player-name")!;
  const nameInput = document.querySelector<HTMLInputElement>("#display-name")!;
  const retryButton = button.cloneNode(false) as HTMLButtonElement;
  retryButton.id = "retry-leaderboard";
  retryButton.textContent = "RETRY RANKINGS";
  retryButton.setAttribute("aria-label", "Retry rankings");
  retryButton.style.display = "none";
  button.after(retryButton);
  const leaderboardControls = Object.fromEntries(
    ["open", "top", "around", "back"].map((action) => {
      const control = button.cloneNode(false) as HTMLButtonElement;
      control.id = `leaderboard-${action}`;
      control.className = "leaderboard-control";
      button.after(control);
      return [action, control];
    }),
  ) as Record<"open" | "top" | "around" | "back", HTMLButtonElement>;
  let leaderboardOpen = false;
  const fullscreenButton =
    document.querySelector<HTMLButtonElement>("#fullscreen")!;
  const pauseButton = document.querySelector<HTMLButtonElement>("#pause")!;
  const rotatePrompt = document.querySelector<HTMLElement>("#rotate-device")!;
  const displayMessage =
    document.querySelector<HTMLElement>("#display-message")!;
  const mobile = matchMedia("(pointer: coarse)").matches;
  const immersive = new ImmersiveDisplay(mobile);
  const touch = new TouchControls(
    document.querySelector<HTMLElement>("#touch-controls")!,
  );
  const gamepads = new GamepadControls();
  let pad = gamepads.poll([]);
  let controlMode: "mouse" | "touch" | "gamepad" = mobile ? "touch" : "mouse";
  let portableActive = false;
  const portrait = () => mobile && innerHeight > innerWidth;
  const controlsActive = () =>
    !document.hidden && !portrait() && (locked || portableActive);
  async function toggleFullscreen() {
    const ok = await immersive.toggle();
    displayMessage.hidden = ok;
    displayMessage.textContent = ok
      ? ""
      : "Fullscreen unavailable. You can still play in this browser.";
  }
  fullscreenButton.addEventListener("click", () => void toggleFullscreen());
  document
    .querySelector("#rotate-fullscreen")!
    .addEventListener("click", () => void immersive.enter());
  document.addEventListener("fullscreenchange", () => {
    const active = !!document.fullscreenElement;
    fullscreenButton.textContent = active ? "][" : "[ ]";
    fullscreenButton.setAttribute(
      "aria-label",
      active ? "Exit fullscreen" : "Enter fullscreen",
    );
    fullscreenButton.setAttribute("aria-pressed", String(active));
    if (!active) {
      try {
        screen.orientation?.unlock?.();
      } catch {
        /* Optional browser API. */
      }
    }
  });
  const profile = new DisplayName();
  nameInput.value = profile.name;
  namePanel.hidden = !!profile.name;
  nameInput.addEventListener("input", () => nameInput.setCustomValidity(""));
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
    leaderboard = new Leaderboard(undefined, configuredGameServices()),
    ui = new UI(
      uiCanvas,
      button,
      soundButton,
      retryButton,
      leaderboardControls,
    );
  const browse = (mode: "top" | "around") =>
    void leaderboard.browse(mode, !!profile.name);
  function closeLeaderboard() {
    leaderboardOpen = false;
    namePanel.hidden = !!profile.name;
    requestAnimationFrame(() => leaderboardControls.open.focus());
  }
  leaderboardControls.open.addEventListener("click", () => {
    leaderboardOpen = true;
    namePanel.hidden = true;
    browse("top");
    requestAnimationFrame(() => leaderboardControls.top.focus());
  });
  leaderboardControls.top.addEventListener("click", () => browse("top"));
  leaderboardControls.around.addEventListener("click", () => browse("around"));
  leaderboardControls.back.addEventListener("click", closeLeaderboard);
  retryButton.addEventListener("click", () => {
    if (leaderboardOpen) browse(leaderboard.browseMode);
    else void leaderboard.retry();
  });
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
    vacuumHeld = false,
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
    mobile,
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
    personalBest: null,
    rank: null,
    leaderboardStatus: leaderboard.status,
    leaderboardReadStatus: leaderboard.topStatus,
    retryLabel: leaderboard.retryLabel,
    loading: false,
    canRetry: false,
  };
  status.classList.add("hidden");
  status.textContent = "Ready. Play Vaccoin. Headphones recommended.";
  leaderboard.name = profile.name || "YOU";
  if (profile.name) void leaderboard.connect(profile.name);
  else void leaderboard.prepareLive();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) leaderboard.stopLive();
    else void leaderboard.prepareLive();
  });
  window.addEventListener("pagehide", () => leaderboard.stopLive());
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void leaderboard.prepareLive();
  });
  function stopInput() {
    keys.clear();
    mouseDown = false;
    vacuumHeld = false;
    touch.clear();
    audio.motorUpdate(false, 0);
  }
  function pauseControls() {
    portableActive = false;
    stopInput();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  pauseButton.addEventListener("click", pauseControls);
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
  async function play(
    restart = false,
    source: "mouse" | "touch" | "gamepad" = mobile ? "touch" : "mouse",
  ) {
    if (leaderboardOpen) return;
    if (requesting) return;
    if (!profile.name) {
      if (!profile.save(nameInput.value)) {
        nameInput.setCustomValidity(
          "Enter a display name with 3–24 characters and no control characters.",
        );
        nameInput.reportValidity();
        nameInput.focus();
        return;
      }
      nameInput.value = profile.name;
      namePanel.hidden = true;
      void leaderboard.connect(profile.name);
    }
    nameInput.blur();
    controlMode = source;
    if (source !== "mouse") {
      intent.cancel();
      if (restart || round.phase !== "playing") startRound();
      portableActive = true;
      error = "";
      void audio.unlock();
      if (source === "touch") void immersive.enter();
      return;
    }
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
    if (!controlsActive() && round.phase === "playing") void play();
  });
  soundButton.addEventListener("click", () => {
    void audio.unlock();
    audio.setMuted(!audio.muted);
  });
  document.addEventListener("pointerlockchange", () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) {
      stopInput();
      if (controlMode === "mouse") portableActive = false;
    } else captureAcquired();
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
      e.target instanceof HTMLButtonElement &&
      (e.code === "Enter" || e.code === "Space")
    )
      return;
    if (leaderboardOpen) {
      if (e.code === "Escape") {
        e.preventDefault();
        closeLeaderboard();
      }
      // Let native buttons handle Enter/Space without starting a round.
      return;
    }
    if (e.target instanceof HTMLInputElement) {
      if (e.code === "Enter" && !e.repeat) {
        e.preventDefault();
        void play();
      }
      return;
    }
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
    if (e.code === "KeyF" && !e.repeat) {
      e.preventDefault();
      void toggleFullscreen();
    }
    if (e.code === "Escape") pauseControls();
    if (e.code === "KeyM" && !e.repeat) audio.setMuted(!audio.muted);
    if (e.code === "KeyR" && !e.repeat) {
      if (controlsActive()) startRound();
      else void play(true);
    }
    if (e.code === "Enter" && !e.repeat && !locked) void play();
    if (controlsActive()) keys.add(e.code);
  });
  document.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", pauseControls);
  function finishIfExpired() {
    if (!round.tick(performance.now())) return;
    pauseControls();
    audio.finish();
    const run = { id: round.id, score: round.score, durationMs: 60000 };
    void leaderboard.complete(run);
    status.textContent = `Round complete. ${round.score} coins collected. Play again.`;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseControls();
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
      Number(keys.has("KeyD")) -
        Number(keys.has("KeyA")) +
        touch.input.moveX +
        pad.moveX,
      Number(keys.has("KeyW")) -
        Number(keys.has("KeyS")) +
        touch.input.moveY +
        pad.moveY,
      keys.has("Space"),
    );
    keys.delete("Space");
    if (springboards.update(dt, player)) {
      audio.tone(180, 0.14, 0.12, "triangle");
      audio.tone(540, 0.18, 0.09, "sine", 0.06);
    }
    cameraToPlayer();
    vacuum.update(dt, performance.now() / 1000, vacuumHeld, player.speed, rate);
    round.destroyed += destructibles.update(
      dt,
      performance.now() / 1000,
      player,
      eye,
      direction,
      vacuumHeld,
    );
    gainedFrame += coins.update(dt, eye, direction, vacuum.target, vacuumHeld);
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
    let pads: (Gamepad | null)[] = [];
    try {
      pads = Array.from(navigator.getGamepads?.() ?? []);
    } catch {
      /* Gamepad API may be denied. */
    }
    const wasConnected = pad.connected;
    pad = gamepads.poll(pads);
    if (wasConnected && !pad.connected && controlMode === "gamepad")
      pauseControls();
    const menuAction = pad.menu || (pad.confirm && round.phase !== "playing");
    if (menuAction && !document.hidden && document.hasFocus()) {
      if (round.phase === "playing" && controlsActive()) pauseControls();
      else void play(false, "gamepad");
    }
    rotatePrompt.hidden = !portrait();
    if (portrait() && (portableActive || locked)) pauseControls();
    const active = round.phase === "playing" && controlsActive();
    pauseButton.hidden = round.phase !== "playing" || !active;
    touch.show(active && mobile);
    if (active) {
      const [dx, dy] = touch.input.consumeLook();
      player.look(
        dx * (540 / innerHeight) + pad.lookX * elapsed * 900,
        dy * (540 / innerHeight) + pad.lookY * elapsed * 900,
      );
      if (touch.input.consumeJump() || (!menuAction && pad.jump))
        keys.add("Space");
    }
    vacuumHeld = active && (mouseDown || touch.input.vacuum || pad.vacuum);
    gainedFrame = 0;
    if (active) {
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
    const sucking = vacuumHeld;
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
    if (round.phase === "title") {
      const layout = titleLayout(ui.w);
      namePanel.style.left = `${(layout.nameX / ui.w) * 100}%`;
      namePanel.style.top = `${(layout.nameY / 540) * 100}%`;
      namePanel.style.width = `${(256 / ui.w) * 100}%`;
    }
    uiState.liveEntries = leaderboard.liveEntries;
    uiState.liveStatus = leaderboard.liveStatus;
    uiState.rankNotice =
      Date.now() < leaderboard.rankNoticeUntil ? leaderboard.rankNotice : "";
    uiState.phase = round.phase;
    uiState.leaderboardOpen = leaderboardOpen;
    uiState.browseMode = leaderboard.browseMode;
    uiState.browseEntries = leaderboard.browseEntries;
    uiState.browseStatus = leaderboard.browseStatus;
    uiState.browseLoading = leaderboard.browseLoading;
    uiState.browseCanRetry = leaderboard.browseCanRetry;
    uiState.score = round.score;
    uiState.remaining = round.phase === "playing" ? round.remaining(now) : 60;
    uiState.best = leaderboard.best;
    uiState.sucking = sucking;
    uiState.locked = controlsActive();
    uiState.controlHint = mobile
      ? "LEFT MOVE / RIGHT LOOK / HOLD VAC"
      : pad.connected
        ? "STICKS MOVE + LOOK / A JUMP / RT VAC / START PAUSE"
        : "WASD MOVE / MOUSE LOOK / CLICK VAC / SPACE JUMP / F FULLSCREEN";
    uiState.time =
      round.phase === "playing" ? (now - round.startedAt) / 1000 : now / 1000;
    uiState.muted = audio.muted;
    uiState.entries = leaderboard.entries;
    uiState.error = error;
    uiState.persisted = leaderboard.persisted;
    uiState.personalBest = leaderboard.personalBest;
    uiState.rank = leaderboard.rank;
    uiState.leaderboardStatus = leaderboard.status;
    uiState.leaderboardReadStatus = leaderboard.topStatus;
    uiState.retryLabel = leaderboard.retryLabel;
    uiState.loading = leaderboard.loading;
    uiState.canRetry = leaderboard.canRetry;
    view.draw();
    ui.draw(uiState, elapsed);
  }
  // Deliberately dev-only QA hooks; stripped out of the production build.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("qa")) {
    Object.assign(window, {
      vaccoinQA: {
        snapshot: () => ({
          live: {
            entries: leaderboard.liveEntries,
            status: leaderboard.liveStatus,
            notice: leaderboard.rankNotice,
          },
          leaderboardBrowser: {
            open: leaderboardOpen,
            mode: leaderboard.browseMode,
            entries: leaderboard.browseEntries,
            status: leaderboard.browseStatus,
          },
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
          controlsActive: controlsActive(),
          controlMode,
          yaw: player.yaw,
          pitch: player.pitch,
          vacuumHeld,
          gamepadConnected: pad.connected,
          destroyed: round.destroyed,
          drawCalls: view.renderer.info.render.calls,
          triangles: view.renderer.info.render.triangles,
          averageFrameMs: totalFrameMs / Math.max(1, frames),
          maxFrameMs,
          online: leaderboard.status,
          personalBest: leaderboard.personalBest,
          rank: leaderboard.rank,
          entries: leaderboard.entries,
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
