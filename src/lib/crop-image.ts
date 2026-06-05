// A utility function to crop and resize an image.

export default async function getCroppedImg(imageSrc: string, pixelCrop: { x: number; y: number; width: number; height: number; }): Promise<string> {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = imageSrc;
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = (err) => reject(new Error('Failed to load image for cropping. It might be a network issue or CORS policy.'));
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not get canvas context');
    }

    const targetSize = 200;
    canvas.width = targetSize;
    canvas.height = targetSize;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        targetSize,
        targetSize
    );

    return canvas.toDataURL('image/jpeg');
}
