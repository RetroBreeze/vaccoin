import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  // Serve an isolated harness on the app origin so the real music assets and
  // browser audio graph are exercised without loading a game or backend.
  await page.route("**/audio-test.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<button id="unlock">Enable sound</button>',
    }),
  );
  await page.goto("http://127.0.0.1:5173/audio-test.html");
  await page.evaluate(async () => {
    const { AudioEngine } = await import("/src/audio.ts");
    const audio = (window.audioTest = new AudioEngine());
    audio.updateMusic(true);
    document
      .querySelector("#unlock")
      .addEventListener("click", () => audio.unlock());
  });
  await page.locator("#unlock").click();
  await page.waitForFunction(() => {
    const audio = window.audioTest;
    return audio.ctx?.state === "running" && audio.music?.currentTime > 0.1;
  });
  const inspect = () =>
    page.evaluate(() => {
      const audio = window.audioTest;
      return {
        music: audio.musicGain.gain.value,
        master: audio.master.gain.value,
        paused: audio.music.paused,
        muted: audio.music.muted,
        unlocked: audio.musicUnlocked,
      };
    });
  await page.waitForFunction(
    () => window.audioTest.musicGain.gain.value > 0.065,
  );
  const idle = await inspect();
  assert(idle.music * idle.master < 0.05, "music has a low output gain");
  await page.evaluate(() => window.audioTest.motorUpdate(true, 100));
  await page.waitForFunction(
    () => window.audioTest.musicGain.gain.value < 0.03,
  );
  const suction = await inspect();
  assert(suction.music < idle.music / 2, "suction reduces music smoothly");
  await page.evaluate(() => window.audioTest.coins(10));
  await page.waitForFunction(
    () => window.audioTest.musicGain.gain.value < 0.016,
  );
  await page.waitForFunction(
    () => window.audioTest.musicGain.gain.value > 0.024,
  );
  await page.evaluate(() => window.audioTest.motorUpdate(false, 0));
  await page.waitForFunction(
    () => window.audioTest.musicGain.gain.value > 0.065,
  );
  await page.evaluate(() => window.audioTest.setMuted(true));
  await page.waitForFunction(() => window.audioTest.master.gain.value < 0.001);
  assert.equal((await inspect()).muted, true);
  await page.evaluate(() => window.audioTest.setMuted(false));
  await page.waitForFunction(() => window.audioTest.master.gain.value > 0.54);
  assert.equal((await inspect()).muted, false);
  const stableSource = await page.evaluate(async () => {
    const audio = window.audioTest;
    const source = audio.musicSource;
    const media = audio.music;
    // Rapid switches can reject an earlier play promise with AbortError.
    audio.updateMusic(false);
    audio.updateMusic(true);
    await audio.unlock();
    return audio.musicSource === source && audio.music === media;
  });
  assert.equal(stableSource, true, "track changes reuse the one media source");
  await page.waitForFunction(() => window.audioTest.music.currentTime > 0.1);
  assert.equal((await inspect()).unlocked, true);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real music playback, low shared mix, vacuum/coin ducking and release, mute/unmute, persistent media source and rapid track switches",
  );
} finally {
  await browser.close();
}
