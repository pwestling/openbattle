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
const VERSION = "0a98f87ef75d";
const FILES = ["assets/Board-Cgr36HWy.js","assets/BufferGeometryUtils-Bg58SzpS.js","assets/CommandPanel-BHe_CyY-.js","assets/CommandPanel-Db7Nc4ht.js","assets/CommandPanel-DrHaUMcd.js","assets/Editor-C81CepI1.js","assets/EventSeat-C7Q3lL2_.js","assets/EventsUI-DeH9PPdv.js","assets/FigureLibrary-BALN9eeu.js","assets/GameScreen-BIz-jaV-.js","assets/MailLobby-CWJuccVq.js","assets/Miniatures-CnuaZiJV.js","assets/OpenTables-RD2o3Jvv.js","assets/PhotoMatch-CePZeh_z.js","assets/PlayerCard-xa9bRFKE.js","assets/RankedGame-D0zxZNW0.js","assets/RulesPage-Cs_KBsH0.js","assets/StandeeMaker-D7TvLxH1.js","assets/TeachRule-CfkddJDm.js","assets/Workshop-Dm_P7SFw.js","assets/_virtual_sandbox-worker-Blti5ew3.js","assets/_virtual_soak-worker-D2iVWYOS.js","assets/actions-ClKg5kYc.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/book-DXx4UY1s.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-CZky51Uj.js","assets/core-iW3BDgcj.js","assets/de-BmnMxgo8.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-ke2MD4_1.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-CCQ-qAbX.js","assets/help-C5fVEK00.js","assets/http-CqpIu2z7.js","assets/idb-OWIpJU7O.js","assets/index-CCZwOEzO.js","assets/index-Cx3-Bc6E.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-CT7xpfoT.js","assets/lesson-BHMV7hYA.js","assets/levels-DlkUqTaf.js","assets/local-DjlTH6bV.js","assets/mailbox-BLE-65Gg.js","assets/manifest-BRIPGYy3.js","assets/meshShape-2LJvecKO.js","assets/nostr-d6hV9Dhj.js","assets/pack-BavF4DtC.js","assets/packageChange-Be729-6H.js","assets/page-B6_NAZZw.js","assets/play-DkzTTuM6.js","assets/post-Cyq-yOFs.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-CN9sJkbC.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/replayFile-SMcYtEw-.js","assets/report-BrM8YfXe.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-CbXtAM7H.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-XGo43zfv.js","assets/showcase-Dcyx4k9V.js","assets/site-CHb1xoFU.js","assets/sound-BYXSO4hD.js","assets/standIns-BHeYT5qd.js","assets/store-BoJPKkgN.js","assets/store-BwJES6c6.js","assets/store-DGVx83nt.js","assets/store-DXM7Nb7Y.js","assets/store-pnBdYWL8.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DMOxFqMV.js","assets/talk-v06iMk3U.js","assets/three.module-BnHMTVNq.js","assets/thumb-BzkXACD6.js","assets/trystero-DlgUOiXC.js","assets/trystero-RoIzLOYX.js","assets/trystero-dNljToKp.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-B6VZY6-P.js","assets/worker-CtrB5Iye.js","assets/worker-D6P_BI7N.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
