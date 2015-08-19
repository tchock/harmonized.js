'use strict';

define(['Squire', 'rx', 'rx.testing', 'ViewItem'], function(Squire, Rx, RxTest,
  ViewItem) {
  describe('ViewItem', function() {

    var testViewCollection;
    var scheduler;

    var upStreamItems;
    var downStreamItems;

    var ViewCollectionMock = function() {
      var collection = Object.create(Array.prototype);
      collection = Array.apply(collection);

      collection.downStream = new Rx.Subject();
      collection.upStream = new Rx.Subject();

      collection.downStream.subscribe(function(item) {
        downStreamItems.push(item);
      });

      collection.upStream.subscribe(function(item) {
        upStreamItems.push(item);
      });

      collection._model = {
        getNextRuntimeId: function() {
          return 1;
        },
        getNextTransactionId: function() {
          return 1;
        },
        getItem: function() {
          return {
            subData: {
              otherTestSub: {
                _modelName: 'otherTestSub'
              }
            }
          };
        }
      };

      collection._items = {};

      return collection;
    };

    beforeEach(function() {
      // Scheduler to mock the RxJS timing
      scheduler = new RxTest.TestScheduler();
    });

    beforeEach(function() {
      testViewCollection = new ViewCollectionMock();
      upStreamItems = [];
      downStreamItems = [];
    });

    it('should create a view item without data', function(done) {
      var viewItem = new ViewItem(testViewCollection);

      var itemPropertyCount = 0;
      for (var item in viewItem) {
        if (viewItem.hasOwnProperty(item) && item !== '_meta' &&
          item !== 'getCollection' && item !== '_streams' &&
          item !== '_wasAlreadySynced') {
          itemPropertyCount++;
        }
      }

      expect(viewItem._meta).toEqual({
        addedToCollection: false
      });
      expect(itemPropertyCount).toBe(0);

      expect(testViewCollection.length).toBe(0);

      done();
    });

    it('should create a view item with data and metadata', function(
      done) {
      var viewItem = new ViewItem(testViewCollection, {
        name: 'Darth Vader',
        evil: true
      }, {
        rtId: 123,
        storeId: 123
      });

      var itemPropertyCount = 0;
      for (var item in viewItem) {
        if (viewItem.hasOwnProperty(item) && item !== '_meta' &&
          item !== 'getCollection' && item !== '_streams' &&
          item !== '_wasAlreadySynced') {
          itemPropertyCount++;
        }
      }

      expect(viewItem._meta).toEqual({
        rtId: 123,
        storeId: 123,
        addedToCollection: false
      });
      expect(itemPropertyCount).toBe(2);

      expect(testViewCollection.length).toBe(0);

      done();
    });

    it(
      'should create a view item that will add itself immediatly to its collection',
      function(done) {
        var viewItem = new ViewItem(testViewCollection, {}, {}, null, true);
        expect(testViewCollection.length).toBe(0);

        viewItem = new ViewItem(testViewCollection, {}, {
          rtId: 1000
        }, null, true);
        expect(testViewCollection.length).toBe(1);
        expect(testViewCollection[0]).toBe(viewItem);
        expect(testViewCollection._items[1000]).toBe(viewItem);
        expect(testViewCollection[0]._meta).toEqual({
          rtId: 1000,
          addedToCollection: true
        });

        done();
      });

    it('should save a new entry', function(done) {
      var viewItem = new ViewItem(testViewCollection, {});
      viewItem.name = 'Han Solo';
      viewItem.evil = false;

      expect(testViewCollection.length).toBe(0);
      expect(upStreamItems.length).toBe(0);

      viewItem.save();
      scheduler.start();

      expect(testViewCollection.length).toBe(1);
      expect(testViewCollection[0]).toBe(viewItem);
      expect(testViewCollection._items[1]).toBe(viewItem);

      expect(downStreamItems.length).toBe(0);
      expect(upStreamItems.length).toBe(1);
      expect(upStreamItems[0]).toEqual({
        data: {
          name: 'Han Solo',
          evil: false
        },
        meta: {
          transactionId: 1,
          rtId: 1,
          action: 'save'
        }
      });

      done();
    });

    it('should save an existing entry', function(done) {
      var viewItem = new ViewItem(testViewCollection, {
        name: 'Han Solo',
        evil: false
      }, {
        rtId: 123,
        serverId: 1000,
        storeId: 124
      });
      viewItem._meta.addedToCollection = true;
      testViewCollection.push(viewItem);
      testViewCollection._items[123] = viewItem;

      expect(testViewCollection.length).toBe(1);
      expect(upStreamItems.length).toBe(0);

      viewItem.save();
      scheduler.start();

      expect(testViewCollection.length).toBe(1);
      expect(testViewCollection[0]).toBe(viewItem);

      expect(downStreamItems.length).toBe(0);
      expect(upStreamItems.length).toBe(1);
      expect(upStreamItems[0]).toEqual({
        data: {
          name: 'Han Solo',
          evil: false
        },
        meta: {
          rtId: 123,
          serverId: 1000,
          storeId: 124,
          transactionId: 1,
          action: 'save'
        }
      });

      done();
    });

    it('should delete an entry', function(done) {
      var viewItem = new ViewItem(testViewCollection, {
        name: 'Han Solo',
        evil: false
      }, {
        rtId: 123
      });
      viewItem._meta.addedToCollection = true;
      testViewCollection.push(viewItem);
      testViewCollection._items[123] = viewItem;

      spyOn(viewItem._streams.saveDownStreamSub, 'dispose').and.stub();
      spyOn(viewItem._streams.deleteDownStreamSub, 'dispose').and.stub();

      expect(testViewCollection.length).toBe(1);
      expect(upStreamItems.length).toBe(0);

      viewItem.delete();
      scheduler.start();

      expect(testViewCollection.length).toBe(0);

      expect(viewItem._streams.saveDownStreamSub.dispose.calls.count())
        .toBe(
          1);
      expect(viewItem._streams.deleteDownStreamSub.dispose.calls.count())
        .toBe(
          1);
      expect(viewItem._meta.deleted).toBeTruthy();
      expect(downStreamItems.length).toBe(0);
      expect(upStreamItems.length).toBe(1);
      expect(upStreamItems[0]).toEqual({
        data: {
          name: 'Han Solo',
          evil: false
        },
        meta: {
          rtId: 123,
          transactionId: 1,
          action: 'delete'
        }
      });

      done();
    });

    it('should save an entry with additional data for the server', function(done) {
      var viewItem = new ViewItem(testViewCollection, {});
      viewItem.name = 'Han Solo';
      viewItem.evil = false;

      expect(testViewCollection.length).toBe(0);
      expect(upStreamItems.length).toBe(0);

      viewItem.save({
        credential: 'LeaCutie123'
      });

      scheduler.start();

      expect(testViewCollection.length).toBe(1);
      expect(testViewCollection[0]).toBe(viewItem);
      expect(testViewCollection._items[1]).toBe(viewItem);

      expect(downStreamItems.length).toBe(0);
      expect(upStreamItems.length).toBe(1);
      expect(upStreamItems[0]).toEqual({
        data: {
          name: 'Han Solo',
          evil: false
        },
        meta: {
          rtId: 1,
          action: 'save',
          transactionId: 1,
          serverData: {
            credential: 'LeaCutie123'
          }
        }
      });

      done();
    });

    it('should reset an entry', function(done) {
      spyOn(testViewCollection._model, 'getItem').and.stub();
      var viewItem = new ViewItem(testViewCollection, {
        name: 'Han Solo',
        evil: false
      }, {
        rtId: 123
      });

      viewItem.reset();

      expect(testViewCollection._model.getItem).toHaveBeenCalled();

      done();
    });

    it('should be updated from the downstream', function(done) {
      var viewItem = new ViewItem(testViewCollection, {
        name: 'Han Solo',
        evil: false
      }, {
        rtId: 123
      }, {});
      testViewCollection.push(viewItem);
      testViewCollection._items[123] = viewItem;

      var itemDownStreamItems = [];
      viewItem._streams.saveDownStream.subscribe(function(item) {
        itemDownStreamItems.push(item);
      });

      // Add first entry to the server downstream
      scheduler.scheduleWithAbsolute(1, function() {
        testViewCollection.downStream.onNext({
          data: {
            name: 'Han Solo',
            evil: false,
            relationshipStatus: 'married',
            spouse: 'Leia Organa'
          },
          meta: {
            rtId: 123,
            action: 'save'
          }
        });
      });

      // Add first and a half entry to the server downstream
      scheduler.scheduleWithAbsolute(5, function() {
        testViewCollection.downStream.onNext({
          data: {
            name: 'Han Solo',
            evil: false,
            relationshipStatus: 'married',
            spouse: 'Leia Organa'
          },
          meta: {
            rtId: 123,
            serverId: 1000,
            storeId: 124,
            action: 'save'
          }
        });
      });

      // Add second entry to the server downstream
      scheduler.scheduleWithAbsolute(10, function() {
        testViewCollection.downStream.onNext({
          data: {
            name: 'Darth Vader',
            evil: true,
            relationshipStatus: 'forever alone'
          },
          meta: {
            rtId: 125,
            action: 'save'
          }
        });
      });

      // Add second entry to the server downstream
      scheduler.scheduleWithAbsolute(20, function() {
        testViewCollection.downStream.onNext({
          data: {
            name: 'Han Solo',
            evil: false,
            relationshipStatus: 'married',
            spouse: 'Leia Organa'
          },
          meta: {
            rtId: 123,
            action: 'delete'
          }
        });
      });

      expect(viewItem.spouse).toBeUndefined();
      expect(viewItem.relationshipStatus).toBeUndefined();

      scheduler.start();

      expect(viewItem.spouse).toBe('Leia Organa');
      expect(viewItem.relationshipStatus).toBe('married');
      expect(viewItem._meta.serverId).toBe(1000);
      expect(viewItem._meta.storeId).toBe(124);

      expect(downStreamItems.length).toBe(4);
      expect(itemDownStreamItems.length).toBe(2);
      expect(itemDownStreamItems[1]).toEqual({
        data: {
          name: 'Han Solo',
          evil: false,
          relationshipStatus: 'married',
          spouse: 'Leia Organa'
        },
        meta: {
          rtId: 123,
          serverId: 1000,
          storeId: 124,
          action: 'save'
        }
      });

      done();
    });

    it('should be deleted from the downstream', function(done) {
      var viewItem = new ViewItem(testViewCollection, {
        name: 'Han Solo',
        evil: false
      }, {
        rtId: 123
      });
      viewItem._meta.addedToCollection = true;
      testViewCollection.push(viewItem);
      testViewCollection._items[123] = viewItem;

      spyOn(viewItem._streams.saveDownStreamSub, 'dispose').and.stub();
      spyOn(viewItem._streams.deleteDownStreamSub, 'dispose').and.stub();
      spyOn(viewItem, '_save').and.stub();

      var itemDownStreamItems = [];
      viewItem._streams.deleteDownStream.subscribe(function(item) {
        itemDownStreamItems.push(item);
      });

      // Add first entry to the server downstream
      scheduler.scheduleWithAbsolute(1, function() {
        testViewCollection.downStream.onNext({
          data: {
            name: 'Han Solo',
            evil: false,
            relationshipStatus: 'married',
            spouse: 'Leia Organa'
          },
          meta: {
            rtId: 123,
            action: 'save'
          }
        });
      });

      // Add second entry to the server downstream
      scheduler.scheduleWithAbsolute(10, function() {
        testViewCollection.downStream.onNext({
          data: {
            name: 'Darth Vader',
            evil: true,
            relationshipStatus: 'forever alone'
          },
          meta: {
            rtId: 125,
            action: 'save'
          }
        });
      });

      // Add second entry to the server downstream
      scheduler.scheduleWithAbsolute(20, function() {
        testViewCollection.downStream.onNext({
          data: {
            name: 'Han Solo',
            evil: false,
            relationshipStatus: 'married',
            spouse: 'Leia Organa'
          },
          meta: {
            rtId: 123,
            action: 'delete'
          }
        });
      });

      expect(viewItem.spouse).toBeUndefined();
      expect(viewItem.relationshipStatus).toBeUndefined();

      scheduler.start();

      expect(testViewCollection.length).toBe(0);

      expect(viewItem._streams.saveDownStreamSub.dispose.calls.count())
        .toBe(1);
      expect(viewItem._streams.deleteDownStreamSub.dispose.calls.count())
        .toBe(1);
      expect(viewItem._meta.deleted).toBeTruthy();

      expect(downStreamItems.length).toBe(3);
      expect(itemDownStreamItems.length).toBe(1);
      expect(itemDownStreamItems[0]).toEqual({
        data: {
          name: 'Han Solo',
          evil: false,
          relationshipStatus: 'married',
          spouse: 'Leia Organa'
        },
        meta: {
          rtId: 123,
          action: 'delete'
        }
      });

      done();
    });

    it('should add sub view collections after creation of item', function(done) {
      var injector = new Squire();
      injector.mock('ViewCollection', ViewCollectionMock);
      injector.require(['ViewItem'], function(ViewItem) {
        var subModel = {
          _modelName: 'testSub'
        };

        var viewItem = new ViewItem(testViewCollection, {
          name: 'Han Solo',
          evil: false
        }, {
          rtId: 123
        }, {
          'testSub': subModel
        });

        expect(viewItem.testSub instanceof Array).toBeTruthy();

        done();
      });
    });

    it('should add sub view collections after first save response', function(done) {
      var injector = new Squire();
      injector.mock('ViewCollection', ViewCollectionMock);
      injector.require(['ViewItem'], function(ViewItem) {

        var viewItem = new ViewItem(testViewCollection, {
          name: 'Han Solo',
          evil: false
        }, {
          rtId: 123
        });

        expect(viewItem.testSub).toBeUndefined();

        scheduler.scheduleWithAbsolute(1, function() {
          testViewCollection.downStream.onNext({
            data: {
              name: 'Han Solo',
              evil: false
            },
            meta: {
              rtId: 123,
              action: 'save'
            }
          });
        });

        scheduler.start();

        expect(viewItem._wasAlreadySynced).toBeTruthy();
        expect(viewItem.otherTestSub instanceof Array).toBeTruthy();

        done();
      });
    });

    it('should send a http function to the server', function(done) {
      var injector = new Squire();
      injector.mock('ViewCollection', ViewCollectionMock);
      injector.require(['ViewItem'], function(ViewItem) {
        var viewItem = new ViewItem(testViewCollection, {
          name: 'Han Solo',
          evil: false
        }, {
          serverId: 1234,
          rtId: 123
        });

        scheduler.scheduleWithAbsolute(1, function() {
          viewItem.callFn('carbonize', {
            place: 'Bespin'
          });
        });

        scheduler.start();

        expect(upStreamItems.length).toBe(1);
        expect(upStreamItems[0].meta.serverId).toBe(1234);
        expect(upStreamItems[0].meta.action).toBe('function');
        expect(upStreamItems[0].data.fnName).toBe('carbonize');
        expect(upStreamItems[0].data.fnArgs).toEqual({
          place: 'Bespin'
        });

        done();
      });
    });

  });
});
