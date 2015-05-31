describe('Harmonized', function() {

  describe('createStreamItem', function() {
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
    });

    it('should create a stream item with half metadata', function() {
      inputItem._id = '1234';
      expectedStreamItem.meta.storeId = '1234';

      var streamItem = Harmonized._createStreamItem(inputItem, keys);

      expect(streamItem).toEqual(expectedStreamItem);
      expect(streamItem.data).not.toEqual(inputItem);
    });

    it('should create a stream item with no metadata', function() {
      var streamItem = Harmonized._createStreamItem(inputItem, keys);

      expect(streamItem).toEqual(expectedStreamItem);
      expect(streamItem.data).toEqual(inputItem);
    });

  });

});
