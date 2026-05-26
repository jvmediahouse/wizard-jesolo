(function () {
  'use strict';

  if (window.__wizartLoaded) return;
  window.__wizartLoaded = true;

  var WIZARD_ORIGIN = 'https://wizard.jesolo.it';
  var WIZARD_URL = WIZARD_ORIGIN + '/?embed=widget';
  var Z = 2147483000;

  var isOpen = false;
  var isLoaded = false;

  var panel = document.createElement('div');
  panel.id = 'wizart-panel';
  panel.style.cssText =
    'position:fixed;z-index:' + Z + ';display:none;overflow:hidden;' +
    'background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.28);';

  var iframe = document.createElement('iframe');
  iframe.title = 'Wizart - Assistente di viaggio Jesolo';
  iframe.setAttribute('allow', 'geolocation; clipboard-write');
  iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;';
  panel.appendChild(iframe);

  var btn = document.createElement('button');
  btn.id = 'wizart-launcher';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Apri Wizart, assistente di viaggio');
  btn.setAttribute('aria-expanded', 'false');
  btn.style.cssText =
    'position:fixed;bottom:24px;right:24px;z-index:' + (Z + 1) + ';' +
    'width:64px;height:64px;border:0;border-radius:50%;cursor:pointer;' +
    'background:#0a6cff;color:#fff;font-size:28px;line-height:64px;' +
    'box-shadow:0 6px 18px rgba(0,0,0,.32);';
  btn.innerHTML = '&#128172;';

  function isMobile() {
    return window.matchMedia('(max-width: 640px)').matches;
  }

  function sizePanel() {
    var s = panel.style;
    if (isMobile()) {
      s.inset = '0';
      s.width = '100%';
      s.height = '100%';
      s.maxWidth = '100%';
      s.maxHeight = '100%';
      s.borderRadius = '0';
    } else {
      s.inset = 'auto';
      s.bottom = '100px';
      s.right = '24px';
      s.width = '400px';
      s.height = '640px';
      s.maxWidth = 'calc(100vw - 32px)';
      s.maxHeight = 'calc(100vh - 132px)';
      s.borderRadius = '16px';
    }
  }

  function setOpen(next) {
    isOpen = next;

    if (isOpen && !isLoaded) {
      iframe.src = WIZARD_URL;
      isLoaded = true;
    }

    sizePanel();
    panel.style.display = isOpen ? 'block' : 'none';
    btn.innerHTML = isOpen ? '&#10005;' : '&#128172;';
    btn.setAttribute('aria-expanded', String(isOpen));

    document.body.style.overflow = isOpen && isMobile() ? 'hidden' : '';
  }

  btn.addEventListener('click', function () {
    setOpen(!isOpen);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) setOpen(false);
  });

  window.addEventListener('resize', function () {
    if (isOpen) {
      sizePanel();
      document.body.style.overflow = isMobile() ? 'hidden' : '';
    }
  });

  window.addEventListener('message', function (e) {
    if (e.origin !== WIZARD_ORIGIN) return;
    if (e.data && e.data.type === 'wizart:close') setOpen(false);
  });

  function init() {
    document.body.appendChild(panel);
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();