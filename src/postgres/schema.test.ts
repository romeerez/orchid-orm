import { dataTypes } from './schema';

describe('postgres dataTypes', () => {
  describe('bigint', () => {
    it('should have correct data type', () => {
      expect(dataTypes.bigint().dataType).toBe('bigint')
    })
  })

  describe('bigserial', () => {
    it('should have correct data type', () => {
      expect(dataTypes.bigserial().dataType).toBe('bigserial')
    })
  })

  describe('boolean', () => {
    it('should have correct data type', () => {
      expect(dataTypes.boolean().dataType).toBe('boolean')
    })
  })

  describe('date', () => {
    it('should have correct data type', () => {
      expect(dataTypes.date().dataType).toBe('date')
    })
  })

  describe('decimal', () => {
    it('should have correct data type', () => {
      expect(dataTypes.decimal().dataType).toBe('decimal')
    })
  })

  describe('float', () => {
    it('should have correct data type', () => {
      expect(dataTypes.float().dataType).toBe('float')
    })
  })

  describe('integer', () => {
    it('should have correct data type', () => {
      expect(dataTypes.integer().dataType).toBe('integer')
    })
  })

  describe('text', () => {
    it('should have correct data type', () => {
      expect(dataTypes.text().dataType).toBe('text')
    })
  })

  describe('string', () => {
    it('should have correct data type', () => {
      expect(dataTypes.string().dataType).toBe('text')
    })
  })

  describe('smallint', () => {
    it('should have correct data type', () => {
      expect(dataTypes.smallint().dataType).toBe('smallint')
    })
  })

  describe('smallserial', () => {
    it('should have correct data type', () => {
      expect(dataTypes.smallserial().dataType).toBe('smallserial')
    })
  })

  describe('time', () => {
    it('should have correct data type', () => {
      expect(dataTypes.time().dataType).toBe('time')
    })
  })

  describe('timestamp', () => {
    it('should have correct data type', () => {
      expect(dataTypes.timestamp().dataType).toBe('timestamp')
    })
  })

  describe('timestamptz', () => {
    it('should have correct data type', () => {
      expect(dataTypes.timestamptz().dataType).toBe('timestamptz')
    })
  })

  describe('binary', () => {
    it('should have correct data type', () => {
      expect(dataTypes.binary().dataType).toBe('binary')
    })
  })

  describe('serial', () => {
    it('should have correct data type', () => {
      expect(dataTypes.serial().dataType).toBe('serial')
    })
  })
});
