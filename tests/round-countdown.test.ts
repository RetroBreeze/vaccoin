import { describe, expect, it } from "vitest";
import { Round } from "../src/round";

describe("round start countdown", () => {
  it("freezes a countdown while away and resumes its remaining preparation time", () => {
    const round = new Round();
    round.start(1000, 3);
    round.pause(2500);
    expect(round.countdown(100000)).toBe(2);
    expect(round.remaining(100000)).toBe(60);
    expect(round.tick(100000)).toBe(false);
    round.resume(100000);
    expect(round.countdown(100000)).toBe(2);
    expect(round.countdown(101500)).toBe(0);
    expect(round.remaining(102500)).toBe(59);
  });

  it("does not spend playing time or accept coins while controls are paused", () => {
    const round = new Round();
    round.start(1000);
    round.collect(10, 2000);
    round.pause(11000);
    round.pause(21000);
    round.collect(50, 100000);
    expect(round.score).toBe(10);
    expect(round.remaining(100000)).toBe(50);
    expect(round.tick(100000)).toBe(false);
    round.resume(100000);
    round.resume(105000);
    expect(round.remaining(110000)).toBe(40);
    expect(round.tick(150000)).toBe(true);
  });

  it("clears the paused clock when restarting", () => {
    const round = new Round();
    round.start(1000);
    round.pause(2000);
    round.start(10000, 3);
    expect(round.paused).toBe(false);
    expect(round.countdown(12000)).toBe(1);
    expect(round.remaining(14000)).toBe(59);
  });
  it("shows 3, 2, 1 before the full 60 second round begins", () => {
    const round = new Round();
    round.start(1000, 3);
    expect(round.phase).toBe("playing");
    expect(round.countdown(1000)).toBe(3);
    expect(round.countdown(1999)).toBe(3);
    expect(round.countdown(2000)).toBe(2);
    expect(round.countdown(3000)).toBe(1);
    expect(round.countdown(4000)).toBe(0);
    expect(round.remaining(1000)).toBe(60);
    expect(round.remaining(3999)).toBe(60);
    expect(round.remaining(4000)).toBe(60);
    expect(round.remaining(5000)).toBe(59);
    expect(round.tick(63999)).toBe(false);
    expect(round.tick(64000)).toBe(true);
  });

  it("accepts score only after the countdown ends and resets countdown on restart", () => {
    const round = new Round();
    round.start(1000, 3);
    round.collect(10, 3999);
    expect(round.score).toBe(0);
    round.collect(10, 4000);
    expect(round.score).toBe(10);
    round.start(5000, 3);
    expect(round.score).toBe(0);
    expect(round.countdown(5000)).toBe(3);
    round.collect(10, 7999);
    expect(round.score).toBe(0);
    round.start(9000);
    expect(round.countdown(9000)).toBe(0);
    round.collect(10);
    expect(round.score).toBe(10);
  });
});
