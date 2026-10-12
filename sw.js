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
const VERSION = "07d822422455";
const FILES = ["assets/Board-Dr_lFWlr.js","assets/Branch-Cb3iVUGA.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BB56wq4J.js","assets/CommandPanel-Blwxr80y.js","assets/CommandPanel-CHCR09Mc.js","assets/CoreAbilities-DBNT8s1K.js","assets/Editor-DSz7Q9f_.js","assets/EventSeat-DyIiGo0R.js","assets/EventsUI-CMGV39WX.js","assets/FigureLibrary-DytTS-Nu.js","assets/Game-CLGQuZk4.js","assets/GameScreen-BFdwWq8D.js","assets/MailLobby-DWEtPk1T.js","assets/Miniatures-CnLcwslp.js","assets/NextApp-B1KBsue7.js","assets/NextApp-DPZ13xtn.css","assets/OpenTables-rZLTspU_.js","assets/Packages-2Rtkak-a.js","assets/PhotoMatch-C7YsdfXP.js","assets/PlayerCard-Ldh-a0XG.js","assets/Qd6Card-B8KbvqQN.js","assets/Qd6Card-C5Z1PNdm.js","assets/Qd6Card-C7ZRNmpV.js","assets/RankedGame-5sZA14a5.js","assets/RoundPanel-CVzNhMhH.js","assets/RoundPanel-D-nDfao0.js","assets/RoundPanel-D48Vg97g.js","assets/RulesPage-bX0yL1i3.js","assets/StandeeMaker-3zuRG-fO.js","assets/TeachRule-p2NPT_tX.js","assets/Workshop-lIio2o6B.js","assets/_virtual_sandbox-worker-D7LJ9lgH.js","assets/_virtual_soak-worker-aDKQDPtT.js","assets/actions-B5kPv5HC.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-Baz3E9tF.js","assets/book-lGjy7g1A.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-zGb_eVwv.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-Zm2d_bIr.js","assets/de-DZCMwF0B.js","assets/demo-eZi2r7Er.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-DQGBohak.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-uPJ7CO6O.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-CJCTDCfz.js","assets/hooks-ClimWhdF.js","assets/hooks-DWnDoMMB.js","assets/hooks-n9bHKLTL.js","assets/http-CLFVi0mT.js","assets/idb-OWIpJU7O.js","assets/index-C2vumWzE.js","assets/index-Chj8U0ni.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-BBFZjlTY.js","assets/lesson-BIQ1-DJL.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-Kr7MZ2nJ.js","assets/local-UPXmGrPt.js","assets/mailbox-BVXOsLn3.js","assets/manifest-BRIPGYy3.js","assets/meshShape-Cc_2ngRD.js","assets/nostr-DOenYKSB.js","assets/open-C-shkupR.js","assets/open-Z0phF1iv.js","assets/pack-DU29J9i8.js","assets/packPins-Cy1kqDX0.js","assets/packageChange-Be729-6H.js","assets/page-BmpnpJSF.js","assets/play-CECulhJh.js","assets/post-ALy4KJV_.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-Ci7s3wno.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-C-4csJw3.js","assets/report-NPdnDBo8.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-DWQR4XZf.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-BaTvmvOI.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-ltyzcRbY.js","assets/store-BOvlrcRV.js","assets/store-BsclSjxe.js","assets/store-DZ_-DWjU.js","assets/store-DitvxWPW.js","assets/store-WRc-mENL.js","assets/store-Z5Ae0gi7.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-DWyKH8OI.js","assets/systems-Bzje4bGn.js","assets/systems-CPXzaWWd.js","assets/systems-VEqr8a6h.js","assets/talk-DayAUVJn.js","assets/three.module-DD1TOtOx.js","assets/thumb-DAM3xKmN.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-BoxoAf21.js","assets/worker-C74YqBQw.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
