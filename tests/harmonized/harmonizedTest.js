'use strict';

describe('Harmonized', function() {

  describe('DB schema', function() {
    beforeEach(function() {
      Harmonized._dbSchema = {
        cars: {
          storeKey: 'storeId',
          serverKey: 'serverId'
        },
        passengers: {
          storeKey: 'anotherStoreId',
          serverKey: 'foreignId'
        }
      };
    });

    it('should get the whole DB schema', function() {
      expect(Harmonized.getDbSchema()).toEqual(Harmonized._dbSchema);
    });

    it('should get a single DB schema entry', function() {
      expect(Harmonized.getDbSchema('passengers')).toEqual({
        storeKey: 'anotherStoreId',
        serverKey: 'foreignId'
      });
    });

    it('should set the DB schema', function() {
      Harmonized._dbSchema = {};

      var modelSchema = {
        planes: {
          storeName: 'flugzeuge',
          storeKey: 'localId',
          serverKey: 'uid',
          route: 'aeroplanes',
          subModels: {
            chemtrails: {
              sourceModel: 'chemtrails',
              subModels: {
                conspiracyTheorists: {
                  serverKey: 'nsaId',
                  sourceModel: 'tinfoilHats'
                }
              }
            }
          }
        },
        chemtrails: {
          storeKey: 'storeId'
        }
      };

      Harmonized._setDbSchema(modelSchema);

      expect(Harmonized._dbSchema).toEqual({
        flugzeuge: {
          storeKey: 'localId',
          serverKey: 'uid'
        },
        'flugzeuge_chemtrails': {
          storeKey: '_id',
          serverKey: 'id'
        },
        'flugzeuge_chemtrails_conspiracyTheorists': {
          storeKey: '_id',
          serverKey: 'nsaId'
        },
        chemtrails: {
          storeKey: 'storeId',
          serverKey: 'id'
        }
      });
    });
  });

  describe('createStreamItem function', function() {
    var inputItem;
    var expectedStreamItem;
    var keys;

    beforeEach(function() {
      inputItem = {
        firstName: 'John',
        lastName: 'Doe'
      };

      expectedStreamItem = {
        data: {
          firstName: 'John',
          lastName: 'Doe'
        },
        meta: {
          storeId: undefined,
          serverId: undefined
        }
      };

      keys = {
        storeKey: '_id',
        serverKey: 'id'
      };
    });

    it('should create a stream item with full metadata', function() {
      inputItem._id = '1234';
      inputItem.id = '4321';
      expectedStreamItem.meta = {
        storeId: '1234',
        serverId: '4321'
      };

      var streamItem = Harmonized._createStreamItem(inputItem, keys);

      expect(streamItem).toEqual(expectedStreamItem);
      expect(streamItem.data).not.toEqual(inputItem);
      expect(streamItem.data).not.toBe(inputItem);
    });

    it('should create a stream item with half metadata', function() {
      inputItem._id = '1234';
      expectedStreamItem.meta.storeId = '1234';

      var streamItem = Harmonized._createStreamItem(inputItem, keys);

      expect(streamItem).toEqual(expectedStreamItem);
      expect(streamItem.data).not.toEqual(inputItem);
      expect(streamItem.data).not.toBe(inputItem);
    });

    it('should create a stream item with no metadata', function() {
      var streamItem = Harmonized._createStreamItem(inputItem, keys);

      expect(streamItem).toEqual(expectedStreamItem);
      expect(streamItem.data).toEqual(inputItem);
      expect(streamItem.data).not.toBe(inputItem);
    });

  });

});
