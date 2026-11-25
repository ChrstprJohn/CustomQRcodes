import sheet from './gallery-art.webp?url'
import openSheet from './gallery-open-art.webp?url'
import openArtwork from './gallery-open-art.json'
import photoSheet from './gallery-photo-art.webp?url'
import photos from './gallery-photo-art.json'

const originalNames = ['Wild Poppy', 'Blue Hour Ceramic', 'Highland Alpaca', 'Moon Jelly', 'Apricot Arcade', 'Garden Koi']

const samples = [
  ...originalNames.map(name => ({ name, artist: 'BrandQR sample' })),
  ...openArtwork.map(({ label: name, ...credit }) => ({ name, ...credit })),
  ...photos.map(({ label: name, ...credit }) => ({ name, ...credit })),
]
const lead = [0, 1, 8, 9, 11, 15]
const order = [...lead, ...samples.map((_, index) => index).filter(index => !lead.includes(index))]

export const galleryArtwork = order.map((sampleIndex, index) => ({
  ...samples[sampleIndex],
  sampleIndex,
  code: import.meta.env.BASE_URL + 'gallery-qr/' + index + '.webp',
  verified: true,
}))

export async function loadArtwork(item) {
  const originalEnd = originalNames.length
  const licensedEnd = originalEnd + openArtwork.length
  const { sampleIndex } = item
  const [source, columns, rows, index] = sampleIndex < originalEnd ? [sheet, 3, 2, sampleIndex]
    : sampleIndex < licensedEnd ? [openSheet, 6, 4, sampleIndex - originalEnd]
    : [photoSheet, 7, 2, sampleIndex - licensedEnd]
  const image = new Image()
  image.src = source
  await image.decode()
  const width = image.naturalWidth / columns
  const height = image.naturalHeight / rows
  const sample = document.createElement('canvas')
  sample.width = sample.height = 512
  sample.getContext('2d').drawImage(image, (index % columns) * width, Math.floor(index / columns) * height,
    width, height, 0, 0, 512, 512)
  return { ...item, image: sample }
}
