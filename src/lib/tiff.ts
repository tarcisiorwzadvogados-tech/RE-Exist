export const decodeTiffFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const UTIF = (await import('utif')).default;
        const buffer = event.target?.result as ArrayBuffer;
        const ifds = UTIF.decode(buffer);
        if (ifds.length === 0) { reject(new Error('Invalid TIFF file.')); return; }

        const getDim = (obj: any, tag: number) => {
          const val = obj[tag] ?? obj[`t${tag}`] ?? obj[tag.toString()];
          if (val === undefined || val === null) return undefined;
          if (Array.isArray(val)) return val[0];
          if (typeof val === 'object' && 'value' in val)
            return Array.isArray(val.value) ? val.value[0] : val.value;
          return val;
        };

        let ifd = ifds[0];
        let rawWidth: any;
        let rawHeight: any;

        for (const candidate of ifds) {
          const w = candidate.width || getDim(candidate, 256) || getDim(candidate, 40962);
          const h = candidate.height || getDim(candidate, 257) || getDim(candidate, 40963);
          if (w && h) { ifd = candidate; rawWidth = w; rawHeight = h; break; }
        }

        if (!rawWidth || !rawHeight) {
          ifd = ifds[0];
          try {
            UTIF.decodeImage(buffer, ifd);
            rawWidth = ifd.width || getDim(ifd, 256) || getDim(ifd, 40962);
            rawHeight = ifd.height || getDim(ifd, 257) || getDim(ifd, 40963);
          } catch { /* dimension check below will catch this */ }
        } else {
          UTIF.decodeImage(buffer, ifd);
          rawWidth = ifd.width || rawWidth;
          rawHeight = ifd.height || rawHeight;
        }

        const rgba = UTIF.toRGBA8(ifd);
        const width = Math.floor(Number(rawWidth));
        const height = Math.floor(Number(rawHeight));

        if (width <= 0 || height <= 0 || isNaN(width) || isNaN(height)) {
          reject(new Error(`Invalid TIFF dimensions: ${rawWidth}x${rawHeight}`));
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context unavailable.')); return; }

        const imgData = ctx.createImageData(width, height);
        imgData.data.set(rgba);
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
