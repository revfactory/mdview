import { Image } from '@tiptap/extension-image';

import { isSmallEmbeddedRaster } from '../lib/embedded-raster';

export const EmbeddedRasterImage = Image.extend({
  parseHTML() {
    return [{
      tag: 'img[src]',
      getAttrs: (element) => {
        const src = element.getAttribute('src') ?? '';
        // Preserve existing URL images; permit only bounded supported raster data.
        if (/^data:/i.test(src.trim()) && !isSmallEmbeddedRaster(src)) return false;
        return null;
      },
    }];
  },
});
