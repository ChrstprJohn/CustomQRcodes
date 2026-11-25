import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

prepareZXingModule({ overrides: { locateFile: () => wasmUrl } })

export async function scansPhoto(pixels, data) {
  const codes = await readBarcodes(pixels, {
    formats: ['QRCode'], tryHarder: true, tryDenoise: true, textMode: 'Plain', maxNumberOfSymbols: 1,
  })
  return codes.some(code => code.text === data)
}
