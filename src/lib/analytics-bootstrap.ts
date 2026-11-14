/** Only public production origins may load GA; local and preview QA stays out. */
export const ANALYTICS_BOOTSTRAP_SCRIPT = `
(function () {
  try {
    if (window.location.protocol !== 'https:' ||
        (window.location.hostname !== 'mdview.kr' && window.location.hostname !== 'www.mdview.kr')) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', 'G-DC9P5XSZXR');
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-DC9P5XSZXR';
    document.head.appendChild(script);
  } catch (_) {
    // Analytics is optional and must not interrupt the editor.
  }
})();
`;
