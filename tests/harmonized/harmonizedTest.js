'use strict';

describe('Harmonized', function() {

  describe('schemas', function() {

    var inputSchema;

    beforeEach(function() {

      inputSchema = {
        planes: {
          storeName: 'flugzeuge',
          keys: {
            storeKey: 'localId',
            serverKey: 'uid'
          },
          route: 'aeroplanes',
          subModels: {
            chemtrails: {
              storeName: 'flugzeuge_chemtrails',
              keys: {
                serverKey: 'chemId',
                storeKey: 'local_id'
              },
              sourceModel: 'chemtrails',
              subModels: {
                conspiracyTheorists: {
                  storeName: 'theorists',
                  keys: {
                    serverKey: 'nsaId',
                    storeKey: '__id'
                  },
                  sourceModel: 'tinfoilHats'
                }
              }
            }
          }
        },
        chemtrails: {
          keys: {
            storeKey: 'storeId',
            serverKey: 'chemid'
          },
          storeName: 'chemicalTrails',
          subModels: {
            conspiracists: {
              keys: {
                storeKey: 'storeId',
                serverKey: 'conid'
              },
              storeName: 'politicians'
            }
          }
        }
      };
    });

    it('should set the model schema', function() {
      // Delete from inputSchema to test behavoir for default values
      delete inputSchema.planes.subModels.chemtrails.keys;
      delete inputSchema.planes.subModels.chemtrails.subModels.conspiracyTheorists.keys.storeKey;
      delete inputSchema.chemtrails.keys.serverKey;
      delete inputSchema.chemtrails.subModels.conspiracists.keys.storeKey;
      delete inputSchema.chemtrails.subModels.conspiracists.keys.serverKey;
      delete inputSchema.planes.subModels.chemtrails.storeName;
      delete inputSchema.planes.subModels.chemtrails.subModels.conspiracyTheorists.storeName;
      delete inputSchema.chemtrails.storeName;

      Harmonized.setModelSchema(inputSchema);

      expect(Harmonized._modelSchema.planes).toBeObject();
      expect(Harmonized._modelSchema.planes).toContainValues({
        storeName: 'flugzeuge',
        route: 'aeroplanes'
      });

      expect(Harmonized._modelSchema.planes.keys).toBeObject();
      expect(Harmonized._modelSchema.planes.keys).toContainValues({
        storeKey: 'localId',
        serverKey: 'uid'
      });

      expect(Harmonized._modelSchema.planes.subModels.chemtrails).toBeObject();
      expect(Harmonized._modelSchema.planes.subModels.chemtrails).toContainValues({
        storeName: 'flugzeuge_chemtrails',
        sourceModel: 'chemtrails'
      });

      expect(Harmonized._modelSchema.planes.subModels.chemtrails.keys).toBeObject();
      expect(Harmonized._modelSchema.planes.subModels.chemtrails.keys).toContainValues({
        serverKey: 'id',
        storeKey: '_id'
      });

      expect(Harmonized._modelSchema.planes.subModels.chemtrails.subModels.conspiracyTheorists).toBeObject();
      expect(Harmonized._modelSchema.planes.subModels.chemtrails.subModels.conspiracyTheorists).toContainValues({
        storeName: 'flugzeuge_chemtrails_conspiracyTheorists',
        sourceModel: 'tinfoilHats'
      });

      expect(Harmonized._modelSchema.planes.subModels.chemtrails.subModels.conspiracyTheorists.keys).toBeObject();
      expect(Harmonized._modelSchema.planes.subModels.chemtrails.subModels.conspiracyTheorists.keys).toContainValues({
        serverKey: 'nsaId',
        storeKey: '_id'
      });

      expect(Harmonized._modelSchema.chemtrails).toBeObject();
      expect(Harmonized._modelSchema.chemtrails).toContainValues({
        storeName: 'chemtrails',
      });

      expect(Harmonized._modelSchema.chemtrails.keys).toBeObject();
      expect(Harmonized._modelSchema.chemtrails.keys).toContainValues({
        storeKey: 'storeId',
        serverKey: 'id'
      });

      expect(Harmonized._modelSchema.chemtrails.subModels.conspiracists).toBeObject();
      expect(Harmonized._modelSchema.chemtrails.subModels.conspiracists).toContainValues({
        storeName: 'politicians'
      });

      expect(Harmonized._modelSchema.chemtrails.subModels.conspiracists.keys).toBeObject();
      expect(Harmonized._modelSchema.chemtrails.subModels.conspiracists.keys).toContainValues({
        storeKey: '_id',
        serverKey: 'id'
      });
    });

    it('should get the model schema', function() {
      Harmonized._modelSchema = inputSchema;
      expect(Harmonized.getModelSchema()).toEqual(inputSchema);
    });

    it('should get the DB schema', function() {
      Harmonized._modelSchema = inputSchema;
      var dbSchema = Harmonized.getDbSchema();

      expect(dbSchema).toEqual({
        flugzeuge: {
          storeKey: 'localId',
          serverKey: 'uid'
        },
        'flugzeuge_chemtrails': {
          storeKey: 'local_id',
          serverKey: 'chemId'
        },
        'theorists': {
          storeKey: '__id',
          serverKey: 'nsaId'
        },
        chemicalTrails: {
          storeKey: 'storeId',
          serverKey: 'chemid'
        },
        politicians: {
          storeKey: 'storeId',
          serverKey: 'conid'
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
