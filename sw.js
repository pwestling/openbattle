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
const VERSION = "b018a9322f5b";
const FILES = ["assets/Board-CMqW8m5c.js","assets/BufferGeometryUtils-Bg58SzpS.js","assets/CommandPanel-DQn5TbNM.js","assets/CommandPanel-DUJM39Vw.js","assets/CommandPanel-DyPCS010.js","assets/Editor-Sl4rUqVv.js","assets/EventSeat-B3C-JOHR.js","assets/EventsUI-CsnjEehf.js","assets/FigureLibrary-BqD6mm2I.js","assets/GameScreen-Dr-1DJ8y.js","assets/MailLobby-Bh5rl5jm.js","assets/Miniatures-xwxbBLaW.js","assets/OpenTables-C6NhScSj.js","assets/PhotoMatch-ByqzqGi0.js","assets/PlayerCard-BM0f_EIm.js","assets/RankedGame-DaddbC2V.js","assets/RulesPage-BnLZ5qf0.js","assets/StandeeMaker-yKDYmK98.js","assets/TeachRule-C1uc9TE4.js","assets/Workshop-gkgTH30E.js","assets/_virtual_sandbox-worker-DZrZC7mp.js","assets/_virtual_soak-worker-BuUtwXtH.js","assets/actions-C3Y-ozrO.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/book-aAZJxRWS.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-Bu55ISeg.js","assets/de-Bs4bPsQv.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-D-57snIO.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-B5AlYdw1.js","assets/help-C3bEmeS3.js","assets/http-Brnya0vg.js","assets/idb-OWIpJU7O.js","assets/index-BdAcwlFE.js","assets/index-Cx3-Bc6E.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-PZ8HML1A.js","assets/lesson-BGNlQIY6.js","assets/levels-DlkUqTaf.js","assets/local-C4AOGCk7.js","assets/mailbox-BZyGTxWy.js","assets/manifest-BRIPGYy3.js","assets/meshShape-7qMI0-w-.js","assets/nostr-MBv0Pqp9.js","assets/pack-CG_--xAD.js","assets/packageChange-Be729-6H.js","assets/page-RNREUEx3.js","assets/play-CbTzfHWA.js","assets/post-Cg8nAFPS.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-C7JaMoyz.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-DK24mGMD.js","assets/report-BWpYJ7G1.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-BEra3Caz.js","assets/showcase-Dcyx4k9V.js","assets/site-CHb1xoFU.js","assets/sound-BYXSO4hD.js","assets/standIns-BHeYT5qd.js","assets/store-BF4ggFWX.js","assets/store-BP15Hv55.js","assets/store-Bw6hFsE_.js","assets/store-C1lOHA6Z.js","assets/store-MX8OUBj7.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-D1tuUioX.js","assets/systems-CLqcPUtY.js","assets/systems-DB2bRTbN.js","assets/systems-ZcY_SYhy.js","assets/talk-BPUIDe-x.js","assets/three.module-BnHMTVNq.js","assets/thumb-B2J-r4vf.js","assets/trystero-CQejBhJ5.js","assets/trystero-DC4zvJPx.js","assets/trystero-Dm7MLccE.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CtrB5Iye.js","assets/worker-D6kHpXKt.js","assets/worker-DV1DuzPc.js","assets/worker-cqH4nUyc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
