import { DownloadFormat, RestorationLog } from '../types';
import { createImage, escapeXml } from './utils';
import { generateCertificatePDF } from './pdf';

interface DownloadOptions {
  format: DownloadFormat;
  restoredImage: string;
  originalFileName: string;
  restorationHistory: RestorationLog[];
  selectedResolution: string;
  prompt: string;
  onClose: () => void;
  watermark?: boolean;
}

export const downloadImage = async ({
  format,
  restoredImage,
  originalFileName,
  restorationHistory,
  selectedResolution,
  prompt,
  onClose,
  watermark,
}: DownloadOptions): Promise<void> => {
  const img = await createImage(restoredImage);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(img, 0, 0);

  // Free-tier exports carry a discreet attribution mark (viral loop); BYOK exports are clean
  if (watermark && format !== 'pdf') {
    const fontSize = Math.max(12, Math.round(canvas.width * 0.014));
    const pad = fontSize;
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText('RE-EXIST · re-exist.app', canvas.width - pad + 1, canvas.height - pad + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('RE-EXIST · re-exist.app', canvas.width - pad, canvas.height - pad);
  }

  const currentLog = restorationHistory[0];
  const fileName = `${originalFileName}_restored.${format}`;

  if (format === 'pdf') {
    await generateCertificatePDF({
      restoredImage,
      img,
      currentLog,
      originalFileName,
      selectedResolution,
      prompt,
    });
    onClose();
    return;
  }

  const metadata = `RE-EXIST Restoration | ID: ${currentLog?.id || 'N/A'} | Model: ${currentLog?.model || 'Unknown'} | Res: ${currentLog?.resolution || selectedResolution} | Prompt: ${currentLog?.prompt || prompt}`;
  // PNG normally reuses the original data URL untouched; with a watermark it must
  // come from the canvas where the mark was drawn
  let downloadUrl = watermark ? canvas.toDataURL('image/png') : restoredImage;

  if (format === 'jpg') {
    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    try {
      const piexif = await import('piexifjs');
      const exifObj: any = {
        '0th': {
          [piexif.ImageIFD.ImageDescription]: metadata,
          [piexif.ImageIFD.Software]: 'RE-EXIST Restoration Lab',
          [piexif.ImageIFD.Artist]: process.env.USER_EMAIL || 'tarcisio.rwzadvogados@gmail.com',
          [piexif.ImageIFD.DateTime]: new Date().toISOString().replace(/[-T]/g, ':').split('.')[0],
        },
        Exif: { [piexif.ExifIFD.UserComment]: metadata },
      };
      downloadUrl = piexif.insert(piexif.dump(exifObj), base64);
    } catch {
      downloadUrl = base64;
    }
  } else if (format === 'tiff') {
    const UTIF = (await import('utif')).default;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rgba = new Uint8Array(imgData.data.buffer);
    const tiffBuffer = UTIF.encodeImage(rgba, canvas.width, canvas.height);

    try {
      const ifds = UTIF.decode(tiffBuffer);
      const ifd = ifds[0] as any;
      ifd[270] = [metadata];
      ifd[305] = ['RE-EXIST Restoration Lab'];
      ifd[315] = [process.env.USER_EMAIL || 'tarcisio.rwzadvogados@gmail.com'];

      const xmp = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.6-c140">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    dc:description="${escapeXml(metadata)}"
    dc:creator="${escapeXml(process.env.USER_EMAIL || 'tarcisio.rwzadvogados@gmail.com')}"
    xmp:CreatorTool="RE-EXIST Restoration Lab"/>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
      ifd[700] = [new TextEncoder().encode(xmp)];
      const blob = new Blob([UTIF.encode(ifds)], { type: 'image/tiff' });
      downloadUrl = URL.createObjectURL(blob);
    } catch {
      const blob = new Blob([tiffBuffer], { type: 'image/tiff' });
      downloadUrl = URL.createObjectURL(blob);
    }
  }

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  link.click();
  if (format === 'tiff') URL.revokeObjectURL(downloadUrl);
  onClose();
};
