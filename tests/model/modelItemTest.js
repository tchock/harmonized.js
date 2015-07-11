define(['Squire', 'sinon', 'lodash', 'rx', 'rx.testing', 'ModelItem'],
  function(Squire, sinon, _, Rx, RxTest, ModelItem) {
    describe('Model', function() {

      var testModelMock;
      var testModelItem;
      var injector;
      var scheduler;

      var dbHandlerUpstreamList = [];
      var serverHandlerUpstreamList = [];

      var dbHandlerUpstream;
      var dbHandlerDownstream;

      var serverHandlerUpstream;
      var serverHandlerDownstream;

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
          return 'http://www.test.de/' + modelName
        }
      };

      beforeEach(function() {
        // Scheduler to mock the RxJS timing
        scheduler = new RxTest.TestScheduler();
      });

      beforeEach(function() {
        testModelMock = new ModelMock('test');
        testModelItem = new ModelItem(testModelMock, {
          name: 'Werner'
        }, {
          rtId: 123,
          serverId: 1052305,
        });
      });

      it('should create an item with runtime ID given', function() {
        testModelItem = new ModelItem(testModelMock, {
          name: 'Werner'
        }, {
          rtId: 123,
          serverId: 1052305,
          storeId: 120
        });

        expect(testModelMock._nextRuntimeId).toBe(1);
        expect(testModelItem.meta.rtId).toBe(123);
      });

      it('should create an item without runtime ID given', function() {
        testModelItem = new ModelItem(testModelMock, {
          name: 'Werner'
        }, {
          serverId: 1052305,
          storeId: 120
        });

        expect(testModelMock._nextRuntimeId).toBe(2);
        expect(testModelItem.meta.rtId).toBe(1);
      });

      it('should get the itemUrl with serverId given', function() {
        var itemUrl = testModelItem.getUrl();
        expect(itemUrl).toBe('http://www.test.de/test/1052305');
      });

      it('should get the itemUrl without serverId given', function() {
        testModelItem = new ModelItem(testModelMock, {
          name: 'Werner'
        }, {
          rtId: 123,
          storeId: 120
        });
        var itemUrl = testModelItem.getUrl();
        expect(itemUrl).toBe('http://www.test.de/test/');
      });

      it('should update an item with update from model upstream ', function() {
        otherModelItem = new ModelItem(testModelMock, {
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

          expect(testModelItem.data.name).toBe('Werner');
          expect(testModelItem.meta.storeId).toBeUndefined();
          expect(otherModelItem.data.name).toBe('Günther');

          scheduler.start();

          expect(testModelItem.data.name).toBe('Werner Herzog');
          expect(testModelItem.meta.storeId).toBe(120);
          expect(otherModelItem.data.name).toBe('Günther Kastenfrosch');
      });

      it('should update an item with update from existingItemDownStream', function() {
        otherModelItem = new ModelItem(testModelMock, {
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
        expect(testModelItem.meta.serverId).toBeUndefined();
        expect(otherModelItem.data.name).toBe('Günther');

        scheduler.start();

        expect(testModelItem.data.name).toBe('Werner Herzog');
        expect(testModelItem.meta.serverId).toBe(9001);
        expect(otherModelItem.data.name).toBe('Günther Kastenfrosch');
      });

      it('should mark an item as deleted with update from model upstream', function() {
        otherModelItem = new ModelItem(testModelMock, {
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
        expect(testModelItem.meta.serverId).toBeUndefined();
        expect(otherModelItem.data.name).toBe('Günther');

        scheduler.start();

        expect(testModelItem.data.name).toBe('Werner Herzog');
        expect(testModelItem.meta.deleted).toBe(true);
        expect(otherModelItem.data.name).toBe('Günther Kastenfrosch');
        expect(otherModelItem.meta.deleted).toBe(true);
      });

      it('should mark an item as deleted with update from model existingItemDownStream', function() {
        otherModelItem = new ModelItem(testModelMock, {
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
        expect(testModelItem.meta.serverId).toBeUndefined();
        expect(otherModelItem.data.name).toBe('Günther');

        scheduler.start();

        expect(testModelItem.data.name).toBe('Werner Herzog');
        expect(testModelItem.meta.deleted).toBe(true);
        expect(otherModelItem.data.name).toBe('Günther Kastenfrosch');
        expect(otherModelItem.meta.deleted).toBe(true);
      });

      it('should finally delete an item with update from database downstream', function() {
        otherModelItem = new ModelItem(testModelMock, {
          name: 'Günther'
        }, {
          serverId: 1,
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
              serverId: 1,
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
      });


    });
  });
});
