'use strict';

define(['Squire', 'rx', 'rx.testing', 'ModelItem'], function(Squire, Rx, RxTest, ModelItem) {
  describe('ModelItem', function() {

    var testModelMock;
    var testModelItem;
    var scheduler;

    var ModelMock = function ModelMock(modelName, options) {
      this.downStream = new Rx.Subject();
      this.upStream = new Rx.Subject();
      this._existingItemDownStream = new Rx.Subject();
      this._dbDownStream = new Rx.Subject();

      this._rtIdHash = {};
      this._serverIdHash = {};
      this._storeIdHash = {};

      this._nextRuntimeId = 1;
      this.getNextRuntimeId = function() {
        return this._nextRuntimeId++;
      };

      this.getUrl = function() {
        return 'http://www.test.de/' + modelName;
      };
    };

    beforeEach(function() {
      // Scheduler to mock the RxJS timing
      scheduler = new RxTest.TestScheduler();
    });

    beforeEach(function() {
      ModelItem.streamList = [];
      testModelMock = new ModelMock('test');
      testModelItem = new ModelItem(testModelMock, {
        name: 'Werner'
      }, {
        rtId: 123,
        serverId: 1052305
      });
    });

    it('should create an item without any data', function(done) {
      testModelItem = new ModelItem(testModelMock);

      expect(testModelItem.data).toEqual({});
      expect(testModelItem.meta).toEqual({
        rtId: 1
      });

      done();
    });

    it('should create an item with runtime ID given', function(done) {
      testModelItem = new ModelItem(testModelMock, {
        name: 'Werner'
      }, {
        rtId: 123,
        serverId: 1052305,
        storeId: 120
      });

      expect(testModelMock._nextRuntimeId).toBe(1);
      expect(testModelItem.meta.rtId).toBe(123);

      done();
    });

    it('should create an item without runtime ID given', function(done) {
      testModelItem = new ModelItem(testModelMock, {
        name: 'Werner'
      }, {
        serverId: 1052305,
        storeId: 120
      });

      expect(testModelMock._nextRuntimeId).toBe(2);
      expect(testModelItem.meta.rtId).toBe(1);

      done();
    });

    it('should get the itemUrl with serverId given', function(done) {
      var itemUrl = testModelItem.getUrl();
      expect(itemUrl).toBe('http://www.test.de/test/1052305');

      done();
    });

    it('should get the itemUrl without serverId given', function(done) {
      testModelItem = new ModelItem(testModelMock, {
        name: 'Werner'
      }, {
        rtId: 123,
        storeId: 120
      });
      var itemUrl = testModelItem.getUrl();
      expect(itemUrl).toBe('http://www.test.de/test/');

      done();
    });

    it('should update an item with update from model upstream ',
      function(done) {
        var otherModelItem = new ModelItem(testModelMock, {
          name: 'Günther'
        }, {
          serverId: 1,
          storeId: 123,
          rtId: 12
        });

        scheduler.scheduleWithAbsolute(1, function() {
          testModelMock.upStream.onNext({
            data: {
              name: 'Werner Herzog'
            },
            meta: {
              serverId: 9001,
              rtId: 123,
              storeId: 120,
              action: 'save'
            }
          });
        });

        scheduler.scheduleWithAbsolute(10, function() {
          testModelMock.upStream.onNext({
            data: {
              name: 'Günther Kastenfrosch'
            },
            meta: {
              serverId: 1,
              rtId: 12,
              storeId: 123,
              action: 'save'
            }
          });
        });

        expect(testModelItem.data.name).toBe('Werner');
        expect(testModelItem.meta.storeId).toBeUndefined();
        expect(otherModelItem.data.name).toBe('Günther');

        scheduler.start();

        expect(testModelItem.data.name).toBe('Werner Herzog');
        expect(testModelItem.meta.storeId).toBe(120);
        expect(otherModelItem.data.name).toBe(
          'Günther Kastenfrosch');

        done();
      });

    it('should update an item with update from existingItemDownStream',
      function(done) {
        var otherModelItem = new ModelItem(testModelMock, {
          name: 'Günther'
        }, {
          serverId: 1,
          storeId: 123,
          rtId: 12
        });

        scheduler.scheduleWithAbsolute(1, function() {
          testModelMock._existingItemDownStream.onNext({
            data: {
              name: 'Werner Herzog'
            },
            meta: {
              serverId: 9001,
              rtId: 123,
              storeId: 120,
              action: 'save'
            }
          });

        });

        scheduler.scheduleWithAbsolute(10, function() {
          testModelMock._existingItemDownStream.onNext({
            data: {
              name: 'Günther Kastenfrosch'
            },
            meta: {
              serverId: 1,
              rtId: 12,
              storeId: 123,
              action: 'save'
            }
          });
        });

        expect(testModelItem.data.name).toBe('Werner');
        expect(testModelItem.meta.storeId).toBeUndefined();
        expect(otherModelItem.data.name).toBe('Günther');

        scheduler.start();

        expect(testModelItem.data.name).toBe('Werner Herzog');
        expect(testModelItem.meta.serverId).toBe(9001);
        expect(otherModelItem.data.name).toBe(
          'Günther Kastenfrosch');

        done();
      });

    it('should not update an locally deleted item with update from existingItemDownStream',
      function(done) {
        var otherModelItem = new ModelItem(testModelMock, {
          name: 'Günther'
        }, {
          serverId: 1,
          storeId: 123,
          rtId: 12,
          deleted: true
        });

        scheduler.scheduleWithAbsolute(10, function() {
          testModelMock._existingItemDownStream.onNext({
            data: {
              name: 'Günther Kastenfrosch'
            },
            meta: {
              serverId: 1,
              rtId: 12,
              storeId: 123,
              action: 'save'
            }
          });
        });

        expect(otherModelItem.data.name).toBe('Günther');

        scheduler.start();

        expect(otherModelItem.data.name).toBe('Günther');
        expect(otherModelItem.meta.deleted).toBeTruthy();

        done();
      });

    it(
      'should mark an item as deleted with update from model upstream',
      function(done) {
        var otherModelItem = new ModelItem(testModelMock, {
          name: 'Günther'
        }, {
          serverId: 1,
          storeId: 123,
          rtId: 12
        });

        scheduler.scheduleWithAbsolute(1, function() {
          testModelMock.upStream.onNext({
            data: {
              name: 'Werner Herzog'
            },
            meta: {
              serverId: 9001,
              rtId: 123,
              storeId: 120,
              action: 'delete'
            }
          });
        });

        scheduler.scheduleWithAbsolute(10, function() {
          testModelMock.upStream.onNext({
            data: {
              name: 'Günther Kastenfrosch'
            },
            meta: {
              serverId: 1,
              rtId: 12,
              storeId: 123,
              action: 'delete'
            }
          });
        });
        expect(testModelItem.data.name).toBe('Werner');
        expect(otherModelItem.data.name).toBe('Günther');

        scheduler.start();

        expect(testModelItem.meta.deleted).toBe(true);
        expect(otherModelItem.meta.deleted).toBe(true);

        done();
      });

    it(
      'should mark an item as deleted with update from model existingItemDownStream',
      function(done) {
        var otherModelItem = new ModelItem(testModelMock, {
          name: 'Günther'
        }, {
          serverId: 1,
          storeId: 123,
          rtId: 12
        });

        scheduler.scheduleWithAbsolute(1, function() {
          testModelMock._existingItemDownStream.onNext({
            data: {
              name: 'Werner Herzog'
            },
            meta: {
              serverId: 9001,
              rtId: 123,
              storeId: 120,
              action: 'delete'
            }
          });
        });

        scheduler.scheduleWithAbsolute(10, function() {
          testModelMock._existingItemDownStream.onNext({
            data: {
              name: 'Günther Kastenfrosch'
            },
            meta: {
              serverId: 1,
              rtId: 12,
              storeId: 123,
              action: 'delete'
            }
          });
        });
        expect(testModelItem.data.name).toBe('Werner');
        expect(otherModelItem.data.name).toBe('Günther');

        scheduler.start();

        expect(testModelItem.meta.deleted).toBe(true);
        expect(otherModelItem.meta.deleted).toBe(true);

        done();
      });

    it(
      'should finally delete an item with update from database downstream',
      function(done) {
        var otherModelItem = new ModelItem(testModelMock, {
          name: 'Günther'
        }, {
          storeId: 123,
          rtId: 12
        });

        scheduler.scheduleWithAbsolute(1, function() {
          testModelMock._dbDownStream.onNext({
            data: {
              name: 'Werner Herzog'
            },
            meta: {
              serverId: 9001,
              rtId: 123,
              storeId: 120,
              action: 'deletePermanently'
            }
          });
        });

        scheduler.scheduleWithAbsolute(10, function() {
          testModelMock._dbDownStream.onNext({
            data: {
              name: 'Günther Kastenfrosch'
            },
            meta: {
              rtId: 12,
              storeId: 123,
              action: 'deletePermanently'
            }
          });
        });

        expect(testModelMock._rtIdHash[123]).toBe(testModelItem);
        expect(testModelMock._rtIdHash[12]).toBe(otherModelItem);

        scheduler.start();
        expect(testModelMock._rtIdHash[123]).toBeUndefined();
        expect(testModelMock._rtIdHash[12]).toBeUndefined();

        done();
      });

      it('should create a new item with submodels', function(done) {
        var injector = new Squire();
        var subModelSpy = jasmine.createSpy();
        injector.mock('SubModel', subModelSpy);
        injector.require(['ModelItem'], function(ModelItem) {
          testModelMock._subModelsSchema = {
            testSub: {},
            otherTestSub: {}
          };
          testModelItem = new ModelItem(testModelMock, {}, {});

          expect(subModelSpy.calls.count()).toBe(2);
          expect(_.size(testModelItem.subData)).toBe(2);
          expect(Object.keys(testModelItem.subData)).toEqual(['testSub', 'otherTestSub']);

          done();
        });
      });

  });
});
