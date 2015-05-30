var webStorage = {
  _storage: window.localStorage,
  setStorage: function(storage, doClear) {
    switch (storage) {
      case 'session':
        if (doClear) {
          this.clear();
        }
        this._storage = window.sessionStorage;
        break;
      case 'local':
      default:
        if (doClear) {
          this.clear();
        }
        this._storage = window.localStorage;
    }
  },
  length: function() {
    return this._storage.length;
  },
  key: function(n) {
    return this._storage.key(n);
  },
  get: function(key) {
    return this._storage.getItem(key);
  },
  set: function(key, value) {
    this._storage.setItem(key, value);
  },
  remove: function(key) {
    this._storage.removeItem(key);
  },
  clear: function() {
    this._storage.clear();
  }
}
