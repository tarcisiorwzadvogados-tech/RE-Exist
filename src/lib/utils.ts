export const escapeXml = (str: string) =>
  str.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] ?? c));

export const getClosestAspectRatio = (width: number, height: number): string => {
  const ratio = width / height;
  const supported = [
    { name: '1:1', value: 1 },
    { name: '3:4', value: 3 / 4 },
    { name: '4:3', value: 4 / 3 },
    { name: '9:16', value: 9 / 16 },
    { name: '16:9', value: 16 / 9 },
    { name: '1:4', value: 1 / 4 },
    { name: '1:8', value: 1 / 8 },
    { name: '4:1', value: 4 },
    { name: '8:1', value: 8 },
  ];
  let closest = supported[0];
  let minDiff = Math.abs(ratio - closest.value);
  for (let i = 1; i < supported.length; i++) {
    const diff = Math.abs(ratio - supported[i].value);
    if (diff < minDiff) { minDiff = diff; closest = supported[i]; }
  }
  return closest.name;
};

export const rotateSize = (width: number, height: number, rotation: number) => {
  const rotRad = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
};

export const generateId = () =>
  Math.random().toString(36).substr(2, 9).toUpperCase();

export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
