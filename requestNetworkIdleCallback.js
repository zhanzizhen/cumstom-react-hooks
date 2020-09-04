function requestNetworkIdleCallback(callback, timeout = 1200) {
  function freeListener() {
    // eslint-disable-next-line no-use-before-define
    window.removeEventListener('load', windowOnloadListener);
  }
  const timer = setTimeout(() => {
    callback();
    freeListener();
  }, timeout);
  function windowOnloadListener() {
    if (timer) {
      window.clearTimeout(timer);
    }
    callback();
    freeListener();
  }
  window.addEventListener('load', windowOnloadListener);
}
