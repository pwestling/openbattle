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
const VERSION = "acdb561312d0";
const FILES = ["assets/Board-Dpzz6SP3.js","assets/Branch-CKiJq-F7.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-Dt6FEKLg.js","assets/CommandPanel-NXD4mHGq.js","assets/CommandPanel-gS7Hfc_q.js","assets/CoreAbilities-Dcrm26bb.js","assets/Editor-dL-_cqQk.js","assets/EventSeat-CT-D1U6V.js","assets/EventsUI-wmm4E905.js","assets/FigureLibrary-CSB0oQAj.js","assets/Game-Bc_aO3Bf.js","assets/GameScreen-mNKU6tce.js","assets/MailLobby-DODLJPwV.js","assets/Miniatures-m1KucqlC.js","assets/NextApp-DTjdDICv.css","assets/NextApp-DXhCfkLz.js","assets/OpenTables-cgk2WuYo.js","assets/Packages-rLctOGk4.js","assets/PhotoMatch-CoEj5LBo.js","assets/PlayerCard-D4Qja4Hp.js","assets/Qd6Card-B1ELqhmA.js","assets/Qd6Card-BxOAeXrO.js","assets/Qd6Card-C94IOd96.js","assets/RankedGame-BZYRSufk.js","assets/RoundPanel-C9iUxv-t.js","assets/RoundPanel-DbzxekUz.js","assets/RoundPanel-Z3o3QvNV.js","assets/RulesPage-CO6IHjwc.js","assets/StandeeMaker-CMZ7Wtbo.js","assets/TeachRule-pFpx5cSo.js","assets/Workshop-CXn8yA0S.js","assets/_virtual_sandbox-worker-ry7Mxznx.js","assets/_virtual_soak-worker-CWryl8rV.js","assets/actions-CC52M_NZ.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-Bz4oeTdu.js","assets/book-Cm6hFfzy.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-ZPBR1pth.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-BNabrLH7.js","assets/de-BGFOjBNP.js","assets/demo-G52PT-VO.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-CbODxcH2.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-CWeHMcK5.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-BewzpIgZ.js","assets/hooks-C_mLkQ-x.js","assets/hooks-DYwD22C8.js","assets/hooks-Ke3hA0E6.js","assets/http-r2VkB6Qm.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-Ct21S9Uk.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-NGRZzNsU.js","assets/lesson-K_gAkSAn.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-CNoYbKD_.js","assets/local-DYm8hz2T.js","assets/mailbox-BnuZeWoJ.js","assets/manifest-BRIPGYy3.js","assets/meshShape-DMFy6OZs.js","assets/nostr-Dj6dP1eB.js","assets/open-DghkYoqp.js","assets/open-Z0phF1iv.js","assets/pack-DQWvyUe5.js","assets/packPins-CFA7xDNT.js","assets/packageChange-Be729-6H.js","assets/page-CK-WEAB8.js","assets/play-DSBOgsa5.js","assets/post-CxU4YYRW.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DoGirMqW.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-BZwLtGOr.js","assets/report-B-udvcH6.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-CrN0OL4I.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-l2N2qvEQ.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-CclBSLry.js","assets/store-Brugf9nd.js","assets/store-COyS_vCM.js","assets/store-CSRm54os.js","assets/store-ChE4emSc.js","assets/store-DcuxehvR.js","assets/store-Dsf-Uzxy.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DmKTs4zV.js","assets/systems-C0DFRfHx.js","assets/systems-CMx-rrjA.js","assets/systems-wx3Dg4wV.js","assets/talk-DRPfy_pp.js","assets/three.module-DD1TOtOx.js","assets/thumb-D83Ooofk.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-B0gQfGHg.js","assets/worker-CtrB5Iye.js","assets/worker-D5Gxf3jr.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
