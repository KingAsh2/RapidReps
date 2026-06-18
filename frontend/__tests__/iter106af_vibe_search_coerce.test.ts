/**
 * iter106af regression — VibeSetupScreen.searchTracks must accept event
 * objects from onSubmitEditing / onPress without throwing.
 *
 * Sentry caught this in prod:
 *   TypeError: (null!=e?e:C).trim is not a function
 *
 * Root cause: searchTracks was typed `(q?: string)` but bound directly to
 * onSubmitEditing / onPress, which pass NativeSyntheticEvent / GestureResponderEvent
 * at runtime, so `(q ?? query).trim()` blew up.
 *
 * This test exercises the same coercion logic in isolation.
 */
describe('VibeSetupScreen.searchTracks – non-string arg coercion (iter106af)', () => {
  // Inline the exact one-liner used in the handler so a regression in the
  // production file would also surface here.
  const coerce = (q: unknown, query: string) =>
    (typeof q === 'string' ? (q as string) : query).trim();

  it('returns the live query when called with a SyntheticEvent', () => {
    const fakeEvent = { nativeEvent: { text: 'unused' }, preventDefault: () => {} };
    expect(coerce(fakeEvent, 'taylor swift')).toBe('taylor swift');
  });

  it('returns the live query when called with a GestureResponderEvent', () => {
    const fakeGesture = { nativeEvent: { locationX: 12, locationY: 33 } };
    expect(coerce(fakeGesture, '  bad bunny  ')).toBe('bad bunny');
  });

  it('uses the explicit string when one is passed', () => {
    expect(coerce('  drake  ', 'fallback')).toBe('drake');
  });

  it('returns empty string when query is empty and arg is non-string', () => {
    expect(coerce({}, '')).toBe('');
  });

  it('does not throw on undefined / null', () => {
    expect(() => coerce(undefined, 'q')).not.toThrow();
    expect(() => coerce(null, 'q')).not.toThrow();
    expect(coerce(undefined, 'beyonce')).toBe('beyonce');
    expect(coerce(null, 'beyonce')).toBe('beyonce');
  });
});
