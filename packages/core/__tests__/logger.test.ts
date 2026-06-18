import { describe, it, expect, vi } from 'vitest';
import { Logger } from '../src/logger';

describe('Logger', () => {
  it('should create logger with module name', () => {
    const logger = new Logger('TestModule');
    expect(logger).toBeDefined();
  });

  it('should respect log level', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = new Logger('Test', 'warn');
    logger.debug('should not appear');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should output info messages', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new Logger('Test', 'info');
    logger.info('test message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
