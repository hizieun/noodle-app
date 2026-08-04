// 리뷰 사진 업로드 — 클라이언트 리사이즈·압축 후 Supabase Storage에 저장.
// 무료 티어 용량·전송 절약을 위해 원본이 아니라 축소본(WebP)을 올린다.
import { supabase } from './supabase.js';

const BUCKET = 'review-photos';
export const MAX_PHOTOS = 3;
export const MAX_FILE_MB = 12; // 압축 전 원본 상한 (초대형 방지)
const MAX_DIM = 1600;          // 긴 변 최대 픽셀
const QUALITY = 0.8;

// 캔버스로 축소·압축. WebP 우선, 미지원 브라우저는 JPEG 폴백.
async function compress(file) {
  // imageOrientation: 폰 사진 EXIF 회전 반영
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  let blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', QUALITY));
  let ext = 'webp';
  if (!blob) {
    blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', QUALITY));
    ext = 'jpg';
  }
  return { blob, ext };
}

// File → 공개 URL. userId 폴더에 저장(스토리지 RLS가 본인 폴더만 허용).
// idx는 같은 밀리초 업로드 충돌 방지용(Math.random 회피).
export async function uploadReviewPhoto(file, userId, idx) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`이미지는 ${MAX_FILE_MB}MB 이하만 올릴 수 있어요.`);
  }
  const { blob, ext } = await compress(file);
  const path = `${userId}/${Date.now()}-${idx}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// 공개 URL에서 스토리지 경로 추출 → 삭제(리뷰 삭제 시 best-effort 정리).
export async function deleteReviewPhotos(urls) {
  if (!urls?.length || !supabase) return;
  const marker = `/${BUCKET}/`;
  const paths = urls
    .map((u) => { const i = u.indexOf(marker); return i === -1 ? null : u.slice(i + marker.length); })
    .filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}
