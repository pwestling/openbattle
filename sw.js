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
const VERSION = "67f2dc839b66";
const FILES = ["assets/Board-2QUKi0uL.js","assets/Branch-BRIQzNli.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BcnAJQFA.js","assets/CommandPanel-CNBJpCLi.js","assets/CommandPanel-DNzKzbAG.js","assets/Editor-PngaaZTY.js","assets/EventSeat-ld5Qoaqp.js","assets/EventsUI-Mr5XoFPJ.js","assets/FigureLibrary-bTj1UAgM.js","assets/Game-BiIYqfuy.js","assets/GameScreen-D481Ngm8.js","assets/MailLobby-KUhnDQS6.js","assets/Miniatures-COzgOlYT.js","assets/NextApp-CQYA7wV4.js","assets/NextApp-CrJzQitl.css","assets/OpenTables-BCBCWLKT.js","assets/PhotoMatch-IyeNzCzG.js","assets/PlayerCard-WkKUFznQ.js","assets/RankedGame-CGPK0VbV.js","assets/RulesPage-BgtTHFJg.js","assets/StandeeMaker-Cz6PNR5h.js","assets/TeachRule-eBxLhWfz.js","assets/Workshop-BKbHtMDE.js","assets/_virtual_sandbox-worker-UEAHsTPi.js","assets/_virtual_soak-worker-YEsIrYrb.js","assets/actions-ZiSMmsAX.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-Bki-UrJi.js","assets/book-pN_rtvA9.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-B5yVLbZX.js","assets/de-C9XBhQA2.js","assets/demo-Df2-V2-X.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-Bs5sM_P7.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-ChXPnpZF.js","assets/help-CFwVhQK6.js","assets/http-WnkSsj-D.js","assets/idb-OWIpJU7O.js","assets/index-BBGq02eL.js","assets/index-BH23y70G.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-Yhl9PMTN.js","assets/lesson-Bd3AJ-s7.js","assets/levels-DlkUqTaf.js","assets/live-FRhIRkzh.js","assets/local-Bxt8AJ_b.js","assets/mailbox-BeSqVNhv.js","assets/manifest-BRIPGYy3.js","assets/meshShape-DVGiu50S.js","assets/nostr-DJw4NK2y.js","assets/open-Bh9XCnv-.js","assets/open-Z0phF1iv.js","assets/pack-B6s4-NBz.js","assets/packageChange-Be729-6H.js","assets/page-Dbhq5yET.js","assets/play-BZU0gLl6.js","assets/post-BdXfUz80.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-CMPal0fu.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-Dw6Tjj8G.js","assets/report-Z5kzGyJd.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-CvX0yJ7k.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-BXbwaQm_.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-8isQPUjT.js","assets/store-BBx5aV7Z.js","assets/store-C2EzPBij.js","assets/store-C3p9Tw6B.js","assets/store-CErayT2o.js","assets/store-FLkgCmMw.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-C4UeaUqA.js","assets/systems-CMNsBteX.js","assets/systems-CTIUyT0C.js","assets/systems-GB4Y0ZN-.js","assets/talk-IF7KIdTc.js","assets/three.module-DD1TOtOx.js","assets/thumb-HEu5FIne.js","assets/trystero-BBuDSxly.js","assets/trystero-CQejBhJ5.js","assets/trystero-TmAL2uTa.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CtrB5Iye.js","assets/worker-DM8w8uRe.js","assets/worker-DV1DuzPc.js","assets/worker-djFPtOdI.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
