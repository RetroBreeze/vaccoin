import { readFile } from 'node:fs/promises';
const achievementDefinitions = JSON.parse(await readFile(new URL('../src/achievement-definitions.json',import.meta.url),'utf8'));
// Every browser check intercepts backend HTTP; no test score reaches hosted Supagame.
export async function mockBackend(
  page,
  { offline = false, savedName = false, appOrigin } = {},
) {
  const playerId = "11111111-1111-4111-8111-111111111111";
  let name = "Mara",
    best = 0;
  const submissions = new Map();
  const saves = new Map(), saveOperations = new Map();
  const calls = { signups: 0, profiles: 0, submissions: [], mine: 0, top: 0 };
  const sockets = [];
  calls.broadcast = () => {
    for (const {socket, topic, array, join_ref} of sockets) {
      const payload = {event:"changed",payload:{boardId:"vaccoin"},type:"broadcast"};
      socket.send(JSON.stringify(array ? [join_ref,null,topic,"broadcast",payload] : {topic,event:"broadcast",payload,ref:null}));
    }
  };
  calls.saves = saves;
  calls.saveOffline = false;
  calls.liveScore = 19000;
  calls.mineRank = null;
  calls.disconnect = () => { for (const {socket} of sockets.splice(0)) socket.close({code:1011,reason:"Test reconnect"}); };
  // No browser test may open a hosted Realtime socket.
  await page.routeWebSocket("**/realtime/v1/websocket*", socket => {
    socket.onMessage(raw => {
      const parsed = JSON.parse(String(raw));
      const array = Array.isArray(parsed);
      const message = array ? {join_ref:parsed[0],ref:parsed[1],topic:parsed[2],event:parsed[3],payload:parsed[4]} : parsed;
      if (message.event === "phx_join") sockets.push({socket,topic:message.topic,array,join_ref:message.join_ref});
      socket.send(JSON.stringify(array ? [message.join_ref,message.ref,message.topic,"phx_reply",{status:"ok",response:{}}] : {topic:message.topic,event:"phx_reply",payload:{status:"ok",response:{}},ref:message.ref}));
    });
  });
  if (savedName)
    await page.addInitScript(() => {
      try {
        localStorage.setItem("vaccoin.display-name.v1", "Mara");
      } catch {}
    });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      (appOrigin
        ? url.origin === appOrigin
        : ["127.0.0.1", "localhost"].includes(url.hostname)) &&
      !url.pathname.startsWith("/auth/v1/") &&
      !url.pathname.startsWith("/functions/v1/")
    )
      return route.continue();
    const json = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (offline)
      return json(
        { code: "UNAVAILABLE", message: "Offline test backend" },
        503,
      );
    const user = {
      id: playerId,
      aud: "authenticated",
      role: "authenticated",
      is_anonymous: true,
      email: "",
      app_metadata: { provider: "anonymous", providers: ["anonymous"] },
      user_metadata: {},
      created_at: "2026-11-10T00:00:00Z",
    };
    if (url.pathname.endsWith("/signup") || url.pathname.endsWith("/token")) {
      calls.signups++;
      const header = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" }),
      ).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          sub: playerId,
          role: "authenticated",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url");
      return json({
        access_token: `${header}.${payload}.test`,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "test-refresh",
        user,
      });
    }
    if (url.pathname.endsWith("/user")) return json(user);
    if (url.pathname.includes('/supagame/v1/saves')) {
      if (calls.saveOffline) return route.abort('internetdisconnected');
      const slot = url.pathname.split('/').at(-1);
      if (slot === 'saves') return json({slots:[...saves.values()]});
      if (request.method() === 'GET') return saves.has(slot) ? json({save:saves.get(slot)}) : json({code:'SAVE_NOT_FOUND',message:'Missing'},404);
      const body = request.postDataJSON();
      if (saveOperations.has(body.operationId)) return json({save:saveOperations.get(body.operationId)});
      const old=saves.get(slot);
      if (body.expectedRevision !== (old?.revision ?? 0)) return json({code:'SAVE_CONFLICT',message:'Changed',current:old??null},409);
      const save={slot,revision:(old?.revision??0)+1,schemaVersion:body.schemaVersion,kind:'json',data:body.data,metadata:body.metadata,sizeBytes:JSON.stringify(body.data).length,deleted:false,objectPath:null,createdAt:old?.createdAt??new Date().toISOString(),updatedAt:new Date().toISOString()};
      saves.set(slot,save);saveOperations.set(body.operationId,save);return json({save});
    }
    if (url.pathname.endsWith("/players/me")) {
      if (request.method() === "PATCH") {
        name = request.postDataJSON().displayName;
        calls.profiles++;
      }
      return json({
        playerId,
        displayName:
          request.method() === "PATCH" || calls.profiles ? name : null,
        createdAt: user.created_at,
      });
    }
    const entry = {
      playerId,
      displayName: name,
      rank: 12,
      score: best,
      achievedAt: user.created_at,
    };
    if (url.pathname.endsWith("/scores")) {
      const body = request.postDataJSON();
      calls.submissions.push(body);
      if (!submissions.has(body.submissionKey)) {
        best = Math.max(best, body.score);
        submissions.set(body.submissionKey, {
          outcome: body.score === best ? "best" : "not_best",
          score: body.score,
          bestScore: best,
        });
      }
      return json(submissions.get(body.submissionKey));
    }
    if (url.pathname.endsWith('/achievements')) return json(achievementDefinitions.map(a=>({id:a.id,title:a.title,description:a.description,icon:a.icon,category:a.category,metadata:a.metadata,progress:{current:calls.achievementScore ?? best,threshold:a.condition.threshold},unlocked:(calls.achievementScore ?? best)>=a.condition.threshold,unlockedAt:(calls.achievementScore ?? best)>=a.condition.threshold?'2026-11-10T00:00:00Z':null,historical:false})));
    if (url.pathname.endsWith("/entries")) {
      calls.top++;
      return json({
        entries: Array.from({ length: 10 }, (_, i) => ({
          ...entry,
          playerId: `22222222-2222-4222-8222-${String(i + 1).padStart(12, "0")}`,
          displayName: `Player ${i + 1}`,
          rank: i + 1,
          score: calls.liveScore - i * 100,
        })),
        nextCursor: null,
      });
    }
    if (url.pathname.endsWith("/me")) {
      calls.mine++;
      return json(calls.mineRank !== null ? {...entry, rank:calls.mineRank} : submissions.size ? entry : null);
    }
    // Block unexpected external traffic as well as unrecognised backend routes.
    return json({ code: "NOT_FOUND", message: "Unexpected test request" }, 404);
  });
  return calls;
}
