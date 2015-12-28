'use strict';

define(['harmonizedData', 'lodash'], function(harmonizedData, _) {

  describe('harmonizedData', function() {

    it('should throw an error when calling the unchanged _httpFunction',
      function() {
        expect(harmonizedData._httpFunction).toThrow(new Error(
          'No http function was added'));
      });

    describe('schemas', function() {

      var inputSchema;

      beforeEach(function() {

        inputSchema = {
          planes: {
            storeName: 'flugzeuge',
            keys: {
              storeKey: 'localId',
              serverKey: 'uid',
            },
            route: 'aeroplanes',
            subModels: {
              chemtrails: {
                storeName: 'flugzeuge_chemtrails',
                keys: {
                  serverKey: 'chemId',
                  storeKey: 'local_id',
                },
                sourceModel: 'chemtrails',
                subModels: {
                  conspiracyTheorists: {
                    storeName: 'theorists',
                    keys: {
                      serverKey: 'nsaId',
                      storeKey: '__id',
                    },
                    sourceModel: 'tinfoilHats',
                  },
                },
              },
            },
          },
          chemtrails: {
            keys: {
              storeKey: 'storeId',
              serverKey: 'chemid',
            },
            storeName: 'chemicalTrails',
            subModels: {
              conspiracists: {
                keys: {
                  storeKey: 'storeId',
                  serverKey: 'conid',
                },
                storeName: 'politicians',
              },
            },
          },
        };
      });

      it('should set the model schema', function() {
        harmonizedData.setModelSchema(inputSchema);

        expect(harmonizedData._modelSchema.planes).toBeObject();
        expect(harmonizedData._modelSchema.planes).toContainValues({
          storeName: 'flugzeuge',
          route: 'aeroplanes',
        });

        expect(harmonizedData._modelSchema.planes.keys).toBeObject();
        expect(harmonizedData._modelSchema.planes.keys).toContainValues({
          storeKey: 'localId',
          serverKey: 'uid',
        });

        expect(harmonizedData._modelSchema.planes.subModels.chemtrails)
          .toBeObject();
        expect(harmonizedData._modelSchema.planes.subModels.chemtrails)
          .toContainValues({
            storeName: 'flugzeuge_chemtrails',
            sourceModel: 'chemtrails',
          });

        expect(harmonizedData._modelSchema.planes.subModels.chemtrails
          .keys).toBeObject();
        expect(harmonizedData._modelSchema.planes.subModels.chemtrails
          .keys).toContainValues({
          serverKey: 'chemId',
          storeKey: 'local_id',
        });

        expect(harmonizedData._modelSchema.planes.subModels.chemtrails
          .subModels.conspiracyTheorists).toBeObject();
        expect(harmonizedData._modelSchema.planes.subModels.chemtrails
          .subModels.conspiracyTheorists).toContainValues({
          storeName: 'theorists',
          sourceModel: 'tinfoilHats',
        });

        expect(harmonizedData._modelSchema.planes.subModels.chemtrails
          .subModels.conspiracyTheorists.keys).toBeObject();
        expect(harmonizedData._modelSchema.planes.subModels.chemtrails
          .subModels.conspiracyTheorists.keys).toContainValues({
          serverKey: 'nsaId',
          storeKey: '__id',
        });

        expect(harmonizedData._modelSchema.chemtrails).toBeObject();
        expect(harmonizedData._modelSchema.chemtrails).toContainValues({
          storeName: 'chemicalTrails',
        });

        expect(harmonizedData._modelSchema.chemtrails.keys).toBeObject();
        expect(harmonizedData._modelSchema.chemtrails.keys).toContainValues({
          storeKey: 'storeId',
          serverKey: 'chemid',
        });

        expect(harmonizedData._modelSchema.chemtrails.subModels.conspiracists)
          .toBeObject();
        expect(harmonizedData._modelSchema.chemtrails.subModels.conspiracists)
          .toContainValues({
            storeName: 'politicians',
          });

        expect(harmonizedData._modelSchema.chemtrails.subModels.conspiracists
          .keys).toBeObject();
        expect(harmonizedData._modelSchema.chemtrails.subModels.conspiracists
          .keys).toContainValues({
          storeKey: 'storeId',
          serverKey: 'conid',
        });
      });

      it('should generate the model schema', function() {
        // Delete from inputSchema to test behavoir for default values
        delete inputSchema.planes.subModels.chemtrails.keys;
        delete inputSchema.planes.subModels.chemtrails.subModels
          .conspiracyTheorists.keys.storeKey;
        delete inputSchema.chemtrails.keys.serverKey;
        delete inputSchema.chemtrails.subModels.conspiracists.keys
          .storeKey;
        delete inputSchema.chemtrails.subModels.conspiracists.keys
          .serverKey;
        delete inputSchema.planes.subModels.chemtrails.storeName;
        delete inputSchema.planes.subModels.chemtrails.subModels
          .conspiracyTheorists.storeName;
        delete inputSchema.chemtrails.storeName;

        harmonizedData.setModelSchema(inputSchema);
        harmonizedData.generateModelSchema();

        expect(harmonizedData._generatedModelSchema.planes).toBeObject();
        expect(harmonizedData._generatedModelSchema.planes).toContainValues({
          storeName: 'flugzeuge',
          route: 'aeroplanes',
        });

        expect(harmonizedData._generatedModelSchema.planes.keys).toBeObject();
        expect(harmonizedData._generatedModelSchema.planes.keys).toContainValues({
          storeKey: 'localId',
          serverKey: 'uid',
        });

        expect(harmonizedData._generatedModelSchema.planes.subModels.chemtrails)
          .toBeObject();
        expect(harmonizedData._generatedModelSchema.planes.subModels.chemtrails)
          .toContainValues({
            storeName: 'flugzeuge_chemtrails',
            sourceModel: 'chemtrails',
          });

        expect(harmonizedData._generatedModelSchema.planes.subModels.chemtrails
          .keys).toBeObject();
        expect(harmonizedData._generatedModelSchema.planes.subModels.chemtrails
          .keys).toContainValues({
          serverKey: 'id',
          storeKey: '_id',
        });

        expect(harmonizedData._generatedModelSchema.planes.subModels.chemtrails
          .subModels.conspiracyTheorists).toBeObject();
        expect(harmonizedData._generatedModelSchema.planes.subModels.chemtrails
          .subModels.conspiracyTheorists).toContainValues({
          storeName: 'flugzeuge_chemtrails_conspiracyTheorists',
          sourceModel: 'tinfoilHats',
        });

        expect(harmonizedData._generatedModelSchema.planes.subModels.chemtrails
          .subModels.conspiracyTheorists.keys).toBeObject();
        expect(harmonizedData._generatedModelSchema.planes.subModels.chemtrails
          .subModels.conspiracyTheorists.keys).toContainValues({
          serverKey: 'nsaId',
          storeKey: '_id',
        });

        expect(harmonizedData._generatedModelSchema.chemtrails).toBeObject();
        expect(harmonizedData._generatedModelSchema.chemtrails).toContainValues({
          storeName: 'chemtrails',
        });

        expect(harmonizedData._generatedModelSchema.chemtrails.keys).toBeObject();
        expect(harmonizedData._generatedModelSchema.chemtrails.keys).toContainValues({
          storeKey: 'storeId',
          serverKey: 'id',
        });

        expect(harmonizedData._generatedModelSchema.chemtrails.subModels.conspiracists)
          .toBeObject();
        expect(harmonizedData._generatedModelSchema.chemtrails.subModels.conspiracists)
          .toContainValues({
            storeName: 'politicians',
          });

        expect(harmonizedData._generatedModelSchema.chemtrails.subModels.conspiracists
          .keys).toBeObject();
        expect(harmonizedData._generatedModelSchema.chemtrails.subModels.conspiracists
          .keys).toContainValues({
          storeKey: '_id',
          serverKey: 'id',
        });
      });

      it('should get the model schema', function() {
        harmonizedData._generatedModelSchema = inputSchema;
        expect(harmonizedData.getModelSchema()).toEqual(inputSchema);
      });

      it('should get the DB schema', function() {
        harmonizedData._modelSchema = inputSchema;
        var dbSchema = harmonizedData.getDbSchema();

        expect(dbSchema).toEqual({
          flugzeuge: {
            storeKey: 'localId',
            serverKey: 'uid',
          },
          'flugzeuge_chemtrails': {
            storeKey: 'local_id',
            serverKey: 'chemId',
          },
          'theorists': {
            storeKey: '__id',
            serverKey: 'nsaId',
          },
          chemicalTrails: {
            storeKey: 'storeId',
            serverKey: 'chemid',
          },
          politicians: {
            storeKey: 'storeId',
            serverKey: 'conid',
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
          lastName: 'Doe',
        };

        expectedStreamItem = {
          data: {
            firstName: 'John',
            lastName: 'Doe',
          },
          meta: {
            storeId: undefined,
            serverId: undefined,
            deleted: false,
          }
        };

        keys = {
          storeKey: '_id',
          serverKey: 'id',
        };
      });

      it('should create a stream item with full metadata', function() {
        inputItem._id = '1234';
        inputItem.id = '4321';
        expectedStreamItem.meta = {
          storeId: '1234',
          serverId: '4321',
          deleted: false,
        };

        var streamItem = harmonizedData._createStreamItem(inputItem,
          keys);

        expect(streamItem).toEqual(expectedStreamItem);
        expect(streamItem.data).not.toEqual(inputItem);
        expect(streamItem.data).not.toBe(inputItem);
      });

      it('should create a stream item with half metadata', function() {
        inputItem._id = '1234';
        expectedStreamItem.meta.storeId = '1234';

        var streamItem = harmonizedData._createStreamItem(inputItem,
          keys);

        expect(streamItem).toEqual(expectedStreamItem);
        expect(streamItem.data).not.toEqual(inputItem);
        expect(streamItem.data).not.toBe(inputItem);
      });

      it('should create a stream item with no metadata', function() {
        var streamItem = harmonizedData._createStreamItem(inputItem,
          keys);

        expect(streamItem).toEqual(expectedStreamItem);
        expect(streamItem.data).toEqual(inputItem);
        expect(streamItem.data).not.toBe(inputItem);
      });

      it('should create a stream item with no store key', function() {
        inputItem._id = '1234';
        inputItem.id = '4321';

        var streamItem = harmonizedData._createStreamItem(inputItem, {
          serverKey: 'id',
        });

        expect(streamItem.meta.storeId).toBeUndefined();
        expect(streamItem.data._id).toBe('1234');
        expect(streamItem.data.id).toBeUndefined();
      });

      it('should get the next transaction ID', function() {
        expect(harmonizedData._nextTransactionId).toBe(1);
        harmonizedData.getNextTransactionId();
        expect(harmonizedData._nextTransactionId).toBe(2);
      });

    });

  });
});
