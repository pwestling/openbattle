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
const VERSION = "b3a14b95a0a6";
const FILES = ["assets/Board-B1cNNY4K.js","assets/Branch-BUFHHJtr.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-B41-AwCT.js","assets/CommandPanel-BLSbghKS.js","assets/CommandPanel-CC4J5Tk6.js","assets/CoreAbilities-DXXIvTlr.js","assets/Editor-CeFV4u9j.js","assets/EventSeat-BmamE9LZ.js","assets/EventsUI-CtQGWSCl.js","assets/FigureLibrary-Bh97eHOg.js","assets/Game-Cn4NiED8.js","assets/GameScreen-BPX7kTpT.js","assets/MailLobby-DoC3Vqri.js","assets/Miniatures-6phni4n5.js","assets/NextApp-C6C3HxyA.css","assets/NextApp-fhW_McIn.js","assets/OpenTables-DB5idv-2.js","assets/Packages-C0iYME5N.js","assets/PhotoMatch-BXyPu8ou.js","assets/PlayerCard-Qbs9VWJu.js","assets/Qd6Card-Ct6KaZ33.js","assets/Qd6Card-D-qawO0g.js","assets/Qd6Card-DvLKjHrY.js","assets/RankedGame-C9b_Iqmu.js","assets/RoundPanel-BsOqvcmA.js","assets/RoundPanel-DDX6XROK.js","assets/RoundPanel-yXRUiXsz.js","assets/RulesPage-97MSo5sY.js","assets/StandeeMaker-DaiWnIED.js","assets/TeachRule-DR2xuq4h.js","assets/Workshop-D7rxbERT.js","assets/_virtual_sandbox-worker-D7LJ9lgH.js","assets/_virtual_soak-worker-BQUcvCPi.js","assets/actions-C1d32crT.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-CLl8Wi53.js","assets/book-BFQBEwWU.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-C5lADlel.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-TAh7tNY5.js","assets/de-Chd7Tl-0.js","assets/demo-DkwxHJwM.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-hhv9cr49.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/fr-BtCICrA1.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-BE7T3zgd.js","assets/hooks-BlFoXjxC.js","assets/hooks-kLDeBuWc.js","assets/hooks-wTaNXGES.js","assets/http-DXBhDLDH.js","assets/idb-OWIpJU7O.js","assets/index-Chj8U0ni.css","assets/index-DKupxyN5.js","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-BJZ0_pUA.js","assets/lesson-CDrK4BKl.js","assets/levels-DlkUqTaf.js","assets/lit-n-Yt9ZNS.js","assets/live-DMNcYbkC.js","assets/local-GsUdvVFa.js","assets/mailbox-CnjjhzeY.js","assets/manifest-BRIPGYy3.js","assets/meshShape-Cie0Z0qo.js","assets/nostr-JhobV8o-.js","assets/open-FouIws2v.js","assets/open-Z0phF1iv.js","assets/pack-CHk5INBh.js","assets/packPins-E75wUZjO.js","assets/packageChange-Be729-6H.js","assets/page-ButX892j.js","assets/play-DR22qKfZ.js","assets/post-DyHHGBkS.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-CSRPq7jj.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-BAdE_1Ct.js","assets/report-Dhj9F5Ti.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-kDU887ST.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-BEEceZZS.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/start-f1ly9ZTE.js","assets/store-CRLQg8rd.js","assets/store-Cc1MLJga.js","assets/store-CiMIV5B8.js","assets/store-D2RYGWLq.js","assets/store-DmgVFQ3u.js","assets/store-jmyE-ZRX.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-C5pv3gzx.js","assets/systems-BVfi2QQW.js","assets/systems-BzGOQfTl.js","assets/systems-DfZmatw5.js","assets/talk-Dwf9gGGy.js","assets/three.module-DD1TOtOx.js","assets/thumb-CW3LcVBt.js","assets/trystero-B7o7vSAK.js","assets/trystero-DUAGCRo6.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CJhSso-o.js","assets/worker-CtrB5Iye.js","assets/worker-DDJFnka6.js","assets/worker-DV1DuzPc.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
