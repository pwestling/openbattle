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
const VERSION = "eed24b16e75b";
const FILES = ["assets/Board-CAtulTM-.js","assets/Branch-BlHCjp5Q.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-_UsW7INZ.js","assets/CommandPanel-a4kp7dJO.js","assets/CommandPanel-di6dc7Z6.js","assets/CoreAbilities-BuZqItav.js","assets/Editor-LMTV09io.js","assets/EventSeat-DoDDEIv8.js","assets/EventsUI-Du8AJJJ7.js","assets/FigureLibrary-_vk5EPd8.js","assets/Game-CdW_tbd7.js","assets/GameScreen-Bu7sZ189.js","assets/MailLobby-B9qQj3er.js","assets/Miniatures-BR5QGOm3.js","assets/NextApp-DPZ13xtn.css","assets/NextApp-Dl3MEKDh.js","assets/OpenTables-Cd5fapZa.js","assets/Packages-C9O1pOCf.js","assets/PhotoMatch-C7QoNRnw.js","assets/PlayerCard-C2JsIfdm.js","assets/Qd6Card-BFwuEmP5.js","assets/Qd6Card-BHmszf46.js","assets/Qd6Card-CbhY-p3Q.js","assets/RankedGame-n5vhBbUp.js","assets/RoundPanel-Cj7aPpFC.js","assets/RoundPanel-DE-nqfwt.js","assets/RoundPanel-Da0laRl5.js","assets/RulesPage-bX0yL1i3.js","assets/StandeeMaker-CeJWFVgj.js","assets/TeachRule-rAbwqqK6.js","assets/Workshop-CnEaHLRu.js","assets/_virtual_sandbox-worker-D7LJ9lgH.js","assets/_virtual_soak-worker-DXTc5ty4.js","assets/actions-P-Lv79f2.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-DOM0JjBM.js","assets/book-lGjy7g1A.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-zGb_eVwv.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-Zm2d_bIr.js","assets/de-DZCMwF0B.js","assets/demo-CrL5-eW7.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-DDjvlyJw.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-uPJ7CO6O.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-DOVsPYq0.js","assets/hooks-BoyeHkxT.js","assets/hooks-CkRZpgpe.js","assets/hooks-Cw0WyrDD.js","assets/http-CLFVi0mT.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-v6MQ0wu3.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-BBFZjlTY.js","assets/lesson-Z9Jm64Al.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-ia3g_vsH.js","assets/local-UPXmGrPt.js","assets/mailbox-BVXOsLn3.js","assets/manifest-BRIPGYy3.js","assets/meshShape-8u2CYyxe.js","assets/nostr-DOenYKSB.js","assets/open-Dgc9qKQZ.js","assets/open-Z0phF1iv.js","assets/pack-ByUPTwa8.js","assets/packPins-WQTCdrBz.js","assets/packageChange-Be729-6H.js","assets/page-CFH7qxn6.js","assets/play-CT9ih0mq.js","assets/post-ALy4KJV_.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-Ci7s3wno.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-BTueLt9u.js","assets/report-DbeTAkBR.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-C6oyDDVu.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-CrTGcgzl.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-BmZwNxLJ.js","assets/store-BGql9U_3.js","assets/store-BebdTUfu.js","assets/store-BsclSjxe.js","assets/store-C-jWI3Yu.js","assets/store-DoFU3x46.js","assets/store-lhy9ZTc4.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DWyKH8OI.js","assets/systems-CDf2caVN.js","assets/systems-D8lGsIiJ.js","assets/systems-ZYLeDOP9.js","assets/talk-DmVDZSba.js","assets/three.module-DD1TOtOx.js","assets/thumb-CN0PZGRK.js","assets/trystero-B7o7vSAK.js","assets/trystero-DUAGCRo6.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-C3R-dDuf.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-oiV9R69P.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
