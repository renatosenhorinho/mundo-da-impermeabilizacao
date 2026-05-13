/**
 * src/lib/image-resolver.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Runtime image utilities for product images.
 *
 * Responsibilities:
 *   • Provide a safe fallback chain for product images
 *   • Normalize image paths (ensure .webp is preferred)
 *   • Build consistent imagens[] arrays for the carousel
 *   • Cache-bust URLs after admin uploads
 *   • Handle the onError fallback pattern correctly
 *
 * NOTE: This module is purely runtime. File existence checks happen at build
 * time via scripts/validate-product-images.cjs. At runtime we rely on the
 * browser's native onError to catch any remaining broken images.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Product } from '@/data/products';

// ── Constants ─────────────────────────────────────────────────────────────────

export const PLACEHOLDER_IMAGE = '/images/products/placeholder.webp';

/** Extension priority order — prefer WebP for best performance */
const EXT_PRIORITY = ['.webp', '.jpg', '.jpeg', '.png'] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResolvedImage {
  /** Primary image URL (capa) */
  src: string;
  /** All carousel images, always at least 1 element */
  srcSet: string[];
  /** Whether the resolved image is a placeholder */
  isPlaceholder: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Strips the file extension from a path, preserving query strings.
 * @example stripExt('/images/products/foo.png?v=1') → '/images/products/foo?v=1'
 */
export function stripExt(filePath: string): string {
  if (!filePath) return filePath;
  const [base, ...query] = filePath.split('?');
  const cleanBase = base.replace(/\.(webp|jpe?g|png|svg)$/i, '');
  return query.length > 0 ? `${cleanBase}?${query.join('?')}` : cleanBase;
}

/**
 * Returns the .webp variant of any local image path.
 * If path is already .webp, or is an absolute URL (Supabase/CDN), blob:, or data:, it returns unchanged.
 * @example toWebpPath('/images/products/foo.jpg?v=1') → '/images/products/foo.webp?v=1'
 * @example toWebpPath('https://cdn.example.com/foo.jpg') → unchanged
 */
export function toWebpPath(filePath: string): string {
  if (!filePath) return filePath;
  // Don't mangle absolute URLs, blobs, or data URIs
  if (/^https?:\/\//i.test(filePath) || /^blob:/i.test(filePath) || /^data:/i.test(filePath)) {
    return filePath;
  }
  // If already webp (ignoring query strings)
  const base = filePath.split('?')[0];
  if (/\.webp$/i.test(base)) return filePath;
  
  // Convert extension to .webp preserving query
  const parts = filePath.split('?');
  const cleanBase = parts[0].replace(/\.(webp|jpe?g|png|svg)$/i, '');
  return parts.length > 1 ? `${cleanBase}.webp?${parts.slice(1).join('?')}` : `${cleanBase}.webp`;
}

/**
 * Appends a cache-buster timestamp query param to a URL.
 * Used after admin uploads to ensure the browser fetches the new image.
 * @example withCacheBust('/images/products/foo.webp') → '/images/products/foo.webp?v=1715523600000'
 */
export function withCacheBust(url: string): string {
  const ts = Date.now();
  return url.includes('?') ? `${url}&v=${ts}` : `${url}?v=${ts}`;
}

/**
 * Removes any existing cache-bust param from a URL.
 * @example clearCacheBust('/images/products/foo.webp?v=123') → '/images/products/foo.webp'
 */
export function clearCacheBust(url: string): string {
  return url.replace(/[?&]v=\d+/, '');
}

// ── Core resolver ─────────────────────────────────────────────────────────────

/**
 * Resolves the definitive image data for a product.
 *
 * Priority:
 *   1. product.imagens[] (if non-empty and not all placeholders)
 *   2. product.imagem (single image → carousel with 1 item)
 *   3. PLACEHOLDER_IMAGE as final safe fallback
 *
 * The returned `src` is always the .webp preferred version of the capa image.
 * The returned `srcSet` always has at least one element.
 */
export function resolveProductImage(product: Pick<Product, 'imagem' | 'imagens'>): ResolvedImage {
  const rawImagem  = product.imagem  ?? '';
  const rawImagens = product.imagens ?? [];

  // Build candidate arrays — filter out any undefined/null entries
  const validImagens = rawImagens
    .filter((img): img is string => typeof img === 'string' && img.trim() !== '')
    .filter(img => img !== PLACEHOLDER_IMAGE);

  const validImagem = typeof rawImagem === 'string' && rawImagem.trim() !== ''
    ? rawImagem
    : null;

  // ── Case 1: Use imagem if it's a real image (PRIMARY) ─────────────────────
  if (validImagem && validImagem !== PLACEHOLDER_IMAGE) {
    const capa = toWebpPath(validImagem);
    const mappedImagens = validImagens.map(toWebpPath).filter(v => v !== capa);
    return {
      src          : capa,
      srcSet       : [capa, ...mappedImagens],
      isPlaceholder: false,
    };
  }

  // ── Case 2: Use imagens[0] if no main imagem is set ───────────────────────
  if (validImagens.length > 0) {
    const capa = toWebpPath(validImagens[0]);
    return {
      src          : capa,
      srcSet       : validImagens.map(toWebpPath),
      isPlaceholder: false,
    };
  }

  // ── Case 3: Fallback to placeholder ──────────────────────────────────────
  return {
    src          : PLACEHOLDER_IMAGE,
    srcSet       : [PLACEHOLDER_IMAGE],
    isPlaceholder: true,
  };
}

// ── onError handler factory ───────────────────────────────────────────────────

/**
 * Returns a memoised onError handler for <img> elements.
 * Replaces a broken image with the placeholder exactly once
 * (prevents infinite error loop if placeholder itself is missing).
 *
 * @example
 * <img src={src} onError={createImageErrorHandler()} />
 */
export function createImageErrorHandler() {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // Guard: don't loop if placeholder is also broken
    if (img.src.includes('placeholder')) return;
    img.src = PLACEHOLDER_IMAGE;
  };
}

// ── Admin upload helper ───────────────────────────────────────────────────────

/**
 * Normalises an uploaded filename for consistent storage.
 *
 * Rules:
 *   - lowercase
 *   - spaces and special chars → hyphens
 *   - multiple hyphens → single hyphen
 *   - forces .webp extension
 *
 * @example
 * normalizeUploadedFilename('Minha Foto (1).PNG') → 'minha-foto-1.webp'
 */
export function normalizeUploadedFilename(originalName: string): string {
  const noExt = originalName.replace(/\.[^.]+$/, '');
  const slug  = noExt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove diacritics
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanum → hyphen
    .replace(/^-+|-+$/g, '');          // trim edge hyphens
  return `${slug}.webp`;
}

/**
 * Builds the canonical web path for a product image given category and filename.
 * @example
 * buildProductImagePath('manta-asfaltica', 'manta-vedacit-3mm.webp')
 * → '/images/products/manta-asfaltica/manta-vedacit-3mm.webp'
 */
export function buildProductImagePath(categoria: string, filename: string): string {
  return `/images/products/${categoria}/${filename}`;
}
