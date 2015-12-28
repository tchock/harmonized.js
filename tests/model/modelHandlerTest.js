'use strict';

define(['Squire', 'lodash'], function(Squire, _) {
  describe('modelHandler', function() {

    var injector;
    var modelHandler;

    var ModelMock = function ModelMock(modelName, options) {
      this._modelName = modelName;
      this._options = options;
      this._serverHandler = {
        pushAll: jasmine.createSpy(),
      };
      this.getFromServer =  jasmine.createSpy();
      this.setOnline = jasmine.createSpy();
      this.setOffline = jasmine.createSpy();
    };

    var harmonizedDataMock = {
      _config: {
        fetchAtStart: false,
      },
      _generatedModelSchema: {
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
        },
      },

      getModelSchema: function() {
        return harmonizedDataMock._generatedModelSchema;
      },

      generateModelSchema: jasmine.createSpy(),
    };

    var dbHandlerFactoryMock = {
      _DbHandler: {
        deleteDb: jasmine.createSpy()
      }
    };

    beforeEach(function() {
      injector = new Squire();
      injector.mock('Model', ModelMock);
      injector.mock('harmonizedData', harmonizedDataMock);
      injector.mock('dbHandlerFactory', dbHandlerFactoryMock);
    });

    afterEach(function() {
      modelHandler._modelList = {};
    });

    function testInContext(cb, options) {
      injector.require(['modelHandler', 'mocks'], function(__modelHandler__, mocks) {

        modelHandler = __modelHandler__;

        cb({
          mocks: mocks.mocks
        });
      });
    }

    it('should initialize all models from the model definition', function(done) {
      testInContext(function(deps) {

        // Initialize with the models from the definitions
        modelHandler.init();

        expect(harmonizedDataMock.generateModelSchema).toHaveBeenCalled();
        expect(_.size(modelHandler._modelList)).toBe(2);
        expect(modelHandler._modelList.planes instanceof ModelMock).toBeTruthy();
        expect(modelHandler._modelList.planes._modelName).toBe('planes');
        expect(modelHandler._modelList.planes._options).toEqual({
          storeName: 'flugzeuge',
          keys: {
            storeKey: 'localId',
            serverKey: 'uid'
          },
          route: 'aeroplanes'
        });

        expect(modelHandler._modelList.chemtrails instanceof ModelMock).toBeTruthy();
        expect(modelHandler._modelList.chemtrails._modelName).toBe('chemtrails');
        expect(modelHandler._modelList.chemtrails._options).toEqual({
          keys: {
            storeKey: 'storeId',
            serverKey: 'chemid'
          },
          storeName: 'chemicalTrails'
        });

        done();
      });
    });

    it('should get a specific model', function(done) {
      testInContext(function(deps) {
        modelHandler._modelList = {
          testModel: new ModelMock('testModel'),
          otherModel: new ModelMock('otherModel')
        };

        expect(modelHandler.getModel('testModel')).toBe(modelHandler._modelList.testModel);
        expect(modelHandler.getModel('otherModel')).toBe(modelHandler._modelList.otherModel);

        done();
      });
    });

    it('should not get a not specified model', function(done) {
      testInContext(function(deps) {
        modelHandler._modelList = {
          testModel: new ModelMock('testModel'),
          otherModel: new ModelMock('otherModel')
        };

        expect(modelHandler.getModel('notDefinedModel')).toBeUndefined();

        done();
      });
    });

    it('should push data of all models', function(done) {
      testInContext(function(deps) {
        modelHandler._modelList = {
          testModel: new ModelMock('testModel'),
          otherModel: new ModelMock('otherModel')
        };

        modelHandler.pushAll();
        expect(modelHandler._modelList.testModel._serverHandler.pushAll.calls.count()).toBe(1);
        expect(modelHandler._modelList.otherModel._serverHandler.pushAll.calls.count()).toBe(1);

        done();
      });
    });

    it('should push data of all models', function(done) {
      testInContext(function(deps) {
        modelHandler._modelList = {
          testModel: new ModelMock('testModel'),
          otherModel: new ModelMock('otherModel')
        };

        modelHandler.getFromServer();
        expect(modelHandler._modelList.testModel.getFromServer.calls.count()).toBe(1);
        expect(modelHandler._modelList.otherModel.getFromServer.calls.count()).toBe(1);

        done();
      });
    });

    it('should destroy the whole model structure and delete the db', function(done) {
      testInContext(function(deps) {
        modelHandler.destroy();

        expect(modelHandler._modelList).toEqual({});
        expect(dbHandlerFactoryMock._DbHandler.deleteDb.calls.count()).toBe(1);

        done();
      });
    });

  });
});
