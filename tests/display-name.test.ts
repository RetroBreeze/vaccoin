import { expect, it } from "vitest";
import { DisplayName } from "../src/display-name";

it("trims and remembers a new player's name", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const profile = new DisplayName(storage);
  expect(profile.name).toBe("");
  expect(profile.save("  Mara  ")).toBe(true);
  expect(new DisplayName(storage).name).toBe("Mara");
});

it("rejects blank, short, long and control-character names", () => {
  const profile = new DisplayName();
  for (const name of ["", "   ", "ab", "a".repeat(25), "abc\nxyz"]) {
    expect(profile.save(name)).toBe(false);
    expect(profile.name).toBe("");
  }
  expect(profile.save("🪙".repeat(24))).toBe(true);
});

it("allows play when local storage is blocked and ignores invalid saved names", () => {
  const profile = new DisplayName({
    getItem: () => {
      throw Error();
    },
    setItem: () => {
      throw Error();
    },
  });
  expect(profile.save("Mara")).toBe(true);
  expect(profile.name).toBe("Mara");
  expect(new DisplayName({ getItem: () => "x", setItem: () => {} }).name).toBe(
    "",
  );
});

it('isolates display names when account changes',()=>{
 const values=new Map<string,string>();const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 const profile=new DisplayName(storage);profile.save('Guest');profile.bind('project:guest',true);profile.save('Guest');profile.bind('project:google',false);expect(profile.name).toBe('');profile.save('Google');profile.bind('project:guest',false);expect(profile.name).toBe('Guest');
});
