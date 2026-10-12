// Open Battle's service worker (#34), built by the `serviceWorker` plugin in
// vite.config.ts, which fills in the build's files and version.
//
// - It keeps the app on the device, so hotseat, solo games, lessons, replays,
//   the shelves and the campaign book work without a network, and the app can
//   be installed. A new version waits until the player chooses to reload
//   (src/sw/register.ts says when: never mid-game).
// - It shows play-by-mail notifications (src/mail/mailbox.ts). A push from
//   the mailbox carries nothing about the game: it only says a file has come,
//   and the app fetches it from the mailbox when it opens.
const VERSION = "736f72bade98";
const FILES = ["assets/Board-BVtYhQe3.js","assets/Branch-DYnBhGgE.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-1f6ArNHk.js","assets/CommandPanel-C122U3yo.js","assets/CommandPanel-Gnqpw4tu.js","assets/CoreAbilities-wE5rODj4.js","assets/Editor-CfV7oatf.js","assets/EventSeat-DynHudxv.js","assets/EventsUI-EaikQq2V.js","assets/FigureLibrary-DIpVz38S.js","assets/Game-D7isXStU.js","assets/GameScreen-CkoDoNoN.js","assets/MailLobby-l--u5Wjh.js","assets/Miniatures-Oe2WbedQ.js","assets/NextApp-CX3e4Iyn.css","assets/NextApp-RkUTesme.js","assets/OpenTables-_kTN-yXA.js","assets/Packages-DYMBRvU2.js","assets/PhotoMatch-BH8Fz1BI.js","assets/PlayerCard-v2cDe8L4.js","assets/Qd6Card-BuVwuUNU.js","assets/Qd6Card-CxMs6LJJ.js","assets/Qd6Card-DpiLR8i8.js","assets/RankedGame-ByMdy6Kz.js","assets/RoundPanel-BiuzYv4Q.js","assets/RoundPanel-DzsNPA8p.js","assets/RoundPanel-Oxpt92D_.js","assets/RulesPage-raeanw8J.js","assets/StandeeMaker-Dn18LkTb.js","assets/TeachRule-Daz2RqLM.js","assets/Workshop-CnWoV_hA.js","assets/_virtual_sandbox-worker-D7LJ9lgH.js","assets/_virtual_soak-worker-BPva1wWn.js","assets/actions-YvbxO2JH.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-CtIsNa7V.js","assets/book-BKEuGKCx.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-DmlgVPAn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-CbuythNH.js","assets/de-Dgh_hxLw.js","assets/demo-h8ccToYm.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-BF8bMAiz.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-XWbijnyv.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-d3t58IbN.js","assets/hooks-BEJng8Dt.js","assets/hooks-BTANWlAH.js","assets/hooks-wFL23o0D.js","assets/http-BkGLnaI6.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-acBTAZ-l.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-Dml8DwFi.js","assets/lesson-DvSc7yas.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-B7OiEEH2.js","assets/local-DbAHhPup.js","assets/mailbox-CBu_qUU7.js","assets/manifest-BRIPGYy3.js","assets/meshShape-BRszUv32.js","assets/nostr-Asb46HDG.js","assets/open-Ixmc561o.js","assets/open-Z0phF1iv.js","assets/pack-CWk2qu9A.js","assets/packPins-jJQpIsVT.js","assets/packageChange-Be729-6H.js","assets/page-BJ87xeBR.js","assets/play-C1yUTlJR.js","assets/post-qwyOaoi4.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-uJT6gwVn.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-T5eEI0Xk.js","assets/report-CIF-BbGf.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-CGsWtGF3.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-CmzAxHEx.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-Ch90KbhQ.js","assets/store-BI58-LQA.js","assets/store-BUeQXIcH.js","assets/store-BYZoLvzJ.js","assets/store-DJlRyvtI.js","assets/store-DfggAL6M.js","assets/store-DsgUk5gi.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DQTsKNRs.js","assets/systems-DcAbzV5v.js","assets/systems-DxVnTc9_.js","assets/systems-U0HJoHvC.js","assets/talk-BpkDbE9m.js","assets/three.module-DD1TOtOx.js","assets/thumb-c3EL5TGu.js","assets/trystero-B7o7vSAK.js","assets/trystero-DUAGCRo6.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CoiELHxW.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-DZ50Ip-W.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
const CACHE = `open-battle-${VERSION}`;
const DEV = VERSION === "dev";
const at = (path) => new URL(path, self.registration.scope).href;

self.addEventListener("install", (event) => {
  if (DEV) return;
  event.waitUntil(
    caches
      .open(CACHE)
      // Hashed build files never change, so the copies the page just loaded will do; the rest
      // (index.html, the manifest, icons) are fetched fresh.
      .then((cache) =>
        cache.addAll(
          FILES.map((f) => new Request(at(f), { cache: /-[\w-]{8}\.\w+$/.test(f) ? "default" : "reload" })),
        ),
      ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n.startsWith("open-battle-") && n !== CACHE).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// The page asks for the waiting version once the player says reload.
self.addEventListener("message", (event) => {
  if (event.data?.t === "skip-waiting") self.skipWaiting();
});

/** Things that only make sense live: the server's config, signalling, the mailbox, health. */
const LIVE = /\/(config\.json|health\.json|health|relay|mailbox)(\/|$|\?)/;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (DEV || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || LIVE.test(url.pathname)) return;
  if (request.mode === "navigate") {
    // The page: the network when it answers (it may carry a newer version), else the copy kept here.
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(at("index.html"), { cacheName: CACHE }).then((r) => r ?? Response.error()),
      ),
    );
    return;
  }
  // The build's files never change under a name: the kept copy first.
  event.respondWith(
    caches.match(request, { cacheName: CACHE, ignoreSearch: true }).then((kept) => kept ?? fetch(request)),
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("Your move · Open Battle", {
      body: "Your opponent sent their turn.",
      tag: "open-battle-mail",
      renotify: true,
      icon: at("icons/icon-192.png"),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow(self.registration.scope);
    }),
  );
});
