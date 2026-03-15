import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

export type EntityImageType = 'item' | 'subscription' | 'stored_card';

const IMAGE_ROOT_DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}entity-images`
  : null;

function ensureImageRootDir(): string {
  if (!IMAGE_ROOT_DIR) {
    throw new Error('当前平台不支持本地图片存储');
  }
  return IMAGE_ROOT_DIR;
}

function getFileExtension(uri: string): string {
  const cleanUri = uri.split('?')[0] ?? uri;
  const matched = cleanUri.match(/(\.[a-zA-Z0-9]+)$/);
  return matched ? matched[1].toLowerCase() : '.jpg';
}

function buildNextImageUri(type: EntityImageType, sourceUri: string): string {
  const rootDir = ensureImageRootDir();
  const ext = getFileExtension(sourceUri);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  return `${rootDir}/${type}/${fileName}`;
}

export function isManagedEntityImageUri(uri: string | null | undefined): boolean {
  if (!uri || !IMAGE_ROOT_DIR) return false;
  return uri.startsWith(IMAGE_ROOT_DIR);
}

export async function pickEntityImageFromLibraryAsync(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('请先允许访问相册，才能为记录上传图片');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    defaultTab: 'photos',
    quality: 1,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  return result.assets[0].uri;
}

export async function deleteEntityImageAsync(uri: string | null | undefined): Promise<void> {
  if (!uri || !isManagedEntityImageUri(uri) || Platform.OS === 'web') {
    return;
  }

  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

export async function deleteAllEntityImagesAsync(): Promise<void> {
  if (!IMAGE_ROOT_DIR || Platform.OS === 'web') {
    return;
  }

  const info = await FileSystem.getInfoAsync(IMAGE_ROOT_DIR);
  if (info.exists) {
    await FileSystem.deleteAsync(IMAGE_ROOT_DIR, { idempotent: true });
  }
}

async function ensureEntityDirectoryAsync(type: EntityImageType): Promise<void> {
  if (Platform.OS === 'web') return;
  const rootDir = ensureImageRootDir();
  await FileSystem.makeDirectoryAsync(`${rootDir}/${type}`, { intermediates: true });
}

async function persistPickedImageAsync(
  sourceUri: string,
  type: EntityImageType,
): Promise<string> {
  if (Platform.OS === 'web') {
    return sourceUri;
  }

  await ensureEntityDirectoryAsync(type);
  const destinationUri = buildNextImageUri(type, sourceUri);
  await FileSystem.copyAsync({
    from: sourceUri,
    to: destinationUri,
  });
  return destinationUri;
}

export async function resolveEntityImageForSaveAsync(params: {
  currentImageUri: string | null;
  nextImageUri: string | null;
  type: EntityImageType;
}): Promise<string | null> {
  const { currentImageUri, nextImageUri, type } = params;

  if (!nextImageUri) {
    await deleteEntityImageAsync(currentImageUri);
    return null;
  }

  if (nextImageUri === currentImageUri) {
    return currentImageUri;
  }

  const savedUri = await persistPickedImageAsync(nextImageUri, type);
  await deleteEntityImageAsync(currentImageUri);
  return savedUri;
}
