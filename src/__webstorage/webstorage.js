Harmonized.getWebStorage = function() {
  return Harmonized._webStorage;
}

/* istanbul ignore next */
Harmonized._getLocalStorage = function() {
  return window.localStorage;
}

/* istanbul ignore next */
Harmonized._getSessionStorage = function() {
  return window.sessionStorage;
}

Harmonized._webStorage = Harmonized._getSessionStorage();

Harmonized.setWebStorage = function(storage, doClear) {
  if (doClear) {
    Harmonized._webStorage.clear();
  }
  switch (storage) {
    case 'session':
      Harmonized._webStorage = Harmonized._getSessionStorage();
      break;
    case 'local':
    default:
      Harmonized._webStorage = Harmonized._getLocalStorage();
  }
}
