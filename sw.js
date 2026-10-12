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
const VERSION = "88333a36e578";
const FILES = ["assets/Board-8S1A7SRw.js","assets/Branch-BIv4sp0D.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BBiTsTxk.js","assets/CommandPanel-Bg-IpNfF.js","assets/CommandPanel-DTEF6N9a.js","assets/CoreAbilities-B7kF1QzH.js","assets/Editor-CmyOdsFy.js","assets/EventSeat-CGyvF6XY.js","assets/EventsUI-DJdpn_nh.js","assets/FigureLibrary-DWERUvte.js","assets/Game-D80swoeX.js","assets/GameScreen-BRvWzTLZ.js","assets/MailLobby-C8OSMpF9.js","assets/Miniatures-CV_X8v4z.js","assets/NextApp-Cn25UPZn.js","assets/NextApp-DTjdDICv.css","assets/OpenTables-C9MoXdLR.js","assets/Packages-BxJqNjOE.js","assets/PhotoMatch-BLQXM-Dq.js","assets/PlayerCard-BdZDcr1z.js","assets/Qd6Card-Cprg0sgo.js","assets/Qd6Card-EwSLopXH.js","assets/Qd6Card-sMypZk70.js","assets/RankedGame-Bb5lWbWs.js","assets/RoundPanel-B4wMUmcY.js","assets/RoundPanel-CXmrXzMy.js","assets/RoundPanel-DO3CXGdj.js","assets/RulesPage-CO6IHjwc.js","assets/StandeeMaker-DYvsLyaH.js","assets/TeachRule-u3PMkXIn.js","assets/Workshop-DGKXaVqe.js","assets/_virtual_sandbox-worker-ry7Mxznx.js","assets/_virtual_soak-worker-BoVg7CyS.js","assets/actions-CFkUa-wn.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-CDP6CbR9.js","assets/book-Cm6hFfzy.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-ZPBR1pth.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-BNabrLH7.js","assets/de-BGFOjBNP.js","assets/demo-B9Lifkmn.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-CBk4i_c6.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-CWeHMcK5.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-DszzLip9.js","assets/hooks-C-8gFs7a.js","assets/hooks-DRknW2gu.js","assets/hooks-Jt7-T_NK.js","assets/http-r2VkB6Qm.js","assets/idb-OWIpJU7O.js","assets/index-Bj_i7gtB.js","assets/index-Chj8U0ni.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-NGRZzNsU.js","assets/lesson-9KKiQKj2.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-Cs0NmQcm.js","assets/local-DYm8hz2T.js","assets/mailbox-BnuZeWoJ.js","assets/manifest-BRIPGYy3.js","assets/meshShape--BRMpFve.js","assets/nostr-Dj6dP1eB.js","assets/open-DBwIfk4r.js","assets/open-Z0phF1iv.js","assets/pack-BKoTAHRo.js","assets/packPins-BVN_3pnj.js","assets/packageChange-Be729-6H.js","assets/page-YDsK3mvR.js","assets/play-hLfihM8C.js","assets/post-CxU4YYRW.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-DoGirMqW.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-BFjEHj3_.js","assets/report-CRyt5wFW.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-z_PtrmfZ.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-C_uaBOHa.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-DxCkqg_m.js","assets/store-CBiQ0Ssv.js","assets/store-COyS_vCM.js","assets/store-Czi-YF0F.js","assets/store-DhtZuP05.js","assets/store-WoMG6eeh.js","assets/store-jyW9SSz2.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DmKTs4zV.js","assets/systems-30WpRm3u.js","assets/systems-BB-R8UtE.js","assets/systems-Ds0ctNyq.js","assets/talk-C9Fhw8lx.js","assets/three.module-DD1TOtOx.js","assets/thumb-BoDl5h8W.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CgROagU4.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-DYcXlMRB.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
