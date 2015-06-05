var Harmonized = function Harmonized() {

};

Harmonized.dbVersion = 1;

Harmonized.getStoreKey = function() {
  // TODO implement get store key fn
}

Harmonized.getServerKey = function() {
  // TODO implement get server key fn
}

Harmonized._createStreamItem = function(inputItem, keys) {
  inputItem = _.clone(inputItem);
  var item = {
    meta: {
      storeId: inputItem[keys.storeKey],
      serverId: inputItem[keys.serverKey]
    }
  };

  // Remove the metadata from the actual data
  delete inputItem[keys.storeKey];
  delete inputItem[keys.serverKey];

  item.data = inputItem;

  return item;
}
