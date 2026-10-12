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
const VERSION = "7894434d8e05";
const FILES = ["assets/Board-1W2DfXIf.js","assets/Branch-CrY9nWcP.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-DJMEzuQ0.js","assets/CommandPanel-DxrjSgA8.js","assets/CommandPanel-p2vbT_J0.js","assets/CoreAbilities-CHw7_tb4.js","assets/Editor-CX_HaEfR.js","assets/EventSeat-UXEHGQ9O.js","assets/EventsUI-Q5CW_CCs.js","assets/FigureLibrary-C4Njf-AQ.js","assets/Game-DGv8EtHS.js","assets/GameScreen-BvUIOnlv.js","assets/MailLobby-B21qYEen.js","assets/Miniatures-D8YPb1T9.js","assets/NextApp-D0FbUQEw.js","assets/NextApp-DPZ13xtn.css","assets/OpenTables-DwfAN2Lz.js","assets/Packages-BBFXU0tx.js","assets/PhotoMatch-B8fk1ARS.js","assets/PlayerCard-CQENNUgw.js","assets/Qd6Card-BVCHMgzW.js","assets/Qd6Card-BljsDkTm.js","assets/Qd6Card-pQ1ig9bz.js","assets/RankedGame-BI1wOx4g.js","assets/RoundPanel-CZ4TQeyI.js","assets/RoundPanel-DPqwpX-1.js","assets/RoundPanel-Dl-DpX2I.js","assets/RulesPage-A0tRDs7v.js","assets/StandeeMaker-rId9g-Ds.js","assets/TeachRule-BBfzuSlX.js","assets/Workshop-BTTx_OE5.js","assets/_virtual_sandbox-worker-D7LJ9lgH.js","assets/_virtual_soak-worker-DNwYCEjW.js","assets/actions-BgtjT1fs.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-B3J1aK0G.js","assets/book-Dt4J0nKW.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-DGrwlF71.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-GVPXaUcM.js","assets/de-PAEle7M9.js","assets/demo-Qdi35gZa.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-Dw48JIcA.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-CJINxtY9.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-DhjWC10G.js","assets/hooks-B0Xt2EIQ.js","assets/hooks-C1b2QAwX.js","assets/hooks-Dhddmu8M.js","assets/http-LAbkLL-L.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-CrwIWTHn.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-Cg4f5pUA.js","assets/lesson-BR6u-MzH.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-cOcKfaei.js","assets/local-Bts8yl_w.js","assets/mailbox-BB2mzOXv.js","assets/manifest-BRIPGYy3.js","assets/meshShape-Q6_b-UQu.js","assets/nostr-DvANsETV.js","assets/open-DxdxGQ9C.js","assets/open-Z0phF1iv.js","assets/pack-CAP8vnuC.js","assets/packPins-B1V0IZ0J.js","assets/packageChange-Be729-6H.js","assets/page-D5sBOS8n.js","assets/play-BBjwiRfV.js","assets/post-CooCB3kg.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-BuStS_-1.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-xcnonQ0s.js","assets/report-BEnoznho.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-C1Rh83lB.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-Ci4SGJ62.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-C-3OQLnH.js","assets/store-4gd5Wiw7.js","assets/store-BAqT-Lgj.js","assets/store-BjPJXOcI.js","assets/store-C9b-6REx.js","assets/store-DIBikW7-.js","assets/store-DYmk0JIb.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-CjtShfXk.js","assets/systems-B0ehVK9_.js","assets/systems-CPPVEuWr.js","assets/systems-D9Jd5NJv.js","assets/talk-CHFi6frw.js","assets/three.module-DD1TOtOx.js","assets/thumb-DZ6O43NU.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CT1MryIE.js","assets/worker-CtrB5Iye.js","assets/worker-DHIYe7Gp.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
