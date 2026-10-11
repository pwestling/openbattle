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
const VERSION = "c14136da5c06";
const FILES = ["assets/Board-DNY0IryK.js","assets/BufferGeometryUtils-Bg58SzpS.js","assets/CommandPanel-DzC9vgg7.js","assets/CommandPanel-gGPZWnft.js","assets/CommandPanel-ieIA98qM.js","assets/Editor-DDjq5LSZ.js","assets/EventSeat-BCVqQUJh.js","assets/EventsUI-CnLfVOJI.js","assets/FigureLibrary-Bsh6EVC8.js","assets/GameScreen-DSxusukB.js","assets/MailLobby-DqXLDtVD.js","assets/Miniatures-CtL3512y.js","assets/OpenTables-DQPsRugA.js","assets/PhotoMatch-DxO9CC-w.js","assets/PlayerCard-DfnzR5FT.js","assets/RankedGame-p1sHxWCt.js","assets/RulesPage-DKukFZti.js","assets/StandeeMaker-B8ti5Bbd.js","assets/TeachRule-Blx7ZEDZ.js","assets/Workshop-BZVR7uDj.js","assets/_virtual_sandbox-worker-Blti5ew3.js","assets/_virtual_soak-worker-BGiKZyFh.js","assets/actions-CqE9K0JP.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/book-BfQMdPT_.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/codec-DOoWeNvh.js","assets/config-CZky51Uj.js","assets/core-DT51JL1G.js","assets/de-BUEDaB_e.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-mOwva_j5.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-CPloDcbz.js","assets/help-hlPQfuF8.js","assets/http-BdEjBO3t.js","assets/idb-OWIpJU7O.js","assets/index-BZ5hGS9u.js","assets/index-Cx3-Bc6E.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-DTmruAj0.js","assets/lesson-4ErhD_4E.js","assets/levels-DlkUqTaf.js","assets/local-CCwCYkMh.js","assets/mailbox-DWPBUC8y.js","assets/manifest-BRIPGYy3.js","assets/meshShape-iViWsMuG.js","assets/nostr-Dy13PyYN.js","assets/pack-Y-dy94p4.js","assets/packageChange-Be729-6H.js","assets/page-CMc0BTt8.js","assets/play-kGd17l6M.js","assets/post-BcbP5JGY.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-5XeQ_X8Q.js","assets/react-B7jgbFkM.js","assets/react-Cvdyeg_0.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-e02sf_X4.js","assets/report-Ud0EAEEI.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-DV7qJ9U8.js","assets/showcase-Dcyx4k9V.js","assets/site-CHb1xoFU.js","assets/sound-BYXSO4hD.js","assets/standIns-BHeYT5qd.js","assets/store-C7iD1ABd.js","assets/store-CxtkwKOH.js","assets/store-DTxdjZ5j.js","assets/store-DxtJjO3R.js","assets/store-f8jDsnZO.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-C0U4zDJA.js","assets/talk-BFO7GA_j.js","assets/three.module-BnHMTVNq.js","assets/thumb-vKcOUlJY.js","assets/trystero-BLzX2jMM.js","assets/trystero-DtdJAzGi.js","assets/trystero-VRiYNYSe.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BDc1Rvp2.js","assets/worker-BSX9oXg6.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
