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
const VERSION = "e79e5e013978";
const FILES = ["assets/Board-BwAsiHQk.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BLvDrUW1.js","assets/CommandPanel-Cm6pZoN1.js","assets/CommandPanel-g_zbiqk5.js","assets/Editor-x4q3HtiU.js","assets/EventSeat-ChUs0rAd.js","assets/EventsUI-B1uKJxLK.js","assets/FigureLibrary-B9nv0Zk4.js","assets/GameScreen-BzoEqpjh.js","assets/MailLobby-BdqbZUb1.js","assets/Miniatures-B2tpi_fk.js","assets/OpenTables-DQrrCaOA.js","assets/PhotoMatch-Bfk53Ty1.js","assets/PlayerCard-y66zwaAR.js","assets/RankedGame-BR35YB25.js","assets/RulesPage-D4LMJxwy.js","assets/StandeeMaker-Bf-GCUPq.js","assets/TeachRule-UntUo55M.js","assets/Workshop-YSeOZMOH.js","assets/_virtual_sandbox-worker-UEAHsTPi.js","assets/_virtual_soak-worker-DfVPZbCG.js","assets/actions-CO8Vl52y.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/book-Dm6DfwYE.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-BCpOvlTV.js","assets/de-CfJuTQOX.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-BBe_5PVn.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-dUj9BN-x.js","assets/help-L-qXGMat.js","assets/http-5byn-Ucq.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-CHiFxFHo.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-DsEURAxH.js","assets/lesson-BaC2G3IL.js","assets/levels-DlkUqTaf.js","assets/local-CD-gFMI8.js","assets/mailbox-Bat4zbng.js","assets/manifest-BRIPGYy3.js","assets/meshShape-BBT-FvSA.js","assets/nostr-3hr_3JiF.js","assets/open-Z0phF1iv.js","assets/pack-4_kTJoxC.js","assets/packageChange-Be729-6H.js","assets/page-DkNr6sa3.js","assets/play-DosvBJT0.js","assets/post-Fm_M8j26.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-CV1-idau.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-Xjvd2kH1.js","assets/report-Cy7UXaKK.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-CYLEihVl.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-DJerb7k0.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-C3IiEKho.js","assets/store-DGT1zmZv.js","assets/store-DKYWaTB4.js","assets/store-DecJ575j.js","assets/store-g5pLD6f9.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-Cj5FMnI_.js","assets/systems-C_s04CDT.js","assets/systems-DuGzYL1A.js","assets/systems-fl6tJPvG.js","assets/talk-zfRciCxw.js","assets/three.module-DD1TOtOx.js","assets/thumb-DN7gMyIz.js","assets/trystero-B_nm-6-Q.js","assets/trystero-CQejBhJ5.js","assets/trystero-K8I69Lyn.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CtrB5Iye.js","assets/worker-DCFI3LTd.js","assets/worker-DV1DuzPc.js","assets/worker-Dr_eySwd.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
