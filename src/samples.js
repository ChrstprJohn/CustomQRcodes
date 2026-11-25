import sheet from './gallery-art.webp?inline'
import openSheet from './gallery-open-art.webp?inline'
import openArtwork from './gallery-open-art.json'
import photoSheet from './gallery-photo-art.webp?inline'
import photos from './gallery-photo-art.json'

const originalNames = ['Wild Poppy', 'Blue Hour Ceramic', 'Highland Alpaca', 'Moon Jelly', 'Apricot Arcade', 'Garden Koi']

async function unpack(source, columns, rows) {
  const image = new Image()
  image.src = source
  await image.decode()
  const width = image.naturalWidth / columns
  const height = image.naturalHeight / rows
  return Array.from({ length: columns * rows }, (_, index) => {
    const sample = document.createElement('canvas')
    sample.width = sample.height = 512
    sample.getContext('2d').drawImage(image, (index % columns) * width, Math.floor(index / columns) * height,
      width, height, 0, 0, 512, 512)
    return sample
  })
}

export async function loadSamples() {
  const [original, licensed, extra] = await Promise.all([unpack(sheet, 3, 2), unpack(openSheet, 6, 4), unpack(photoSheet, 7, 2)])
  return [
    ...originalNames.map((name, index) => ({ name, image: original[index], artist: 'BrandQR sample' })),
    ...openArtwork.map(({ label: name, ...credit }, index) => ({ name, ...credit, image: licensed[index] })),
    ...photos.map(({ label: name, ...credit }, index) => ({ name, ...credit, image: extra[index] })),
  ]
}
