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
const VERSION = "d77597412f63";
const FILES = ["assets/Board-ptT9GkUo.js","assets/Branch-TeTesm3P.js","assets/BufferGeometryUtils-gzGtEl-O.js","assets/CommandPanel-BkimtyXj.js","assets/CommandPanel-D6-LaTUI.js","assets/CommandPanel-lKQ6br6K.js","assets/CoreAbilities-DefjytVz.js","assets/Editor-AVx-EdtH.js","assets/EventSeat-C0oXx8Tp.js","assets/EventsUI-Ba4d9T_c.js","assets/FigureLibrary-DRygcAjG.js","assets/Game-BZxSwCON.js","assets/GameScreen-CE4xHRbN.js","assets/MailLobby-BIQmVBb8.js","assets/Miniatures-DNkyPZ21.js","assets/NextApp-CTlaoKlA.js","assets/NextApp-CZfGknj9.css","assets/OpenTables-D3XkmAGJ.js","assets/Packages-B4QfuE9P.js","assets/PhotoMatch-DckqgU43.js","assets/PlayerCard-DNXN94UX.js","assets/Qd6Card-BvjoiQWh.js","assets/Qd6Card-CDfh3NQ_.js","assets/Qd6Card-wbxgSi6n.js","assets/RankedGame-4YmaNbkM.js","assets/RoundPanel-CZXTChbT.js","assets/RoundPanel-Cp2kIaef.js","assets/RoundPanel-D8mBkEfp.js","assets/RulesLine-CJ1xzf70.js","assets/RulesPage-CGBDMCQa.js","assets/StandeeMaker-DmVpfpmV.js","assets/TeachRule-BsE_c6Xs.js","assets/Workshop-fhRwa37g.js","assets/_virtual_sandbox-worker-DoamPsyV.js","assets/_virtual_soak-worker-CXDalT9r.js","assets/actions-D_LaOYXY.js","assets/aws4fetch.esm-BLUAl4pF.js","assets/base64-gMTPUZJI.js","assets/board-DopUeAoE.js","assets/book-DYCu27S5.js","assets/brinewatch-DN2-OwGh.js","assets/browser-UgmTalj_.js","assets/browser-bopAeLbn.js","assets/charge-On0KE6tM.js","assets/codec-DOoWeNvh.js","assets/config-Kg6xkhHB.js","assets/core-DxEZ4pmh.js","assets/de-ClFB1Kuy.js","assets/demo-QPla9FIy.js","assets/dist-WFp3Oeug.js","assets/dist-YYVtoirG.js","assets/dist-lgRNSFRF.js","assets/events-9ce18a08.esm-D-QCksbz.js","assets/faction-C2C20c43.js","assets/file-qvOJhGA3.js","assets/files-CdfAAl3C.js","assets/flag-BdoWxvDG.js","assets/fr-CQymJ6ET.js","assets/fxp-CNHNYw_7.js","assets/fxp-DcRaohTd.js","assets/gameLog-2ucT3GII.js","assets/hooks-B0B_-5l3.js","assets/hooks-CJ-lwyVn.js","assets/hooks-DALjLEw4.js","assets/http-CqajBd1K.js","assets/idb-OWIpJU7O.js","assets/index-B2lY3PDD.js","assets/index-Chj8U0ni.css","assets/jsx-runtime-NZYk81nU.js","assets/keys-D-MKR9PG.js","assets/layout-D4agNPR0.js","assets/lesson-BfXWqToh.js","assets/levels-DlkUqTaf.js","assets/live-DtZovmg1.js","assets/local-CRjuXAGv.js","assets/mailbox-CdcofEUe.js","assets/manifest-BRIPGYy3.js","assets/meshShape-Bgs4VJK8.js","assets/nostr-C36r-rTV.js","assets/open-Da4Jq36j.js","assets/open-Z0phF1iv.js","assets/pack-E__zRhuU.js","assets/packPins-B4YDIIwt.js","assets/packageChange-Be729-6H.js","assets/page-D7bR2fF0.js","assets/play-Doqmzeh0.js","assets/post-EhjWbJEO.js","assets/preload-helper-BaNbYf_w.js","assets/printPlay-D3MnKk11.js","assets/react-Bu-9VsiK.js","assets/react-Cvdyeg_0.js","assets/react-LRsbgCie.js","assets/react-dom-B-VxWsjA.js","assets/react-hsrUxga6.js","assets/relayBusy-DoHBJB33.js","assets/replayFile-Ca5pVQkJ.js","assets/report-c08htRRO.js","assets/rift-lanterns-DLDKmR7R.js","assets/rolldown-runtime-hePW80VL.js","assets/roster-CVZButfQ.js","assets/route-D6S5xLiX.js","assets/rulebook-DYk1I3nk.js","assets/scheduler-C784v2VA.js","assets/secp256k1-yVjC_Axf.js","assets/shelfActions-vGrWhCtx.js","assets/showcase-BVyZ9Omh.js","assets/site-CHb1xoFU.js","assets/standIns-BTEgtfF8.js","assets/store-CbIyIvb7.js","assets/store-CnqSGv0J.js","assets/store-CvrnFJUn.js","assets/store-ZhAsWth1.js","assets/store-cES1Hc3a.js","assets/store-sIqolyuQ.js","assets/syntax-CEL_Wvla.js","assets/systemLabels-C2WcHBMM.js","assets/systems-CYBrDTI7.js","assets/systems-CwdknGrU.js","assets/systems-DPNoaVr8.js","assets/talk-DL7-fOgK.js","assets/three.module-DD1TOtOx.js","assets/thumb-CQILe3JB.js","assets/trystero-CQejBhJ5.js","assets/trystero-LIsX6Feh.js","assets/webtorrent.min-DeIqevk6.js","assets/worker-CURFNhGr.js","assets/worker-CtrB5Iye.js","assets/worker-DV1DuzPc.js","assets/worker-tH7-eYm-.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest"];
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
