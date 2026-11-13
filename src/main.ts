import { Accounts } from './accounts';
import { AccountUI } from './account-ui';
import { Workshop, type WorkshopRecord } from './workshop';
import { WorkshopUI } from './workshop-ui';
import { createIndexedDbStore } from '@supagame/sdk-ts/browser';
import { MenuUI } from "./menu-ui";
import { installEntryScreen } from "./entry-screen";
import "./style.css";
import { Vector3 } from "three";
import { Assets } from "./assets";
import { Rendering } from "./rendering";
import { MenuCamera } from "./menu-camera";
import { buildArena, updateCasinoVisibility } from "./arena";
import { CasinoAtmosphere } from "./casino-atmosphere";
import { CasinoSpectacle } from "./casino-spectacle";
import { casinoZone } from "./casino-layout";
import { Player } from "./player";
import { LARGE_CRATE_COINS } from "./coin-counts";
import { Coins } from "./coins";
import { Vacuum } from "./vacuum";
import { Destructibles } from "./destructibles";
import { Effects } from "./effects";
import { AudioEngine } from "./audio";
import { Round } from "./round";
import { Leaderboard } from "./supagame";
import { configuredGameConnection } from "./game-services";
import { UI, UIState } from "./ui";
import { DisplayName, normalizeDisplayName } from "./display-name";
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
  const savedNamePanel =
    document.querySelector<HTMLDivElement>("#saved-player-name")!;
  const currentName = document.querySelector<HTMLElement>(
    "#current-player-name",
  )!;
  const changeName = document.querySelector<HTMLButtonElement>("#change-name")!;
  const saveNameButton =
    document.querySelector<HTMLButtonElement>("#save-name")!;
  const cancelNameButton =
    document.querySelector<HTMLButtonElement>("#cancel-name")!;
  const nameActions = document.querySelector<HTMLDivElement>("#name-actions")!;
  const nameHelp = document.querySelector<HTMLElement>("#name-help")!;
  let editingName = false,
    savingName = false;
  const retryButton = button.cloneNode(false) as HTMLButtonElement;
  retryButton.id = "retry-leaderboard";
  retryButton.textContent = "RETRY RANKINGS";
  retryButton.setAttribute("aria-label", "Retry rankings");
  retryButton.style.display = "none";
  button.after(retryButton);
  const leaderboardControls = Object.fromEntries(
    ["open", "top", "top100", "around", "back"].map((action) => {
      const control = button.cloneNode(false) as HTMLButtonElement;
      control.id = `leaderboard-${action}`;
      control.className = "leaderboard-control";
      button.after(control);
      return [action, control];
    }),
  ) as Record<"open" | "top" | "top100" | "around" | "back", HTMLButtonElement>;
  let leaderboardOpen = false, achievementsOpen = false;
  const achievementsButton = button.cloneNode(false) as HTMLButtonElement;
  achievementsButton.id = 'achievements-open';
  achievementsButton.className = 'leaderboard-control';
  button.after(achievementsButton);
  achievementsButton.addEventListener('click', () => {
    achievementsOpen = !achievementsOpen;
    if (achievementsOpen) void leaderboard.browseAchievements().catch(() => {});
    requestAnimationFrame(() => achievementsButton.focus({ preventScroll: true }));
  });
  const pauseButton = document.querySelector<HTMLButtonElement>("#pause")!;
  const mainMenuButton = document.querySelector<HTMLButtonElement>("#main-menu")!;
  const rotatePrompt = document.querySelector<HTMLElement>("#rotate-device")!;
  const displayMessage =
    document.querySelector<HTMLElement>("#display-message")!;
  const mobile = matchMedia("(pointer: coarse)").matches;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const menuCamera = new MenuCamera();
  const immersive = new ImmersiveDisplay(mobile);
  const audio = new AudioEngine();
  const entered = installEntryScreen(audio, immersive);
  const touch = new TouchControls(
    document.querySelector<HTMLElement>("#touch-controls")!,
  );
  const gamepads = new GamepadControls();
  let pad = gamepads.poll([]);
  let controlMode: "mouse" | "touch" | "gamepad" = mobile ? "touch" : "mouse";
  let portableActive = false;
  const portrait = () => mobile && innerHeight > innerWidth;
  const controlsActive = () =>
    !document.hidden && !portrait() && !round.paused && (locked || portableActive);
  async function toggleFullscreen() {
    const ok = await immersive.toggle();
    displayMessage.hidden = ok;
    displayMessage.textContent = ok ? "" : immersive.fallbackMessage;
  }
  const rotateFullscreen = document.querySelector<HTMLButtonElement>("#rotate-fullscreen")!;
  rotateFullscreen.hidden = !immersive.supported || immersive.standalone;
  rotateFullscreen.addEventListener("click", () => {
    void immersive.enter().then((ok) => {
      displayMessage.hidden = ok;
      displayMessage.textContent = ok ? "" : immersive.fallbackMessage;
    });
  });
  const fullscreenChanged = () => {
    if (!immersive.active) {
      try {
        screen.orientation?.unlock?.();
      } catch {
        /* Optional browser API. */
      }
    }
  };
  document.addEventListener("fullscreenchange", fullscreenChanged);
  document.addEventListener("webkitfullscreenchange", fullscreenChanged);
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
  coins.meshes.forEach(mesh => view.scene.add(mesh));
  const connection = configuredGameConnection();
  const identityKey = `vaccoin.workshop.identity:${connection?.namespace ?? 'local'}`;
  let activePlayer: string | null = null;
  try { activePlayer = localStorage.getItem(identityKey); } catch { /* Optional local identity hint, never an authorization token. */ }
  const rememberPlayer = (id: string | null) => {
    activePlayer = id;
    try { if (id) localStorage.setItem(identityKey, id); else localStorage.removeItem(identityKey); } catch { /* IndexedDB still reports its own persistence failures. */ }
  };
  if (activePlayer) profile.bind(`${connection?.namespace ?? 'local'}:${activePlayer}`, false);
  connection?.supabase.auth.onAuthStateChange((event, session) => {
    if (session) rememberPlayer(session.user.id);
    else if (event === 'SIGNED_OUT') rememberPlayer(null);
  });
  const player = new Player(),
    vacuum = new Vacuum(view.camera),
    effects = new Effects(view.scene, view.camera),
    round = new Round(),
    leaderboard = new Leaderboard(undefined, connection?.game),
    ui = new UI(
      uiCanvas,
      new MenuUI(),
    );
  leaderboard.setAccountScope(`${connection?.namespace ?? 'local'}:${activePlayer ?? 'local-guest'}`);
  const workshop = new Workshop({
    saves: connection?.game.saves,
    store: createIndexedDbStore<WorkshopRecord>('vaccoin-workshop-v1'),
    namespace: connection?.namespace ?? 'local-vaccoin',
    identity: async () => {
      if (!connection) return null;
      if (!navigator.onLine) return activePlayer;
      let timeout: ReturnType<typeof setTimeout>;
      try {
        const result = await Promise.race([
          connection.supabase.auth.getSession(),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Auth temporarily unavailable')), 2000); }),
        ]);
        if (result.data.session) rememberPlayer(result.data.session.user.id);
        else if (!result.error) rememberPlayer(null);
      } catch { /* A cached authenticated identity can read its own local state offline. */ }
      finally { clearTimeout(timeout!); }
      return activePlayer;
    },
  });
  const workshopUI = new WorkshopUI(ui, workshop, open => {
    if (open) { leaderboardOpen = false; achievementsOpen = false; pauseControls(); }
  });
  let runSaveGeneration = workshop.generation;
  let runOwner: string | null = null;
  const prepareWorkshop = async () => {
    if (connection && navigator.onLine) {
      let timeout: ReturnType<typeof setTimeout>;
      try { await Promise.race([(async () => {
        const existing = await connection.supabase.auth.getSession();
        if (existing.error) throw existing.error;
        rememberPlayer(existing.data.session?.user.id ?? null);
        if (!activePlayer) rememberPlayer((await connection.game.players.ensureAnonymousSession()).userId);
      })(), new Promise<void>(resolve => { timeout = setTimeout(resolve, 3000); })]);
      } catch { /* Existing cached sessions are never replaced after an Auth failure. */ } finally { clearTimeout(timeout!); }
    }
    await workshop.initialize();
    audio.setMuted(workshop.progress.preferences.muted);
  };
  const accounts = new Accounts(connection?.game, workshop, connection?.namespace ?? 'local', undefined, connection?.supabase.auth);
  const accountUI = new AccountUI(ui, accounts, () => {
    leaderboardOpen = false; achievementsOpen = false; workshopUI.setOpen(false); pauseControls();
  });
  let accountBooted = false;
  let runtimePlayer: string | null = null;
  connection?.game.players.onAuthStateChange((state, event) => {
    if (event === 'INITIAL_SESSION' || !accountBooted) return;
    if (state.userId !== runtimePlayer) {
      // A fresh runtime isolates pending runs, profile caches, notifications and sockets.
      accountBooted = false;
      void workshop.pauseForAccount(); leaderboard.stopLive(); leaderboard.achievements.dispose();
      pauseControls();
      setTimeout(() => location.reload(), 0);
    }
  });
  const accountStartup = (async () => {
    await accounts.initialize();
    await prepareWorkshop();
    try {
      await accounts.refresh();
      runtimePlayer = accounts.status.userId;
      if (connection && runtimePlayer) {
        // Names and local bests are user-specific; cloud identity is authoritative after recovery.
        const scope = `${connection.namespace}:${runtimePlayer}`;
        profile.bind(scope, accounts.status.isAnonymous);
        leaderboard.setAccountScope(scope);
        const remote = await connection.game.players.getMe();
        if (remote.displayName || accounts.googleDisplayName) profile.save(remote.displayName || accounts.googleDisplayName);
        else if (!accounts.status.isAnonymous) profile.name = '';
        nameInput.value = profile.name;
        leaderboard.name = profile.name || 'YOU';
      }
    } catch { /* Offline local play remains available; never replace a rejected session. */ }
    accountBooted = true;
  })();
  window.addEventListener('online', () => void workshop.sync());
  window.addEventListener('focus', () => void workshop.sync());
  setInterval(() => { if (!document.hidden) void workshop.sync(); }, 30000);
  changeName.addEventListener("click", () => {
    editingName = true;
    nameInput.value = profile.name;
    nameInput.setCustomValidity("");
    nameHelp.textContent = "3–24 characters";
    namePanel.hidden = false;
    savedNamePanel.hidden = true;
    nameActions.hidden = false;
    nameInput.focus();
    nameInput.select();
  });
  function cancelNameEdit() {
    if (savingName) return;
    editingName = false;
    nameInput.value = profile.name;
    nameInput.setCustomValidity("");
    nameActions.hidden = true;
    requestAnimationFrame(() => changeName.focus());
  }
  async function saveNameEdit() {
    if (savingName) return;
    const value = normalizeDisplayName(nameInput.value);
    if (!value) {
      nameInput.setCustomValidity(
        "Enter a display name with 3–24 characters and no control characters.",
      );
      nameInput.reportValidity();
      nameInput.focus();
      return;
    }
    savingName = true;
    saveNameButton.disabled =
      cancelNameButton.disabled =
      nameInput.disabled =
        true;
    saveNameButton.textContent = "Saving...";
    try {
      await leaderboard.rename(value);
      profile.save(value);
      editingName = false;
      nameActions.hidden = true;
      requestAnimationFrame(() => changeName.focus());
    } catch {
      nameHelp.textContent = "Couldn't save. Try again.";
    } finally {
      savingName = false;
      saveNameButton.disabled =
        cancelNameButton.disabled =
        nameInput.disabled =
          false;
      saveNameButton.textContent = "Save";
    }
  }
  saveNameButton.addEventListener("click", () => void saveNameEdit());
  cancelNameButton.addEventListener("click", cancelNameEdit);
  const browse = (mode: "top" | "top100" | "around") =>
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
  leaderboardControls.top100.addEventListener("click", () => browse("top100"));
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
  const atmosphere = new CasinoAtmosphere(view.scene);
  const spectacle = new CasinoSpectacle(view.scene);
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
    playRequest = 0,
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
  void accountStartup.then(() => { if (profile.name) void leaderboard.connect(profile.name); else void leaderboard.prepareLive(); });
  document.addEventListener("visibilitychange", () => {
    leaderboard.achievements.update(round.phase, document.hidden);
    if (document.hidden) leaderboard.stopLive();
    else void leaderboard.prepareLive();
  });
  window.addEventListener("pagehide", () => { leaderboard.stopLive(); leaderboard.achievements.dispose(); });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) { void leaderboard.prepareLive(); void leaderboard.achievements.connect(); }
  });
  function stopInput() {
    keys.clear();
    mouseDown = false;
    vacuumHeld = false;
    touch.clear();
    audio.motorUpdate(false, 0);
  }
  function pauseControls() {
    playRequest++;
    round.pause(performance.now());
    portableActive = false;
    locked = false;
    intent.cancel();
    requesting = false;
    accumulator = 0;
    stopInput();
    audio.updateMusic(false);
    if (document.pointerLockElement) document.exitPointerLock();
  }
  pauseButton.addEventListener("click", pauseControls);
  mainMenuButton.addEventListener("click", () => {
    if (round.phase !== "results") return;
    pauseControls();
    round.phase = "title";
    leaderboardOpen = false;
    achievementsOpen = false;
    error = "";
    status.textContent = "Main menu.";
    button.focus();
  });
  function cameraToPlayer() {
    view.camera.position.copy(player.position);
    view.camera.position.y += 1.7;
    view.camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");
    view.camera.updateMatrixWorld();
    eye.copy(view.camera.position);
    view.camera.getWorldDirection(direction);
  }
  function startRound() {
    round.start(performance.now(), 3);
    runOwner = workshop.owner;
    runSaveGeneration = workshop.generation;
    player.reset();
    coins.reset();
    destructibles.reset();
    effects.reset();
    rate = 0;
    accumulator = 0;
    countdown = 60;
    stopInput();
    view.camera.fov = 78;
    view.camera.updateProjectionMatrix();
    cameraToPlayer();
    vacuum.reset(performance.now() / 1000);
    audio.start();
    status.textContent = "Round started. 60 seconds.";
    error = "";
    last = performance.now();
  }
  function resumeRound() {
    const now = performance.now();
    round.resume(now);
    accumulator = 0;
    last = now;
  }
  function captureAcquired() {
    locked = document.pointerLockElement === canvas;
    if (!locked) return;
    const action = intent.acquired(round.phase);
    if (document.hidden || (action === "none" && round.paused)) {
      pauseControls();
      return;
    }
    if (action !== "none") ignoreNextLook = true;
    if (action === "start") startRound();
    else if (action === "resume") resumeRound();
    error = "";
    requesting = false;
  }
  async function play(
    restart = false,
    source: "mouse" | "touch" | "gamepad" = mobile ? "touch" : "mouse",
  ) {
    if (!entered() || leaderboardOpen || achievementsOpen || workshopUI.open || accounts.open || accounts.busy) return;
    if (editingName) {
      void saveNameEdit();
      return;
    }
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
      requesting = true;
      intent.cancel();
      void audio.unlock();
      // Entry owns fullscreen. Resuming after a tab switch must not launch a
      // second display transition that can blur and pause the game again.
      const request = ++playRequest;
      await immersive.whenSettled();
      if (request !== playRequest) return;
      requesting = false;
      if (document.hidden) return;
      if (restart || round.phase !== "playing") startRound();
      else resumeRound();
      portableActive = true;
      error = "";
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
  document.addEventListener("pointerup", () => { if (entered()) void audio.unlock(); });
  document.addEventListener("keydown", () => { if (entered()) void audio.unlock(); });
  canvas.addEventListener("click", () => {
    if (!controlsActive() && round.phase === "playing") void play();
  });
  soundButton.addEventListener("click", () => {
    void audio.unlock();
    audio.setMuted(!audio.muted);
    void workshop.mute(audio.muted);
  });
  document.addEventListener("pointerlockchange", () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) {
      if (controlMode === "mouse") pauseControls();
      else stopInput();
    } else captureAcquired();
  });
  document.addEventListener("pointerlockerror", () => {
    intent.cancel();
    requesting = false;
    error = "MOUSE CAPTURE BLOCKED / CLICK PLAY TO RETRY";
  });
  document.addEventListener("mousemove", (e) => {
    if (locked && round.phase === "playing" && round.countdown(performance.now()) === 0) {
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
    if (!entered()) return;
    if (
      e.target instanceof HTMLButtonElement &&
      (e.code === "Enter" || e.code === "Space")
    )
      return;
    if (accounts.open) return;
    if (workshopUI.open) { if (e.code === 'Escape') workshopUI.setOpen(false); return; }
    if (achievementsOpen) { if (e.code === 'Escape') { achievementsOpen = false; achievementsButton.focus(); } return; }
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
        if (editingName) void saveNameEdit();
        else void play();
      }
      if (e.code === "Escape" && editingName) {
        e.preventDefault();
        cancelNameEdit();
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
    if (e.code === "KeyM" && !e.repeat) { audio.setMuted(!audio.muted); void workshop.mute(audio.muted); }
    if (e.code === "KeyR" && !e.repeat) {
      if (controlsActive()) startRound();
      else void play(true);
    }
    if (e.code === "Enter" && !e.repeat && !locked) void play();
    if (controlsActive()) keys.add(e.code);
  });
  document.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => {
    if (immersive.transitioning && !document.hidden) return;
    pauseControls();
  });
  window.addEventListener("pagehide", pauseControls);
  function finishIfExpired() {
    if (!round.tick(performance.now())) return;
    pauseControls();
    audio.finish();
    const run = { id: round.id, score: round.score, durationMs: 60000 };
    void leaderboard.complete(run);
    void workshop.complete(run, runOwner, runSaveGeneration);
    status.textContent = `Round complete. ${round.score} points collected. Play again.`;
  }
  document.addEventListener("visibilitychange", () => {
    leaderboard.achievements.update(round.phase, document.hidden);
    if (document.hidden) pauseControls();
  });
  setInterval(finishIfExpired, 250);
  window.addEventListener("resize", () => {
    view.resize();
    ui.resize();
  });
  void vacuum.load();
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
    cameraToPlayer();
    vacuum.update(dt, performance.now() / 1000, vacuumHeld, player.speed, rate, player.velocity.y, player.grounded);
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
    if (document.hidden) return;
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
    rotatePrompt.hidden = !portrait() || round.phase !== "playing" || accounts.open;
    if (portrait() && (portableActive || locked)) pauseControls();
    if (round.phase === "playing" && !controlsActive()) round.pause(now);
    finishIfExpired();
    const captured = round.phase === "playing" && controlsActive();
    const active = captured && round.countdown(now) === 0;
    view.observeFrame(raw, active);
    if (captured && !active) vacuum.update(elapsed, now / 1000, false, 0, 0);
    audio.updateMusic(captured);
    pauseButton.hidden = round.phase !== "playing" || !captured;
    touch.show(captured && mobile);
    if (active) {
      const [dx, dy] = touch.input.consumeLook();
      player.look(
        dx * (540 / innerHeight) + pad.lookX * elapsed * 900,
        dy * (540 / innerHeight) + pad.lookY * elapsed * 900,
      );
      if (touch.input.consumeJump() || (!menuAction && pad.jump))
        keys.add("Space");
    } else {
      touch.input.consumeLook();
      touch.input.consumeJump();
    }
    vacuumHeld = active && (mouseDown || touch.input.vacuum || pad.vacuum);
    gainedFrame = 0;
    if (active) {
      accumulator = Math.min(accumulator + elapsed, 0.1);
      while (accumulator >= 1 / 120) {
        simulate(1 / 120);
        accumulator -= 1 / 120;
      }
      round.collect(gainedFrame, now);
      rate +=
        (gainedFrame / Math.max(elapsed, 0.001) - rate) *
        (1 - Math.exp(-5 * elapsed));
      audio.coins(gainedFrame);
      if (gainedFrame > 5 && Math.random() < 0.25)
        effects.burst(vacuum.nozzleTarget.x, vacuum.nozzleTarget.y, vacuum.nozzleTarget.z, 2);
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
    vacuum.equip(workshop.progress.equipped);
    const menuBackground = round.phase !== "playing";
    view.setMenuMode(menuBackground);
    vacuum.group.visible = !menuBackground;
    if (menuBackground) {
      menuCamera.update(view.camera, elapsed, reducedMotion.matches);
      emblem.rotation.y = reducedMotion.matches ? 0 : Math.sin(now * 0.0005) * 0.15;
    } else {
      const desired = 78 + (player.speed / 14) * 3;
      if (Math.abs(view.camera.fov - desired) > 0.05) {
        view.camera.fov += (desired - view.camera.fov) * 0.15;
        view.camera.updateProjectionMatrix();
      }
    }
    const titleVisible = round.phase === "title" && !leaderboardOpen && !achievementsOpen && !workshopUI.open && !accounts.open;
    namePanel.hidden = !titleVisible || (!!profile.name && !editingName);
    savedNamePanel.hidden = !titleVisible || !profile.name || editingName;
    currentName.textContent = profile.name;
    uiState.liveEntries = leaderboard.liveEntries;
    uiState.liveStatus = leaderboard.liveStatus;
    uiState.rankNotice =
      Date.now() < leaderboard.rankNoticeUntil ? leaderboard.rankNotice : "";
    leaderboard.achievements.update(round.phase, document.hidden, round.score);
    uiState.achievementsOpen = achievementsOpen;
    uiState.achievements = leaderboard.achievements.rows;
    uiState.achievementStatus = leaderboard.achievements.status;
    uiState.achievementNotice = leaderboard.achievements.queue?.current ?? null;
    uiState.phase = round.phase;
    uiState.leaderboardOpen = leaderboardOpen;
    uiState.browseMode = leaderboard.browseMode;
    uiState.browseEntries = leaderboard.browseEntries;
    uiState.browseStatus = leaderboard.browseStatus;
    uiState.browseLoading = leaderboard.browseLoading;
    uiState.browseCanRetry = leaderboard.browseCanRetry;
    uiState.score = round.score;
    uiState.zone = casinoZone(player.position.x,player.position.y,player.position.z);
    uiState.pickup = coins.pickupTime > 0 ? coins.pickup : "";
    uiState.remaining = round.phase === "playing" ? round.remaining(now) : 60;
    uiState.countdown = round.countdown(now);
    uiState.best = leaderboard.best;
    uiState.sucking = sucking;
    uiState.locked = controlsActive();
    uiState.time = round.phase === "playing" ? 60 - round.remaining(now) : now / 1000;
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
    coins.updateVisibility(view.camera.position.y, view.camera.position.x, view.camera.position.z);
    updateCasinoVisibility(view.scene,view.camera.position.y);
    atmosphere.update(now / 1000, destructibles.objects);
    spectacle.update(now / 1000);
    // Menus share the casino view; gameplay uses the adaptive device pixel budget.
    if (entered() && !document.hidden && (menuBackground || controlsActive() || view.needsFrame))
      view.draw(now, reducedMotion.matches);
    uiState.menuCovered = workshopUI.open || accounts.open;
    ui.draw(uiState, elapsed);
    if (workshopUI.open || accounts.open) ui.menus?.hide();
    workshopUI.draw(titleVisible, round.phase === 'results' && !accounts.open);
    accountUI.draw(titleVisible);


  }
  // Deliberately dev-only QA hooks; stripped out of the production build.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("qa")) {
    Object.assign(window, {
      vaccoinQA: {
        furniture: () => destructibles.furniture.objects.map(({id, key, x, y, z, rx, rz, tossed, moving, broken}) => ({id, key, x, y, z, rx, rz, tossed, moving, broken})),
        snapshot: () => ({
          workshop: {open:workshopUI.open,progress:workshop.progress,status:workshop.status,ready:workshop.ready,cosmetic:vacuum.cosmetic},
          achievements: {open: achievementsOpen, rows: leaderboard.achievements.rows, notice:leaderboard.achievements.queue?.current ?? null},
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
          cameraPosition: view.camera.position.toArray(),
          vacuumPosition: vacuum.group.position.toArray(),
          score: round.score,
          remaining: round.remaining(performance.now()),
          countdown: round.countdown(performance.now()),
          paused: round.paused,
          best: leaderboard.best,
          coins: coins.count,
          alive: coins.countAlive(),
          active: coins.activeCount,
          collected: coins.collected,
          collectibleScore: coins.score,
          zone: casinoZone(player.position.x,player.position.y,player.position.z),
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
        title: () => { round.phase = 'title'; pauseControls(); },
        workshopSync: () => workshop.sync(),
        workshopRun: (coins: number) => {
          round.collect(coins);
          round.startedAt = performance.now() - 60001;
          finishIfExpired();
        },
        collect: (count: number) => round.collect(count),
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
    "Could not open the casino. Check WebGL support and reload.";
});
