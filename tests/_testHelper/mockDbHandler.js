Harmonized.MockDbHandler = function MockDbHandler(dbHandler, storeName) {
  Harmonized.DbHandler.apply(this, arguments);
};

Harmonized.MockDbHandler.mockPut = function(item) {
  return item;
};

Harmonized.MockDbHandler.mockRemove = function(item) {
  return item;
};

Harmonized.MockDbHandler.prototype = Object.create(Harmonized.DbHandler.prototype);

Harmonized.MockDbHandler.prototype.put = function(item) {
  return Harmonized.MockDbHandler.mockPut(item);
};

Harmonized.MockDbHandler.prototype.remove = function(item) {
  return Harmonized.MockDbHandler.mockRemove(item);
};
