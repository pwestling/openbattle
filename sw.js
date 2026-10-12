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
const VERSION = "67ad3a27e552";
const FILES = ["assets/Board-ChyoI6bl.js","assets/Branch-DSuRGQpQ.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BKTi_Cyq.js","assets/CommandPanel-DsF6zk4U.js","assets/CommandPanel-cqIXLGAj.js","assets/Editor-Bs0uVZgT.js","assets/EventSeat-BOTNNR1_.js","assets/EventsUI-BJr6Q7Qq.js","assets/FigureLibrary-6LfQB0GI.js","assets/Game-VuQbOJSD.js","assets/GameScreen-BmDROYqi.js","assets/MailLobby-BMR0RamS.js","assets/Miniatures-C4Aie7ls.js","assets/NextApp-CZfGknj9.css","assets/NextApp-CeZudIOf.js","assets/OpenTables-DHeNA-8i.js","assets/PhotoMatch-BQlwRBZN.js","assets/PlayerCard-B1R7e73T.js","assets/RankedGame-D9jZiMin.js","assets/RulesPage-DHu5pO-t.js","assets/StandeeMaker-7uR5pn7x.js","assets/TeachRule-CQvN-x7H.js","assets/Workshop-Bj-JmeIG.js","assets/_virtual_sandbox-worker-CQ-LclbH.js","assets/_virtual_soak-worker-Drm3sI9m.js","assets/actions-DzwFrc9h.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-VUGIRS-R.js","assets/book-BFMK8yT7.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-CV3MwM_Z.js","assets/de-CqqE4-5s.js","assets/demo-znnoGaAQ.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-CMIKllOU.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-dDsFYJF6.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-BD4R3oVB.js","assets/help-BmNafUKQ.js","assets/hooks-DLQVP9sb.js","assets/http-BFjazrRV.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-Cye5mM4K.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-C846Am85.js","assets/lesson-D5w-mUCd.js","assets/levels-DlkUqTaf.js","assets/live-BRtWa4v0.js","assets/local-BaWcHG8T.js","assets/mailbox-BC5rC7Ks.js","assets/manifest-BRIPGYy3.js","assets/meshShape-9m02tT88.js","assets/nostr-BYo_xsGm.js","assets/open-DTuNVnwS.js","assets/open-Z0phF1iv.js","assets/pack-BHqj4cv5.js","assets/packPins-D-vhanku.js","assets/packageChange-Be729-6H.js","assets/page-CvzeJ2sn.js","assets/play-C0BgFkN9.js","assets/post-DnyXBNav.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-C4W6gzqX.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-U-eXIy2k.js","assets/report-Bu7cPT0L.js","assets/rift-lanterns-DLDKmR7R.js","assets/riftLanterns-3hP9L227.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-KSMwcRKT.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-DgvySIHG.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-BC7TW17K.js","assets/store-CcOLxudI.js","assets/store-DGMf4WWx.js","assets/store-DURltZtv.js","assets/store-Dal8OeOf.js","assets/store-zMCZmj8O.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-BIhoOw8y.js","assets/systems-COn9MenQ.js","assets/systems-CrtsvUsC.js","assets/systems-D4hpr5-o.js","assets/talk-BcD-BktM.js","assets/three.module-DD1TOtOx.js","assets/thumb-D2h4Y9pj.js","assets/trystero-CQejBhJ5.js","assets/trystero-DSc98G1d.js","assets/trystero-Ds2VOkuR.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CO8ZGVwg.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-rZY2kO2M.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
