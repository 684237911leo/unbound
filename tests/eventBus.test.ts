import { describe, it, expect, vi } from 'vitest';
import { EventBus, type GameEvents } from '../src/core/EventBus';

describe('EventBus', () => {
  it('delivers emitted payloads to subscribers', () => {
    const bus = new EventBus<GameEvents>();
    const listener = vi.fn();
    bus.on('gold:changed', listener);
    bus.emit('gold:changed', { gold: 42 });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ gold: 42 });
  });

  it('supports multiple listeners per event and separate event channels', () => {
    const bus = new EventBus<GameEvents>();
    const a = vi.fn();
    const b = vi.fn();
    const flag = vi.fn();
    bus.on('gold:changed', a);
    bus.on('gold:changed', b);
    bus.on('flag:set', flag);
    bus.emit('gold:changed', { gold: 1 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(flag).not.toHaveBeenCalled();
  });

  it('does nothing when emitting an event without listeners', () => {
    const bus = new EventBus<GameEvents>();
    expect(() => bus.emit('flag:set', { key: 'x', value: true })).not.toThrow();
  });

  it('stops delivering after off()', () => {
    const bus = new EventBus<GameEvents>();
    const listener = vi.fn();
    bus.on('flag:set', listener);
    bus.off('flag:set', listener);
    bus.emit('flag:set', { key: 'x', value: true });
    expect(listener).not.toHaveBeenCalled();
  });

  it('off() only removes the given listener', () => {
    const bus = new EventBus<GameEvents>();
    const keep = vi.fn();
    const drop = vi.fn();
    bus.on('gold:changed', keep);
    bus.on('gold:changed', drop);
    bus.off('gold:changed', drop);
    bus.emit('gold:changed', { gold: 5 });
    expect(keep).toHaveBeenCalledTimes(1);
    expect(drop).not.toHaveBeenCalled();
  });

  it('off() on an unknown event or unknown listener is a no-op', () => {
    const bus = new EventBus<GameEvents>();
    expect(() => bus.off('gold:changed', vi.fn())).not.toThrow();
  });

  it('allows a listener to unsubscribe itself during emit', () => {
    const bus = new EventBus<GameEvents>();
    const second = vi.fn();
    const first = vi.fn(() => bus.off('gold:changed', first));
    bus.on('gold:changed', first);
    bus.on('gold:changed', second);
    bus.emit('gold:changed', { gold: 1 });
    bus.emit('gold:changed', { gold: 2 });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('exports a usable singleton', async () => {
    const { eventBus } = await import('../src/core/EventBus');
    const listener = vi.fn();
    eventBus.on('gold:changed', listener);
    eventBus.emit('gold:changed', { gold: 7 });
    eventBus.off('gold:changed', listener);
    expect(listener).toHaveBeenCalledWith({ gold: 7 });
  });
});
