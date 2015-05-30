Harmonized.DbHandler = function(dbHandler, storeName) {
  this._storeName = storeName;
  this._storeKey = Harmonized.getStoreKey(storeName);
  this._serverKey = Harmonized.getServerKey(storeName);

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
  this._metadata = webStorage.get('harmonized_meta_' + this._storeName) || {};
}

Harmonized.DbHandler.prototype.getMetadata = function () {
  return this._metadata;
};

Harmonized.DbHandler.prototype.setMetadata = function(key, value) {
  this._metadata[key] = value;
  return webStorage.add('harmonized_meta_' + this._storeName, this._metadata);
};

Harmonized.DbHandler.prototype._createDbItem = function(item) {
  // Clone data and arrange it for db
  var putItem = _.clone(item.data);
  putItem[this.storeKey] = item.meta.storeId;
  putItem[this.serverKey] = item.meta.serverId;

  return putItem;
}

Harmonized.DbHandler.prototype._createStreamItem = function(dbItem) {
  var item = {
    meta: {
      storeId: dbItem[this.storeKey],
      serverId: dbItem[this.serverKey]
    }
  };

  // Remove the metadata from the actual data
  delete dbItem[this.storeKey];
  delete dbItem[this.serverKey];

  item.data = dbItem;

  return item;
}
