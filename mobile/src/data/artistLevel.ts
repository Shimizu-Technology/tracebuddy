import type { ArtLevel } from './catalog'
import { readLocalSetting, writeLocalSetting } from './nativeStorage'
import { whoIsDrawingKey } from './storageKeys'

export async function readArtistLevel(): Promise<ArtLevel | null> {
  const value = await readLocalSetting(whoIsDrawingKey)
  return value === 'simple' || value === 'detailed' ? value : null
}

export function writeArtistLevel(level: ArtLevel) {
  return writeLocalSetting(whoIsDrawingKey, () => level, () => true)
}
