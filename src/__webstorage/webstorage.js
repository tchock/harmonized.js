Harmonized.getWebStorage = function() {
  return Harmonized.webStorage._webStorage;
}

Harmonized._webStorage = window.sessionStorage;

Harmonized.setWebStorage = function(storage, doClear) {
  if (doClear) {
    Harmonized._webStorage.clear();
  }
  switch (storage) {
    case 'session':
      Harmonized._webStorage = window.sessionStorage;
      break;
    case 'local':
    default:
      Harmonized._webStorage = window.localStorage;
  }
}
