import { describe, it, expect } from 'vitest';
import { harmonyAngles, HARMONY_TYPES } from '../src/utils/harmonies';

describe('harmonyAngles', () => {
  describe('Complementary', () => {
    it('should return 2 angles 180° apart', () => {
      const result = harmonyAngles(0, 'Complementary');
      expect(result).toHaveLength(2);
      expect(result[0].a).toBe(0);
      expect(result[1].a).toBe(180);
    });

    it('should wrap correctly', () => {
      const result = harmonyAngles(270, 'Complementary');
      expect(result[0].a).toBe(270);
      expect(result[1].a).toBe(90);
    });
  });

  describe('Split Complementary', () => {
    it('should return 3 angles', () => {
      const result = harmonyAngles(0, 'Split Complementary');
      expect(result).toHaveLength(3);
      expect(result[0].label).toBe('Base');
      expect(result[1].label).toBe('Split-1');
      expect(result[2].label).toBe('Split-2');
    });

    it('should have splits 30° from complement', () => {
      const result = harmonyAngles(0, 'Split Complementary');
      expect(result[0].a).toBe(0);
      expect(result[1].a).toBe(150); // 180 - 30
      expect(result[2].a).toBe(210); // 180 + 30
    });
  });

  describe('Analogous', () => {
    it('should return 3 angles 30° apart', () => {
      const result = harmonyAngles(60, 'Analogous');
      expect(result).toHaveLength(3);
      expect(result[0].a).toBe(30);  // 60 - 30
      expect(result[1].a).toBe(60);  // base
      expect(result[2].a).toBe(90);  // 60 + 30
    });

    it('should wrap correctly at boundaries', () => {
      const result = harmonyAngles(10, 'Analogous');
      expect(result[0].a).toBe(340); // 10 - 30 = -20 -> 340
      expect(result[1].a).toBe(10);
      expect(result[2].a).toBe(40);
    });
  });

  describe('Triadic', () => {
    it('should return 3 angles 120° apart', () => {
      const result = harmonyAngles(0, 'Triadic');
      expect(result).toHaveLength(3);
      expect(result[0].a).toBe(0);
      expect(result[1].a).toBe(120);
      expect(result[2].a).toBe(240);
    });

    it('should wrap correctly', () => {
      const result = harmonyAngles(300, 'Triadic');
      expect(result[0].a).toBe(300);
      expect(result[1].a).toBe(60);  // 300 + 120 = 420 -> 60
      expect(result[2].a).toBe(180); // 300 + 240 = 540 -> 180
    });
  });

  describe('Tetradic', () => {
    it('should return 4 angles in rectangle pattern', () => {
      const result = harmonyAngles(0, 'Tetradic');
      expect(result).toHaveLength(4);
      expect(result[0].a).toBe(0);
      expect(result[1].a).toBe(60);
      expect(result[2].a).toBe(180);
      expect(result[3].a).toBe(240);
    });
  });
});

describe('HARMONY_TYPES', () => {
  it('should contain all harmony types', () => {
    expect(HARMONY_TYPES).toContain('Complementary');
    expect(HARMONY_TYPES).toContain('Split Complementary');
    expect(HARMONY_TYPES).toContain('Analogous');
    expect(HARMONY_TYPES).toContain('Triadic');
    expect(HARMONY_TYPES).toContain('Tetradic');
    expect(HARMONY_TYPES).toHaveLength(5);
  });
});
