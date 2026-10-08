import { describe, expect, it } from 'vitest';
import {
  filterLibraryTracks,
  normalizePreparation,
  normalizeTags,
} from './LibraryPreparation';

describe('library preparation', () => {
  it('normalizes metadata, tags and rating', () => {
    const prep = normalizePreparation('Track Name.wav', {
      rating: 7,
      tags: [' House ', 'house', 'Peak'],
      metadata: {
        title: 'Custom',
        artist: 'DJ Test',
        album: '',
        genre: 'House',
        key: '8A',
        comment: '',
      },
    }, 123);
    expect(prep.rating).toBe(5);
    expect(prep.tags).toEqual(['house', 'peak']);
    expect(prep.metadata.title).toBe('Custom');
    expect(prep.updatedAt).toBe(123);
  });

  it('normalizes tags deterministically', () => {
    expect(normalizeTags(['B', 'a', ' A ', ''])).toEqual(['a', 'b']);
  });

  it('filters search, crate, rating, tag and BPM', () => {
    const tracks = [
      {
        id: 'a',
        name: 'midnight.wav',
        preparation: normalizePreparation('midnight.wav', {
          rating: 5,
          tags: ['tribal', 'peak'],
          metadata: {
            title: 'Midnight Tribal',
            artist: 'Mountain Noir',
            album: '',
            genre: 'House',
            key: '8A',
            comment: 'late set',
          },
          grid: { bpm: 126, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 },
        }, 1),
      },
      {
        id: 'b',
        name: 'warmup.wav',
        preparation: normalizePreparation('warmup.wav', {
          rating: 3,
          tags: ['warmup'],
          grid: { bpm: 118, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 },
        }, 1),
      },
    ];

    expect(filterLibraryTracks(tracks, {
      text: 'mountain',
      crateTrackIds: ['a'],
      minimumRating: 4,
      tags: ['tribal'],
      preparedOnly: true,
      bpmMin: 124,
      bpmMax: 128,
    }).map((track) => track.id)).toEqual(['a']);
  });
});
