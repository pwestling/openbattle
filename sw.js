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
const VERSION = "631b19cfb1fd";
const FILES = ["assets/Board-D2-I1Q8N.js","assets/Branch-Os8lD3d0.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-CWseJkhl.js","assets/CommandPanel-D1TvLlMx.js","assets/CommandPanel-Dq0o2EgI.js","assets/Editor-CFDhh3-Y.js","assets/EventSeat-1bgw4cuI.js","assets/EventsUI-CA6oCAM5.js","assets/FigureLibrary-CpiXTzfU.js","assets/Game-K_9GcUL2.js","assets/GameScreen-CdrILo3K.js","assets/MailLobby-CinbOxpk.js","assets/Miniatures-Cer2nD_h.js","assets/NextApp-CTSOI19d.css","assets/NextApp-yZx96Dgs.js","assets/OpenTables-CA-4wP6I.js","assets/PhotoMatch-BJJRwHk2.js","assets/PlayerCard-DgYdlWye.js","assets/RankedGame-D-FFmrI7.js","assets/RulesPage-i_sbyqoQ.js","assets/StandeeMaker-BGlFR5Z0.js","assets/TeachRule-DijjrsJ2.js","assets/Workshop-BP1jPveL.js","assets/_virtual_sandbox-worker-j1GY8IxU.js","assets/_virtual_soak-worker-DRNTYpCp.js","assets/actions-Pkyw0p-f.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-CiEi2ZXv.js","assets/book-K4lsAka5.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-BR5kavTj.js","assets/de-C3kUiwD1.js","assets/demo-eD1YHumI.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-B50SiQ76.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-D4NyJHBn.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-B3cSIe-c.js","assets/help-C3u348ny.js","assets/hooks-DZD3Pt9N.js","assets/http-CKQrLgDx.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-CW3PyPbK.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-C-ot52J5.js","assets/lesson-QerpKpWu.js","assets/levels-DlkUqTaf.js","assets/live-Bp-mqdkM.js","assets/local-BzHS1RJF.js","assets/mailbox-283anMl3.js","assets/manifest-BRIPGYy3.js","assets/meshShape-DgLdd9tk.js","assets/nostr-Bxfl5nTq.js","assets/open-D5VvzIFd.js","assets/open-Z0phF1iv.js","assets/pack-DzyX4qT0.js","assets/packPins-Bs26ItQV.js","assets/packageChange-Be729-6H.js","assets/page-DPlF4taL.js","assets/play-BHlgQt9e.js","assets/post-Cpxkg1p7.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-D7NgH7WV.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-DsOTo4eE.js","assets/report-DtEsgULu.js","assets/rift-lanterns-DLDKmR7R.js","assets/riftLanterns-BRWGoCnG.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-CQZA2gPi.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-DvGKSl-y.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-BDGeP3ru.js","assets/store-BXxKKt64.js","assets/store-CQ3ZKiFg.js","assets/store-DNy0J-Ij.js","assets/store-DPq0JJ1K.js","assets/store-DwstOo91.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-CuBbyDXT.js","assets/systems-B1CH_LmR.js","assets/systems-CWd6dtgc.js","assets/systems-D7R2xnWC.js","assets/talk-B5TBHRvV.js","assets/three.module-DD1TOtOx.js","assets/thumb-B1Iz1eZH.js","assets/trystero--NEKf2mj.js","assets/trystero-CQejBhJ5.js","assets/trystero-Da9aT2eD.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BchH2Dny.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-VyKh4xL-.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
