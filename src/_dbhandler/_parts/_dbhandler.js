Harmonized.DbHandler = function DbHandler(dbHandler, storeName) {
  this._storeName = storeName;
  this._keys = {
    storeKey: Harmonized.getStoreKey(storeName),
    serverKey: Harmonized.getServerKey(storeName)
  }

  // Public streams
  this.downstream = new Rx.Subject();
  this.upstream = new Rx.Subject();

  // Internal pausable upstream
  this._upstream = this.upstream.pausableBuffered(dbHandler._connectionStream);

  // Directly connect to the server if necessary
  dbHandler.connect();

  // Save upstream
  this._saveUpstream = this._upstream.filter(function(item) {
    return item.meta.action === 'save';
  }).map(this.put);
  this._saveUpstream.subscribe(this.downstream);

  // Delete upstream
  this._deleteUpstream = this._upstream.filter(function(item) {
    return item.meta.action === 'delete';
  }).map(this.remove);
  this._deleteUpstream.subscribe(this.downstream);

  // Initially get the metadata
  this._metaStorageName = 'harmonized_meta_' + this._storeName;
  this._metadata = Harmonized.getWebStorage().getItem(this._metaStorageName) || {};
}

Harmonized.DbHandler.prototype.getMetadata = function () {
  return this._metadata;
};

Harmonized.DbHandler.prototype.setMetadata = function(key, value) {
  this._metadata[key] = value;
  Harmonized.getWebStorage().setItem(this._metaStorageName, this._metadata);
};

Harmonized.DbHandler.prototype._createDbItem = function(item) {
  // Clone data and arrange it for db
  var putItem = _.clone(item.data);
  if (!_.isUndefined(item.meta) && !_.isUndefined(item.meta.storeId)) {
    putItem[this._keys.storeKey] = item.meta.storeId;
  }
  if (!_.isUndefined(item.meta) && !_.isUndefined(item.meta.serverId)) {
    putItem[this._keys.serverKey] = item.meta.serverId;
  }

  return putItem;
}
