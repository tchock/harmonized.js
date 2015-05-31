describe('DbHandler', function() {

  var dbHandler;
  var explicitDbHandler = {
    _connectionStream: new Rx.Subject(),
    connect: function() {}
  };

  beforeEach(function() {
    // webStorage mock
    spyOn(Harmonized, 'getWebStorage').and.returnValue(mockLocalStorage);
    window.mockLocalStorageObj = {};

    // Set key mocks
    spyOn(Harmonized, 'getStoreKey').and.returnValue('_id');
    spyOn(Harmonized, 'getServerKey').and.returnValue('id');

    dbHandler = new Harmonized.DbHandler(explicitDbHandler, 'testStore');
  });

  it('should get empty DB metadata', function() {
    expect(dbHandler.getMetadata()).toEqual({});
  });

  it('should get DB metadata with data', function() {
    var expectedObject = {
      hey: 'you'
    };

    window.mockLocalStorageObj = {
      'harmonized_meta_testStore': expectedObject
    };

    dbHandler = new Harmonized.DbHandler(explicitDbHandler, 'testStore');
    expect(dbHandler.getMetadata()).toEqual(expectedObject);
  });

  it('should write into empty DB metadata', function() {
    var expectedObject = {
      name: 'John Doe'
    };

    dbHandler.setMetadata('name', 'John Doe');
    expect(dbHandler._metadata).toEqual(expectedObject);
    expect(window.mockLocalStorageObj).toEqual({
      'harmonized_meta_testStore': expectedObject
    });
  });

  it('should add to already existing DB metadata', function() {
    window.mockLocalStorageObj = {
      'harmonized_meta_testStore': {
        'name': 'John Doe'
      }
    };

    var expectedObject = {
      name: 'John Doe',
      otherName: 'Max Mustermann'
    };

    dbHandler = new Harmonized.DbHandler(explicitDbHandler, 'testStore');
    dbHandler.setMetadata('otherName', 'Max Mustermann');
    expect(dbHandler._metadata).toEqual(expectedObject);
    expect(window.mockLocalStorageObj).toEqual({
      'harmonized_meta_testStore': expectedObject
    });
  });

  it('should create create a db item with full metadata', function() {
    var inputItem = {
      data: {
        firstName: 'John',
        lastName: 'Doe'
      },
      meta: {
        storeId: 123,
        serverId: 321
      }
    };

    var expectedOutputItem = _.clone(inputItem.data);
    expectedOutputItem._id = 123;
    expectedOutputItem.id = 321;
    var outputItem = dbHandler._createDbItem(inputItem);

    expect(outputItem).toEqual(expectedOutputItem);
    expect(outputItem).not.toEqual(inputItem.data);
    expect(outputItem).not.toBe(inputItem.data);
  });

  it('should create create a db item with one missing metadata', function() {
    var inputItem = {
      data: {
        firstName: 'John',
        lastName: 'Doe'
      },
      meta: {
        serverId: 321
      }
    };

    var expectedOutputItem = _.clone(inputItem.data);
    expectedOutputItem.id = 321;

    var outputItem = dbHandler._createDbItem(inputItem);
    expect(outputItem).toEqual(expectedOutputItem);
    expect(outputItem).not.toEqual(inputItem.data);
    expect(outputItem).not.toBe(inputItem.data);
  });

  it('should create create a db item with whole missing metadata', function() {
    var inputItem = {
      data: {
        firstName: 'John',
        lastName: 'Doe'
      }
    };

    var expectedOutputItem = _.clone(inputItem.data);

    var outputItem = dbHandler._createDbItem(inputItem);
    expect(outputItem).toEqual(expectedOutputItem);
    expect(outputItem).toEqual(inputItem.data);
    expect(outputItem).not.toBe(inputItem.data);
  });

});
