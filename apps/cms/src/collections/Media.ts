import type { CollectionConfig } from 'payload'

import { anyone, isAdmin, isStaff } from '../lib/access'

/**
 * What an upload may be. Raster images and PDFs only: no SVG, because an SVG
 * served from the CMS's own origin can carry script, and the admin lives on
 * that origin.
 */
export const MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'application/pdf']

/** Largest upload accepted, in bytes (enforced by Payload's body parser). */
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024

/**
 * The root config's `upload` options. abortOnLimit matters: without it the
 * parser stops reading at the limit and Payload stores the file truncated.
 * With it, an upload over the limit is refused (413) and nothing is stored.
 */
export const MEDIA_UPLOAD_OPTIONS = {
  limits: { fileSize: MEDIA_MAX_BYTES },
  abortOnLimit: true,
  responseOnLimit: 'Files are limited to 10 MiB.',
}

// Images and documents for pages and posts, stored in the CMS's R2 bucket
// (R2_MEDIA, infra/terraform/cloudflare-r2-cms) by @payloadcms/storage-r2 and
// served back by Payload at /api/media/file/<filename>. Readable by anyone,
// like the published content that embeds them.
export const Media: CollectionConfig = {
  slug: 'media',
  admin: { useAsTitle: 'alt', defaultColumns: ['filename', 'alt', 'mimeType', 'filesize'] },
  access: { read: anyone, create: isStaff, update: isStaff, delete: isAdmin },
  upload: {
    mimeTypes: MEDIA_MIME_TYPES,
    // workerd has no sharp: no resizing, cropping or focal point. A file is
    // stored and served as uploaded.
    crop: false,
    focalPoint: false,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: { description: 'Describes the image for people who cannot see it.' },
    },
  ],
}
