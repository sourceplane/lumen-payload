import { Media, MEDIA_MAX_BYTES, MEDIA_MIME_TYPES, MEDIA_UPLOAD_OPTIONS } from '@cms/collections/Media'
import { MISSING_MEDIA_BUCKET_MESSAGE, mediaBucketFrom, missingMediaBucket } from '@cms/lib/media-bucket'

// Media (lumen-payload-cms PC4): uploads in the CMS's R2 bucket, served back
// by Payload. Who may do what, what may be uploaded, and what happens when the
// Worker has no bucket.

type AnyAccess = (args: { req: { user: unknown } }) => unknown
const call = (fn: unknown, user: unknown) => (fn as AnyAccess)({ req: { user } })

const anon = null
const admin = { id: 'a1', collection: 'users', role: 'admin' }
const editor = { id: 'e1', collection: 'users', role: 'editor' }

describe('media collection', () => {
  it('is an upload collection named media', () => {
    expect(Media.slug).toBe('media')
    expect(Media.upload).toBeTruthy()
  })

  it('anyone reads media, like the published content that embeds it', () => {
    expect(call(Media.access!.read, anon)).toBe(true)
  })

  it('staff upload and edit; only admins delete', () => {
    expect(call(Media.access!.create, anon)).toBe(false)
    expect(call(Media.access!.create, editor)).toBe(true)
    expect(call(Media.access!.update, anon)).toBe(false)
    expect(call(Media.access!.update, editor)).toBe(true)
    expect(call(Media.access!.delete, editor)).toBe(false)
    expect(call(Media.access!.delete, admin)).toBe(true)
  })

  it('accepts raster images and PDFs, never SVG (script on the admin origin)', () => {
    const upload = Media.upload as { mimeTypes: string[] }
    expect(upload.mimeTypes).toEqual(MEDIA_MIME_TYPES)
    expect(MEDIA_MIME_TYPES).toEqual(expect.arrayContaining(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']))
    expect(MEDIA_MIME_TYPES.some((t) => t.includes('svg') || t.endsWith('/*'))).toBe(false)
  })

  it('stores files as uploaded: no resizing on workerd (no sharp)', () => {
    const upload = Media.upload as { crop?: boolean; focalPoint?: boolean; imageSizes?: unknown[] }
    expect(upload.crop).toBe(false)
    expect(upload.focalPoint).toBe(false)
    expect(upload.imageSizes).toBeUndefined()
  })

  it('requires alt text', () => {
    const alt = Media.fields.find((f) => 'name' in f && f.name === 'alt') as { required?: boolean } | undefined
    expect(alt?.required).toBe(true)
  })

  it('refuses an upload over 10 MiB instead of storing it truncated', () => {
    expect(MEDIA_MAX_BYTES).toBe(10 * 1024 * 1024)
    expect(MEDIA_UPLOAD_OPTIONS.limits.fileSize).toBe(MEDIA_MAX_BYTES)
    expect(MEDIA_UPLOAD_OPTIONS.abortOnLimit).toBe(true)
  })
})

describe('media bucket', () => {
  it('is the R2_MEDIA binding when the Worker has one', () => {
    const bucket = { put: () => 'stored' }
    expect(mediaBucketFrom({ R2_MEDIA: bucket })).toBe(bucket)
  })

  it('without the binding, every call fails naming it', () => {
    const bucket = mediaBucketFrom<{ put: () => unknown; get: () => unknown }>(undefined)
    expect(() => bucket.put()).toThrow(MISSING_MEDIA_BUCKET_MESSAGE)
    expect(() => bucket.get()).toThrow(MISSING_MEDIA_BUCKET_MESSAGE)
    expect(() => missingMediaBucket<{ head: () => unknown }>().head()).toThrow(/R2_MEDIA binding is missing/)
  })
})
