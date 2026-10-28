import * as migration_20261027_203229_cms_payload_core from './20261027_203229_cms_payload_core';
import * as migration_20261028_061257_cms_media from './20261028_061257_cms_media';
import * as migration_20261028_121234_cms_lumen_identity from './20261028_121234_cms_lumen_identity';

export const migrations = [
  {
    up: migration_20261027_203229_cms_payload_core.up,
    down: migration_20261027_203229_cms_payload_core.down,
    name: '20261027_203229_cms_payload_core',
  },
  {
    up: migration_20261028_061257_cms_media.up,
    down: migration_20261028_061257_cms_media.down,
    name: '20261028_061257_cms_media',
  },
  {
    up: migration_20261028_121234_cms_lumen_identity.up,
    down: migration_20261028_121234_cms_lumen_identity.down,
    name: '20261028_121234_cms_lumen_identity'
  },
];
