import type { BeatGrid } from '../music/MusicalClock';

export interface LibraryTrackMetadata {
  title: string;
  artist: string;
  album: string;
  genre: string;
  key: string;
  comment: string;
}

export interface LibraryLoopPreparation {
  startFrame: number;
  endFrame: number;
  enabled: boolean;
}

export interface LibraryTrackPreparation {
  metadata: LibraryTrackMetadata;
  rating: number;
  tags: string[];
  grid?: BeatGrid;
  cueFrame?: number | null;
  hotCues?: Array<number | null>;
  loop?: LibraryLoopPreparation | null;
  updatedAt: number;
}

export interface LibrarySearchableTrack {
  id: string;
  name: string;
  preparation?: LibraryTrackPreparation;
}

export interface LibraryQuery {
  text?: string;
  crateTrackIds?: string[];
  minimumRating?: number;
  tags?: string[];
  preparedOnly?: boolean;
  bpmMin?: number;
  bpmMax?: number;
}

export function defaultTrackMetadata(name: string): LibraryTrackMetadata {
  const base = name.replace(/\.[^.]+$/, '');
  return {
    title: base,
    artist: '',
    album: '',
    genre: '',
    key: '',
    comment: '',
  };
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

export function normalizePreparation(
  name: string,
  preparation: Partial<LibraryTrackPreparation>,
  now = Date.now(),
): LibraryTrackPreparation {
  const metadata = {
    ...defaultTrackMetadata(name),
    ...(preparation.metadata ?? {}),
  };
  const rating = Math.max(0, Math.min(5, Math.round(preparation.rating ?? 0)));
  const hotCues = preparation.hotCues?.map((frame) => frame === null ? null : Math.max(0, Math.round(frame)));
  return {
    metadata,
    rating,
    tags: normalizeTags(preparation.tags ?? []),
    ...(preparation.grid ? { grid: { ...preparation.grid } } : {}),
    ...(preparation.cueFrame === undefined
      ? {}
      : { cueFrame: preparation.cueFrame === null ? null : Math.max(0, Math.round(preparation.cueFrame)) }),
    ...(hotCues ? { hotCues } : {}),
    ...(preparation.loop === undefined
      ? {}
      : { loop: preparation.loop === null ? null : { ...preparation.loop } }),
    updatedAt: preparation.updatedAt ?? now,
  };
}

export function filterLibraryTracks<T extends LibrarySearchableTrack>(
  tracks: T[],
  query: LibraryQuery,
): T[] {
  const text = query.text?.trim().toLowerCase() ?? '';
  const crateIds = query.crateTrackIds ? new Set(query.crateTrackIds) : null;
  const tags = normalizeTags(query.tags ?? []);

  return tracks.filter((track) => {
    const prep = track.preparation;
    if (crateIds && !crateIds.has(track.id)) return false;
    if (query.preparedOnly && !prep) return false;
    if ((prep?.rating ?? 0) < (query.minimumRating ?? 0)) return false;
    if (tags.length > 0 && !tags.every((tag) => prep?.tags.includes(tag))) return false;

    const bpm = prep?.grid?.bpm;
    if (query.bpmMin !== undefined && (bpm === undefined || bpm < query.bpmMin)) return false;
    if (query.bpmMax !== undefined && (bpm === undefined || bpm > query.bpmMax)) return false;

    if (!text) return true;
    const haystack = [
      track.name,
      prep?.metadata.title,
      prep?.metadata.artist,
      prep?.metadata.album,
      prep?.metadata.genre,
      prep?.metadata.key,
      prep?.metadata.comment,
      ...(prep?.tags ?? []),
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(text);
  });
}
