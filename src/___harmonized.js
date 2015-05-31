var Harmonized = function Harmonized() {

};

Harmonized.getStoreKey = function() {
  // TODO implement get store key fn
}

Harmonized.getServerKey = function() {
  // TODO implement get server key fn
}

Harmonized._createStreamItem = function(dbItem, keys) {
  var item = {
    meta: {
      storeId: dbItem[keys.storeKey],
      serverId: dbItem[keys.serverKey]
    }
  };

  // Remove the metadata from the actual data
  delete dbItem[keys.storeKey];
  delete dbItem[keys.serverKey];

  item.data = dbItem;

  return item;
}
