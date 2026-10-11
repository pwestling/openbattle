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
const VERSION = "65df7957e4a2";
const FILES = ["assets/Board-DS6TsziZ.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BAGCTvf7.js","assets/CommandPanel-CFcSU3XZ.js","assets/CommandPanel-CUS7EEch.js","assets/Editor-BFFAsd4u.js","assets/EventSeat-DY877GbC.js","assets/EventsUI-CfP7Whby.js","assets/FigureLibrary-D7YXd-v2.js","assets/GameScreen-CDbYnoqk.js","assets/MailLobby-DNOh43Sz.js","assets/Miniatures-BDVC6wqk.js","assets/OpenTables-SeQIYM-6.js","assets/PhotoMatch-BMGEAXYI.js","assets/PlayerCard-CkeMKCf2.js","assets/RankedGame-Biy9X_kE.js","assets/RulesPage-DV3okymX.js","assets/StandeeMaker-C4rR_BK2.js","assets/TeachRule-C0_cVpHG.js","assets/Workshop-CjR-EX44.js","assets/_virtual_sandbox-worker-UEAHsTPi.js","assets/_virtual_soak-worker-CrExsVIa.js","assets/actions-BohUhTPb.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/book-CIjonCSV.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-BYG8SHuW.js","assets/de-D0d4S7Tv.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-DFy5l7Im.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-CyXFTkhV.js","assets/help-D89S0JZN.js","assets/http-BkI1tlMN.js","assets/idb-OWIpJU7O.js","assets/index-BH23y70G.css","assets/index-DKuoVZ8C.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-F22XjKHJ.js","assets/lesson-mceCLMbA.js","assets/levels-DlkUqTaf.js","assets/local-C5gthp3L.js","assets/mailbox-BzctpPPp.js","assets/manifest-BRIPGYy3.js","assets/meshShape-DiALib7E.js","assets/nostr-Ce6b2W7g.js","assets/open-Z0phF1iv.js","assets/pack-DI1W_dAr.js","assets/packageChange-Be729-6H.js","assets/page-CajZooA7.js","assets/play-DcUsFjuO.js","assets/post-q0kTTiN0.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-BWsKWfcH.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-CsCX3ywx.js","assets/report-BAjbsNQA.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-yTTATMB8.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-D6zYlz76.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-B0nOAuCI.js","assets/store-CMG9BpgX.js","assets/store-D1v88KfB.js","assets/store-D3_fqb-G.js","assets/store-Uu6b3c65.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-D18BfCBD.js","assets/systems-BuYPco0w.js","assets/systems-Cwv1dFGQ.js","assets/systems-DHekbFhr.js","assets/talk-BlAimcTx.js","assets/three.module-DD1TOtOx.js","assets/thumb-DfRJ0A3o.js","assets/trystero-BR_szQKj.js","assets/trystero-CQejBhJ5.js","assets/trystero-CU9rU_aJ.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-AeyLR6T_.js","assets/worker-Brb6y0jR.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
