import crypto from 'crypto';

/**
 * Perform an unbiased Fisher-Yates (Knuth) shuffle on an array.
 * Uses cryptographically secure random integers to guarantee uniform distribution without bias.
 * Returns a new shuffled array (non-mutating).
 *
 * @template T
 * @param {T[]} array - The array to shuffle
 * @returns {T[]} - A new shuffled copy of the input array
 */
export function fisherYatesShuffle(array) {
  if (!Array.isArray(array)) {
    throw new TypeError('fisherYatesShuffle expects an array as input');
  }

  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    // Generate secure random integer in range [0, i] inclusive
    const j = crypto.randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
