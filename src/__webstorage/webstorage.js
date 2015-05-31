Harmonized.getWebStorage = function() {
  return Harmonized.webStorage._storage;
}

Harmonized._storage = window.sessionStorage;

Harmonized.webStorage.setStorage: function(storage, doClear) {
  if (doClear) {
    Harmonized._storage.clear();
  }
  switch (storage) {
    case 'session':
      Harmonized._storage = window.sessionStorage;
      break;
    case 'local':
    default:
      Harmonized._storage = window.localStorage;
  }
}
