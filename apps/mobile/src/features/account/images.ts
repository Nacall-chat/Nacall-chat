import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { Profile } from '@nacall/core/types';
import { AVATAR_SIZE, COVER_HEIGHT, COVER_WIDTH, MAX_IMAGE_BYTES, avatarFilePath, coverCrop, coverFilePath, isGifBytes, squareCrop } from './logic';

type Picked = { uri: string; width: number; height: number; mimeType?: string | null; fileSize?: number | null };

/** Abre a galeria. Devolve null se a pessoa cancelou; lança erro em português se faltar permissão. */
async function pick(options: { editing: boolean; aspect?: [number, number] }): Promise<Picked | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Para escolher uma imagem, permita o acesso às fotos nos ajustes do celular.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: options.editing, aspect: options.aspect, quality: 1 });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

async function webp(picked: Picked, crop: { originX: number; originY: number; width: number; height: number }, width: number, height: number, compress: number) {
  const context = ImageManipulator.manipulate(picked.uri).crop(crop).resize({ width, height });
  const image = await context.renderAsync();
  return image.saveAsync({ format: SaveFormat.WEBP, compress });
}

async function bytesOf(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}

/** Troca a foto de perfil (recorte quadrado 256 px em WebP, como o site). Devolve false se cancelou. */
export async function changeAvatar(db: SupabaseClient, profile: Profile): Promise<boolean> {
  const picked = await pick({ editing: true, aspect: [1, 1] });
  if (!picked) return false;
  if (picked.fileSize && picked.fileSize > MAX_IMAGE_BYTES * 4) throw new Error('Use uma imagem de até 5 MB.');
  const out = await webp(picked, squareCrop(picked.width, picked.height), AVATAR_SIZE, AVATAR_SIZE, 0.85);
  const data = await bytesOf(out.uri);
  if (data.byteLength > MAX_IMAGE_BYTES) throw new Error('Use uma imagem de até 5 MB.');
  const path = avatarFilePath(profile.id, randomUUID());
  const uploaded = await db.storage.from('avatars').upload(path, data, { contentType: 'image/webp', cacheControl: '3600' });
  if (uploaded.error) throw uploaded.error;
  const saved = await db.from('profiles').update({ avatar_path: path }).eq('id', profile.id);
  if (saved.error) {
    await db.storage.from('avatars').remove([path]);
    throw saved.error;
  }
  if (profile.avatar_path) await db.storage.from('avatars').remove([profile.avatar_path]);
  return true;
}

/** Troca a capa: GIF vai como está (se for GIF de verdade); imagem vira 1200x400 em WebP com recorte central 3:1. */
export async function changeCover(db: SupabaseClient, profile: Profile): Promise<boolean> {
  const picked = await pick({ editing: false });
  if (!picked) return false;
  let data: ArrayBuffer;
  let ext: 'webp' | 'gif';
  if (picked.mimeType === 'image/gif') {
    data = await bytesOf(picked.uri);
    if (data.byteLength > MAX_IMAGE_BYTES) throw new Error('Use GIF, PNG, JPG ou WebP de até 5 MB.');
    if (!isGifBytes(new Uint8Array(data))) throw new Error('O arquivo não é um GIF válido.');
    ext = 'gif';
  } else {
    const out = await webp(picked, coverCrop(picked.width, picked.height), COVER_WIDTH, COVER_HEIGHT, 0.86);
    data = await bytesOf(out.uri);
    if (data.byteLength > MAX_IMAGE_BYTES) throw new Error('Use GIF, PNG, JPG ou WebP de até 5 MB.');
    ext = 'webp';
  }
  const path = coverFilePath(profile.id, randomUUID(), ext);
  const uploaded = await db.storage.from('profile-covers').upload(path, data, { contentType: ext === 'gif' ? 'image/gif' : 'image/webp' });
  if (uploaded.error) throw uploaded.error;
  const saved = await db.from('profiles').update({ cover_path: path }).eq('id', profile.id);
  if (saved.error) {
    await db.storage.from('profile-covers').remove([path]);
    throw saved.error;
  }
  if (profile.cover_path) await db.storage.from('profile-covers').remove([profile.cover_path]);
  return true;
}

export async function removeCover(db: SupabaseClient, profile: Profile): Promise<void> {
  const result = await db.from('profiles').update({ cover_path: '' }).eq('id', profile.id);
  if (result.error) throw result.error;
  if (profile.cover_path) await db.storage.from('profile-covers').remove([profile.cover_path]);
}
