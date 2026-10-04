import { describe, expect, it } from 'vitest';
import { getBusyButtonLabel } from './busy';

describe('busy operation labels', () => {
  it('keeps the normal label when idle', () => {
    expect(getBusyButtonLabel('Compare shopping', false, 'Comparing stores…')).toBe('Compare shopping');
  });

  it('shows the operation-specific progress label while busy', () => {
    expect(getBusyButtonLabel('Compare shopping', true, 'Comparing stores…')).toBe('Comparing stores…');
  });
});
