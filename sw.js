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
const VERSION = "a9f0255c159f";
const FILES = ["assets/Board-Bvaicl1b.js","assets/Branch-CHP6Lz3B.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-CU-wbC28.js","assets/CommandPanel-CtG98gJN.js","assets/CommandPanel-lwqGh6jH.js","assets/Editor-DgZYXUQr.js","assets/EventSeat-huzTbKZ4.js","assets/EventsUI-sADvh7so.js","assets/FigureLibrary-BZgyv1mM.js","assets/Game-BkdY1-tW.js","assets/GameScreen-DzP2mgmx.js","assets/MailLobby-B6hMWHxG.js","assets/Miniatures-BjKYXW27.js","assets/NextApp-C9_8wmBs.js","assets/NextApp-CZfGknj9.css","assets/OpenTables-DL4P3dEy.js","assets/PhotoMatch-7dJazEko.js","assets/PlayerCard-g2p62M_g.js","assets/RankedGame-Dl9vMFzQ.js","assets/RulesPage-DZ1Og_Kw.js","assets/StandeeMaker-C6oelpQz.js","assets/TeachRule-DAK3NauM.js","assets/Workshop-LngvfOPZ.js","assets/_virtual_sandbox-worker-CUfTD_8X.js","assets/_virtual_soak-worker-CZC4ZzSM.js","assets/actions-f6M-ino3.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-B9Br7HTR.js","assets/book-DWCwoWcO.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-BtS6nUvA.js","assets/de-CqqE4-5s.js","assets/demo-vntDF8cI.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-CYxsVCQL.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-dDsFYJF6.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-C2j6BH1E.js","assets/help-D8JXmVtS.js","assets/hooks-UPf6LzLh.js","assets/http-D2eGv2lp.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-BNsSks8L.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-B2bFMXl6.js","assets/lesson-C5XBTsLo.js","assets/levels-DlkUqTaf.js","assets/live-BoDtZBal.js","assets/local-IEIhpOwt.js","assets/mailbox-D9Nwwt3a.js","assets/manifest-BRIPGYy3.js","assets/meshShape-Ba_77jXe.js","assets/nostr-BHE-ELBg.js","assets/open-B-D-nYq4.js","assets/open-Z0phF1iv.js","assets/pack-DygTzFVN.js","assets/packPins-BaTWTqJI.js","assets/packageChange-Be729-6H.js","assets/page-CpOth9wK.js","assets/play-COAOVT2m.js","assets/post-C7MKyDps.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-ZqR9W-IQ.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-B8OKOczd.js","assets/report-CvNpOmST.js","assets/rift-lanterns-DLDKmR7R.js","assets/riftLanterns-Dcro_1Sg.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-CuFn7GWg.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-CXI3PSAe.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-B5wtZd5P.js","assets/store-BN0WsYz7.js","assets/store-Bug_603W.js","assets/store-C-3Ltmhx.js","assets/store-DbxElnM4.js","assets/store-DehRoaeu.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-BWmld0OF.js","assets/systems-BA2_ufRL.js","assets/systems-CSeW1lRt.js","assets/systems-DwFDl5p-.js","assets/talk-DuHY5pSG.js","assets/three.module-DD1TOtOx.js","assets/thumb-cabNWgzc.js","assets/trystero-BJMb1Aqz.js","assets/trystero-CQejBhJ5.js","assets/trystero-qudv52YU.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-DXx_cGjs.js","assets/worker-De9JBlLM.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
