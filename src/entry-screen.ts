import type { AudioEngine } from "./audio";
import type { ImmersiveDisplay } from "./immersive";

/** Both calls must happen in the click handler, before awaiting either promise. */
export function installEntryScreen(
  audio: AudioEngine,
  immersive: ImmersiveDisplay,
) {
  const screen = document.getElementById("entry-screen")!;
  const button = document.getElementById("enter-casino") as HTMLButtonElement;
  const displayHelp = document.getElementById("entry-display-help")!;
  displayHelp.hidden = immersive.supported || immersive.standalone;
  if (!displayHelp.hidden) displayHelp.textContent = immersive.fallbackMessage;
  let entered = false;
  button.addEventListener("click", () => {
    if (entered) return;
    entered = true;
    void audio.unlock();
    void immersive.enter();
    screen.hidden = true;
    document.body.classList.add("casino-entered");
    // The menu may still be waiting for assets. Its first frame restores focus.
  });
  screen.querySelector(".entry-prompt")!.textContent = "CLICK OR TAP TO START";
  button.disabled = false;
  return () => entered;
}
