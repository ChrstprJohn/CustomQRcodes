import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'

const wasm = createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm')
prepareZXingModule({ overrides: { wasmBinary: await readFile(wasm) } })

const browser = await chromium.launch({
  executablePath: process.env.BRANDQR_CHROME,
  channel: process.env.BRANDQR_CHROME ? undefined : 'chrome',
  headless: true,
})
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.setDefaultTimeout(12000)
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto(process.env.BRANDQR_URL || 'http://127.0.0.1:5173/')
  const heroHeading = page.getByRole('heading', { name: /^Custom QR codes for website links/ })
  await heroHeading.waitFor()
  const currentUse = heroHeading.locator('.headline-word[data-current]')
  assert.equal(await currentUse.textContent(), 'website links')
  const scramble = currentUse.locator('.headline-letter[data-symbol]').first()
  await scramble.waitFor()
  await scramble.waitFor({ state: 'hidden' })
  await page.locator('.composition[aria-busy="false"]').waitFor({ timeout: 90000 })
  await page.getByRole('button', { name: 'View Wild Poppy' }).waitFor({ timeout: 30000 })
  await page.waitForFunction(() => [...document.querySelectorAll('.gallery-card')].every(card => getComputedStyle(card).opacity === '1'))
  const samples = await page.locator('.gallery-card img').evaluateAll(images => images.map(image => image.src))
  assert.equal(samples.length, 60)
  assert.equal(new Set(samples).size, 44, 'The spiral cycles through 44 unique artworks')
  const layouts = page.getByRole('group', { name: 'Gallery layout' })
  const spiral = layouts.getByRole('button', { name: 'Spiral', exact: true })
  const orbit = layouts.getByRole('button', { name: 'Orbit', exact: true })
  assert.equal(await spiral.getAttribute('aria-pressed'), 'true')
  const foreground = page.locator('.gallery-position[data-turn="2"]').first()
  const idleStart = await foreground.evaluate(card => parseFloat(card.style.getPropertyValue('--motion-x')))
  await page.waitForFunction(start => Math.abs(parseFloat(document.querySelector('.gallery-position[data-turn="2"]').style.getPropertyValue('--motion-x')) - start) > 4, idleStart)
  await currentUse.filter({ hasText: 'social profiles' }).waitFor()
  await currentUse.filter({ hasText: 'social profiles' }).locator('.headline-letter[data-symbol]').first().waitFor()
  await page.locator('.pixel-reveal').waitFor({ state: 'detached' })
  const stopped = await foreground.getAttribute('style')
  const depth = await page.evaluate(() => {
    return [...document.querySelectorAll('.gallery-card')].map(card => Number(getComputedStyle(card, '::after').opacity))
  })
  assert.ok(Math.max(...depth) - Math.min(...depth) > .2, 'Far cards have a stronger white haze than near cards')
  for (let turn = 0; turn < 5; turn++) {
    assert.equal(await page.locator('.gallery-position[data-turn="' + turn + '"]').count(), 12)
  }
  await page.screenshot({ path: join(tmpdir(), 'brandqr-gallery-desktop.png'), animations: 'disabled' })
  const headingBefore = await heroHeading.boundingBox()
  await page.mouse.wheel(0, 220)
  await page.waitForFunction(before => document.querySelector('.gallery-position[data-turn="2"]').getAttribute('style') !== before, stopped)
  assert.deepEqual(await heroHeading.boundingBox(), headingBefore)
  await page.mouse.wheel(0, -220)
  await page.mouse.move(1180, 410)
  await page.waitForFunction(() => parseFloat(document.querySelector('.gallery-title').style.translate) > 2)
  await page.mouse.wheel(0, 420)
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('.gallery-position')]
    return Math.abs(parseFloat(cards[0].style.getPropertyValue('--motion-x'))) > 10 &&
      cards[0].style.getPropertyValue('--motion-x') !== cards[1].style.getPropertyValue('--motion-x')
  })
  assert.equal(await page.evaluate(() => scrollY), 0, 'Wheel moves individual cards within the viewport')
  assert.equal(await page.getByRole('link', { name: 'Create QRcode', exact: true }).getAttribute('href'), '#/studio')
  assert.equal(await page.getByRole('button', { name: 'Pause headline rotation' }).count(), 0)
  await orbit.click()
  assert.equal(await orbit.getAttribute('aria-pressed'), 'true')
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('.gallery-position[style*="visibility: visible"]')]
    const positions = cards.map(card => parseFloat(card.style.getPropertyValue('--motion-x')))
    return cards.length >= 7 && cards.every(card => Number(card.style.getPropertyValue('--motion-layer')) <= 40)
      && Math.max(...positions) - Math.min(...positions) > innerWidth * .76
  })
  await page.mouse.wheel(0, 420)
  await page.waitForFunction(() => {
    const unzoomedScale = Math.min(innerWidth * .28, innerHeight * .2) / 200
    const scales = Array.from(document.querySelectorAll('.gallery-position[style*="visibility: visible"]'),
      card => Number(card.style.getPropertyValue('--motion-scale')))
    return Math.max(...scales) > unzoomedScale
  })
  await spiral.click()
  assert.equal(await spiral.getAttribute('aria-pressed'), 'true')
  await page.waitForFunction(() => [...document.querySelectorAll('.gallery-position[style*="visibility: visible"]')]
    .some(card => Number(card.style.getPropertyValue('--motion-layer')) > 40))
  await page.getByRole('button', { name: 'About', exact: true }).click()
  await page.getByRole('dialog', { name: 'About BrandQR' }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await page.getByRole('link', { name: 'Artwork credits' }).click()
  await page.getByRole('heading', { name: 'Artwork credits' }).waitFor()
  assert.equal(await page.locator('.credits li').count(), 44)
  assert.equal(await page.locator('.credits li a').count(), 38)
  await page.getByRole('link', { name: 'Back to gallery' }).click()
  await page.getByRole('button', { name: 'View Wild Poppy' }).press('Enter')
  await page.getByRole('dialog').getByText('Scan verified').waitFor()
  await page.getByRole('dialog').getByText('1 / 44').waitFor()
  await page.mouse.click(35, 140)
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'View Wild Poppy' }).press('Enter')
  await page.getByRole('dialog', { name: 'Wild Poppy' }).waitFor()
  await page.getByRole('button', { name: 'Next artwork' }).click()
  await page.getByRole('dialog', { name: 'Blue Hour Ceramic' }).waitFor()
  await page.keyboard.press('ArrowLeft')
  await page.getByRole('dialog', { name: 'Wild Poppy' }).waitFor()
  assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Wallpaper' }).count(), 0)
  await page.getByRole('button', { name: 'Use this artwork' }).click()
  await page.getByRole('heading', { name: 'QR art studio' }).waitFor()
  await page.getByText('Wild Poppy', { exact: true }).waitFor()
  const check = page.getByText('Ready to scan', { exact: true })
  assert.equal(await page.getByLabel('Website URL').inputValue(), '')
  assert.equal(await page.getByRole('button', { name: 'Add QR content' }).isEnabled(), false)
  await page.getByLabel('Website URL').fill('https://example.com')
  await check.waitFor()
  await page.screenshot({ path: join(tmpdir(), 'brandqr-desktop.png') })
  await page.getByLabel('Website URL').fill('bad address')
  await page.getByText('Enter a website address like example.com.').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Check content fields' }).isEnabled(), false)
  await page.getByLabel('Website URL').fill('example.org/menu')
  await check.waitFor()
  const contentTypes = page.getByRole('group', { name: 'Content type' })
  const chooser = page.getByRole('dialog', { name: 'Choose a content type' })
  const moreTypes = contentTypes.getByRole('button', { name: /More|more content types/ })
  async function chooseAdditionalType(type) {
    await moreTypes.click()
    await chooser.getByRole('button', { name: type, exact: true }).click()
    await chooser.waitFor({ state: 'detached' })
  }
  assert.deepEqual((await contentTypes.getByRole('button').allTextContents()).map(text => text.trim()), ['Website', 'Contact', 'Instagram', 'More'])
  assert.equal(await contentTypes.getByRole('button', { name: 'Website', exact: true }).getAttribute('aria-pressed'), 'true')
  for (const [type, field] of [['Text', 'Text to encode'], ['Wi-Fi', 'Network name']]) {
    await chooseAdditionalType(type)
    assert.equal(await page.getByLabel(field).inputValue(), '')
    assert.equal(await page.getByRole('button', { name: 'Add QR content' }).isEnabled(), false)
  }
  await moreTypes.click()
  assert.equal(await chooser.locator('.type-card').count(), 65)
  await chooser.getByRole('searchbox', { name: 'Search content types' }).fill('instagram')
  await chooser.getByRole('button', { name: 'Instagram', exact: true }).click()
  await chooser.waitFor({ state: 'detached' })
  assert.equal(await contentTypes.getByRole('button', { name: 'Instagram', exact: true }).getAttribute('aria-pressed'), 'true')
  assert.equal(await page.getByLabel('Instagram URL').inputValue(), '')
  await page.getByLabel('Instagram URL').fill('https://example.com/profile')
  await page.getByText('Enter a link from Instagram.').waitFor()
  await page.getByLabel('Instagram URL').fill('https://www.instagram.com/username/')
  await page.getByRole('button', { name: 'Classic', exact: true }).click()
  await check.waitFor()
  await contentTypes.getByRole('button', { name: 'Website' }).click()
  assert.equal(await page.getByLabel('Website URL').inputValue(), 'example.org/menu')
  const styles = page.getByRole('group', { name: 'QR style' })
  assert.equal(new Set(await styles.locator('img').evaluateAll(images => images.map(image => image.src))).size, 3)
  await styles.getByRole('button', { name: 'Classic' }).click()
  assert.equal(await styles.getByRole('button', { name: 'Classic' }).getAttribute('aria-pressed'), 'true')
  assert.equal(await page.getByRole('button', { name: 'Image', exact: true }).count(), 0)
  await page.locator('#settings-0').getByRole('group', { name: 'Export format' }).waitFor()
  await styles.getByRole('button', { name: 'Photo' }).click()
  assert.equal(await page.getByRole('button', { name: 'Customize image' }).count(), 0)
  assert.equal(await page.getByText('Try an example', { exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Replace image' }).waitFor()
  await page.locator('.drop img').waitFor()
  const fixture = await page.locator('.qr-stage canvas').evaluate(() => {
    const photo = document.createElement('canvas')
    photo.width = photo.height = 48
    const ctx = photo.getContext('2d')
    ctx.fillStyle = '#f2c26e'
    ctx.fillRect(6, 6, 36, 36)
    ctx.fillStyle = '#7094c2'
    ctx.fillRect(16, 10, 22, 34)
    return photo.toDataURL('image/png').split(',')[1]
  })
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Replace image' }).click(),
  ])
  await fileChooser.setFiles({
    name: 'studio-fixture.png', mimeType: 'image/png', buffer: Buffer.from(fixture, 'base64'),
  })
  await page.getByText('studio-fixture.png', { exact: true }).waitFor()
  await page.locator('.file-badge').getByText('PNG', { exact: true }).waitFor()
  assert.ok((await page.getByRole('button', { name: 'Replace image' }).boundingBox()).height <= 70,
    'Desktop uses the compact uploaded artwork row')
  assert.equal(await page.getByRole('group', { name: 'Framing' }).getByRole('slider').count(), 3)
  assert.equal(await page.getByRole('group', { name: 'Appearance' }).getByRole('slider').count(), 4)
  await check.waitFor()
  assert.equal(await page.getByRole('button', { name: 'Reset zoom' }).isVisible(), false)
  const zoom = page.getByLabel('Zoom', { exact: true })
  const stage = page.locator('.qr-stage canvas')
  const beforeZoom = await stage.evaluate(canvas => canvas.toDataURL())
  const sawLiveFrame = page.waitForFunction(before => {
    const slider = document.getElementById('zoom')
    return slider.closest('.range').dataset.moving === 'true' &&
      document.querySelector('.qr-stage canvas').toDataURL() !== before
  }, beforeZoom)
  await zoom.fill('1.2')
  await sawLiveFrame
  await page.getByRole('button', { name: 'Reset zoom' }).waitFor()
  assert.equal(await page.getByRole('button', { name: /Subject/ }).count(), 0)
  await page.getByRole('button', { name: 'Stamp' }).click()
  await check.waitFor()
  const downloadOptions = page.getByRole('dialog', { name: 'Download PNG' })
  await page.getByRole('button', { name: 'Download PNG' }).click()
  await downloadOptions.waitFor()
  await downloadOptions.getByRole('img', { name: 'Stamp QR preview' }).waitFor()
  await downloadOptions.getByRole('button', { name: '3×', exact: true }).click()
  await downloadOptions.getByText('1,536 × 1,536 px', { exact: true }).waitFor()
  await downloadOptions.getByRole('button', { name: 'Custom', exact: true }).click()
  const custom = downloadOptions.getByLabel('Square size (px)')
  await custom.fill('127')
  assert.equal(await downloadOptions.getByRole('button', { name: 'Enter a valid size' }).isEnabled(), false)
  await custom.fill('1800')
  await downloadOptions.getByText('1,800 × 1,800 px', { exact: true }).waitFor()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    downloadOptions.getByRole('button', { name: 'Download PNG' }).click(),
  ])
  assert.equal(download.suggestedFilename(), 'brandqr-stamp-1800.png')
  const chunks = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk)
  const png = Buffer.concat(chunks)
  const exported = await page.evaluate(async base64 => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + base64
    await img.decode()
    const probe = document.createElement('canvas')
    probe.width = probe.height = 640
    const ctx = probe.getContext('2d')
    ctx.drawImage(img, 0, 0, 640, 640)
    const imageData = ctx.getImageData(0, 0, 640, 640).data
    let coloredEdgePixels = 0
    for (let y = 180; y < 440; y++) {
      for (let x = 84; x < 94; x++) {
        const offset = (y * 640 + x) * 4
        if (imageData[offset] - imageData[offset + 2] > 45) coloredEdgePixels++
      }
    }
    return { size: [img.width, img.height], pixels: Array.from(imageData), coloredEdgePixels }
  }, png.toString('base64'))
  assert.deepEqual(exported.size, [1800, 1800])
  assert.ok(exported.coloredEdgePixels > 1500, 'Artwork reaches the outer modules after transparent padding is cropped')
  const scan = await readBarcodes({ data: Uint8ClampedArray.from(exported.pixels), width: 640, height: 640 },
    { formats: ['QRCode'], tryHarder: true, tryDenoise: true, textMode: 'Plain' })
  assert.equal(scan[0]?.text, 'https://example.org/menu')
  await page.getByRole('button', { name: 'Stamp', exact: true }).click()
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.qr-stage canvas')
    const context = canvas.getContext('2d')
    const edge = context.getImageData(0, 0, 1, 1).data[3]
    const margin = context.getImageData(30, 30, 1, 1).data[3]
    return edge === 0 && margin === 255
  })
  await check.waitFor()
  const reset = page.getByRole('button', { name: 'Reset studio' })
  const confirmation = page.getByRole('dialog', { name: 'Reset this QR?' })
  await reset.click()
  await confirmation.getByRole('button', { name: 'Keep editing' }).click()
  await page.getByText('studio-fixture.png', { exact: true }).waitFor()
  await reset.click()
  await confirmation.getByRole('button', { name: 'Reset QR' }).click()
  await page.getByRole('button', { name: /Click to upload an image/ }).waitFor()
  const dropZone = page.locator('.drop')
  const draggedFile = await page.evaluateHandle(() => {
    const transfer = new DataTransfer()
    transfer.items.add(new File(['preview'], 'dragged.png', { type: 'image/png' }))
    return transfer
  })
  await dropZone.dispatchEvent('dragover', { dataTransfer: draggedFile })
  await page.getByRole('button', { name: /Drop your image here/ }).waitFor()
  assert.equal(await dropZone.evaluate(element => getComputedStyle(element).outlineStyle), 'dashed')
  await dropZone.dispatchEvent('dragleave', { dataTransfer: draggedFile })
  await page.getByRole('button', { name: /Click to upload an image/ }).waitFor()
  await draggedFile.dispose()
  assert.equal(await page.getByRole('button', { name: 'Reset studio' }).count(), 0)
  await page.getByText('Enter a website URL and add an image', { exact: true }).waitFor()
  const previewNotice = page.locator('.preview-note')
  assert.equal(await previewNotice.count(), 0, 'The empty preview has no notice row')
  await page.getByRole('button', { name: 'Stamp', exact: true }).click()
  assert.equal(await page.locator('.qr-stage').getAttribute('data-format'), 'Stamp')
  const blankStamp = await stage.evaluate(canvas => {
    const context = canvas.getContext('2d')
    return [context.getImageData(0, 0, 1, 1).data[3], context.getImageData(30, 30, 1, 1).data[3]]
  })
  assert.deepEqual(blankStamp, [0, 255], 'The empty Stamp preview shows the perforated edge')
  await page.getByRole('button', { name: 'Card', exact: true }).click()
  await page.getByLabel('Website URL').fill('https://example.com')
  await check.waitFor()
  await page.getByText('Open Image to upload artwork.', { exact: true }).waitFor()
  await page.locator('.qr-stage > .preview-note').waitFor()
  const noticeBounds = await previewNotice.boundingBox()
  const stageBounds = await stage.boundingBox()
  assert.ok(noticeBounds.x >= stageBounds.x && noticeBounds.x + noticeBounds.width <= stageBounds.x + stageBounds.width,
    'The image prompt fits within the preview')
  assert.ok(noticeBounds.y + noticeBounds.height <= stageBounds.y, 'The image prompt stays above the QR canvas')
  assert.equal(await page.locator('.qr-stage').getAttribute('data-modules'), '29')
  const alignmentGap = await stage.evaluate(canvas => {
    const unit = canvas.width / 35.5
    return canvas.getContext('2d').getImageData(Math.round(24.25 * unit), Math.round(23.75 * unit), 1, 1).data[0]
  })
  assert.ok(alignmentGap > 245, 'The photo-style alignment area keeps white space between dots')
  await page.getByLabel('Website URL').fill('https://example.com/' + 'long-destination/'.repeat(4))
  await check.waitFor()
  assert.ok(Number(await page.locator('.qr-stage').getAttribute('data-modules')) > 29)
  await chooseAdditionalType('Text')
  await page.getByLabel('Text to encode').fill('BrandQR studio test')
  await page.getByRole('button', { name: 'Classic', exact: true }).click()
  await check.waitFor()
  assert.equal(await previewNotice.count(), 0, 'The notice row disappears when the prompt is no longer needed')
  await chooseAdditionalType('Wi-Fi')
  assert.equal(await page.getByLabel('Network name').inputValue(), '')
  await page.getByLabel('Network name').fill('Studio Guest')
  await page.getByLabel('Network password').fill('short')
  await page.getByText('Use 8–63 printable characters or a 64-digit hex key for WPA.').waitFor()
  await page.getByLabel('Network security').selectOption('nopass')
  await check.waitFor()
  await contentTypes.getByRole('button', { name: 'Contact', exact: true }).click()
  assert.equal(await page.getByLabel('Full name').inputValue(), '')
  await page.getByLabel('Full name').fill('Studio Guest')
  await page.getByLabel('Email (optional)').fill('guest@example.com')
  await check.waitFor()
  await contentTypes.getByRole('button', { name: /More|more content types/ }).click()
  await page.getByRole('button', { name: 'SMS', exact: true }).click()
  await page.getByLabel('Phone number with country code').fill('123')
  await page.getByText(/Enter a phone number with its country code/).waitFor()
  await page.getByLabel('Phone number with country code').fill('+1 202 555 0142')
  await page.getByLabel('Message (optional)').fill('Hi & hello')
  await check.waitFor()
  await reset.click()
  await confirmation.getByRole('button', { name: 'Reset QR' }).click()
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.locator('.studio-page > .export-actions').waitFor()
    await page.getByRole('button', { name: /Tap to upload an image/ }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    const alignedControls = await page.evaluate(() => {
      const boxes = ['.style-choices', '.content-types', '.drop-action', '.format-choices']
        .map(selector => document.querySelector(selector).getBoundingClientRect())
      boxes.push({ left: document.querySelector('.reset-action').getBoundingClientRect().left,
        right: document.querySelector('.download').getBoundingClientRect().right })
      return boxes.every(box => Math.abs(box.left - boxes[0].left) <= 1 && Math.abs(box.right - boxes[0].right) <= 1)
    })
    assert.equal(alignedControls, true, 'Mobile editor and export controls share the same insets')
    assert.equal(await page.getByRole('button', { name: 'Reset studio' }).isEnabled(), false)
    const fieldSpacing = await page.evaluate(() => {
      const pills = document.querySelector('.content-types').getBoundingClientRect()
      const label = document.querySelector('label[for="destination"]').getBoundingClientRect()
      const field = document.querySelector('.input-wrap').getBoundingClientRect()
      return { section: Math.round(label.top - pills.bottom), field: Math.round(field.top - label.bottom) }
    })
    assert.deepEqual(fieldSpacing, { section: 16, field: 7 })
    await page.screenshot({ path: join(tmpdir(), 'brandqr-' + width + '.png'), fullPage: true })
  }
  const imageSection = page.getByRole('button', { name: 'Image', exact: true })
  const formatChoices = page.locator('#settings-1').getByRole('group', { name: 'Export format' })
  await formatChoices.waitFor()
  await imageSection.click()
  await page.waitForFunction(() => {
    const panel = document.getElementById('settings-1')
    return panel.inert && panel.getBoundingClientRect().height === 0
  })
  await imageSection.click()
  await formatChoices.waitFor()
  await contentTypes.getByRole('button', { name: 'More' }).click()
  const closePicker = chooser.getByRole('button', { name: 'Close content type picker' })
  await closePicker.waitFor()
  assert.equal(await closePicker.evaluate(button => document.activeElement === button), true)
  await page.mouse.click(6, 6)
  assert.equal(await chooser.isVisible(), true)
  await chooser.getByRole('button', { name: 'TikTok', exact: true }).click()
  await chooser.waitFor({ state: 'detached' })
  await page.getByLabel('TikTok URL').waitFor()
  await contentTypes.getByRole('button', { name: /TikTok selected/ }).click()
  await closePicker.click()
  await chooser.waitFor({ state: 'detached' })
  assert.equal(await page.getByRole('group', { name: 'Editor sections' }).count(), 0)
  await page.getByRole('heading', { name: 'Add your artwork' }).waitFor()
  const previewBox = await page.getByRole('region', { name: 'QR code preview' }).boundingBox()
  const editorBox = await page.getByRole('region', { name: 'Code settings' }).boundingBox()
  assert.ok(previewBox.y < editorBox.y, 'Phone layout keeps the preview above the editor')
  await page.setViewportSize({ width: 390, height: 640 })
  const dock = page.getByRole('button', { name: /Show full-size (Card|Stamp) QR preview/ })
  await page.evaluate(() => window.scrollTo(0, 480))
  await page.waitForFunction(() => document.querySelector('.qr-stage').getBoundingClientRect().bottom <= 0)
  assert.equal(await dock.count(), 0, 'The empty preview scrolls away without a dock')
  await page.locator('input[type=file]').setInputFiles({
    name: 'a-long-name-for-the-mobile-studio-artwork-fixture.png', mimeType: 'image/png', buffer: Buffer.from(fixture, 'base64'),
  })
  await page.getByRole('img', { name: 'Artwork preview' }).waitFor()
  const uploadRow = await page.getByRole('button', { name: 'Replace image' }).boundingBox()
  assert.ok(uploadRow.height <= 70, 'The uploaded artwork fits in a compact mobile row')
  await page.getByText('48×48', { exact: false }).waitFor()
  await page.evaluate(() => window.scrollTo(0, 480))
  await page.getByRole('button', { name: 'Show full-size artwork preview' }).waitFor()
  await page.getByLabel('TikTok URL').fill('https://www.tiktok.com/@brandqr')
  await check.waitFor()
  await page.evaluate(() => {
    const stage = document.querySelector('.qr-stage').getBoundingClientRect()
    window.scrollBy(0, stage.top + stage.height * .75)
  })
  await dock.waitFor()
  const clippedStage = await stage.boundingBox()
  assert.ok(clippedStage.y < 0 && clippedStage.y + clippedStage.height > 0,
    'The dock appears before the main preview scrolls completely off-screen')
  const dockBounds = await dock.boundingBox()
  const actionsBounds = await page.locator('.studio-page > .export-actions').boundingBox()
  assert.ok(dockBounds.width < 150 && dockBounds.y + dockBounds.height <= actionsBounds.y,
    'The compact QR dock sits above the download and reset actions')
  assert.equal(actionsBounds.y + actionsBounds.height, 640, 'The actions stay at the bottom while scrolling')
  assert.equal(await page.getByRole('button', { name: 'Download PNG' }).isEnabled(), true)
  assert.equal(await page.getByRole('button', { name: 'Reset studio' }).isEnabled(), true)
  await page.getByRole('button', { name: 'Remove image' }).click()
  await check.waitFor()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await dock.waitFor()
  const beforeStamp = await page.evaluate(() => window.scrollY)
  await page.getByRole('button', { name: 'Stamp', exact: true }).click()
  await page.getByRole('button', { name: 'Show full-size Stamp QR preview' }).waitFor()
  await check.waitFor()
  assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - beforeStamp) <= 1,
    'Changing the format keeps the mobile scroll position with no artwork')
  await page.getByRole('button', { name: 'Download PNG' }).click()
  await downloadOptions.waitFor()
  const downloadBounds = await downloadOptions.boundingBox()
  assert.equal(downloadBounds.y + downloadBounds.height, 640, 'Download options open as a bottom sheet on mobile')
  const downloadPreview = downloadOptions.getByRole('img', { name: 'Stamp QR preview' })
  await downloadPreview.waitFor()
  assert.ok((await downloadPreview.boundingBox()).width >= 250, 'The QR preview uses most of the phone-width sheet')
  await page.keyboard.press('Escape')
  await downloadOptions.waitFor({ state: 'hidden' })
  await dock.click()
  await dock.waitFor({ state: 'detached' })
  assert.equal(await page.getByRole('link', { name: 'Artwork credits' }).count(), 0)
  await page.getByRole('link', { name: 'FAQ' }).click()
  await page.getByRole('heading', { name: 'Frequently asked questions' }).waitFor()
  await page.getByText('Is BrandQR free?', { exact: true }).click()
  await page.getByText('Yes. You can create, verify, and download your QR codes without an account or a watermark.').waitFor()
  await page.getByRole('link', { name: 'Back to Studio' }).click()
  assert.equal(await page.getByLabel('TikTok URL').inputValue(), 'https://www.tiktok.com/@brandqr')
  assert.equal(await page.getByRole('button', { name: 'Stamp', exact: true }).getAttribute('aria-pressed'), 'true')
  await page.getByRole('link', { name: 'Back to gallery' }).click()
  await page.getByRole('button', { name: 'View Wild Poppy' }).waitFor()
  assert.equal(await page.locator('.gallery-footer-links').getByRole('link', { name: 'FAQ' }).count(), 1)
  await page.getByRole('link', { name: 'FAQ' }).click()
  await page.getByRole('heading', { name: 'Frequently asked questions' }).waitFor()
  await page.getByRole('link', { name: 'Back to gallery' }).click()
  await page.getByRole('button', { name: 'View Wild Poppy' }).waitFor()
  await page.waitForFunction(() => [...document.querySelectorAll('.gallery-card')].every(card => getComputedStyle(card).opacity === '1'))
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: join(tmpdir(), 'brandqr-gallery-mobile.png'), animations: 'disabled' })
  const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await touch.goto(page.url())
  await touch.getByRole('button', { name: 'View Wild Poppy' }).waitFor({ timeout: 30000 })
  const touchBefore = await touch.locator('.gallery-position[data-turn="2"]').first().getAttribute('style')
  const input = await touch.context().newCDPSession(touch)
  await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: 523 }] })
  await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y: 371 }] })
  await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await touch.waitForFunction(before => document.querySelector('.gallery-position[data-turn="2"]').getAttribute('style') !== before, touchBefore)
  assert.equal(await touch.evaluate(() => scrollY), 0, 'Swipe moves individual cards within the viewport')
  await touch.waitForTimeout(1200)
  const visibleCard = await touch.locator('.gallery-card').evaluateAll(cards => {
    for (const card of cards) {
      const box = card.getBoundingClientRect()
      const x = box.x + box.width / 2
      const y = box.y + box.height / 2
      if (card.contains(document.elementFromPoint(x, y))) return { x, y }
    }
    return null
  })
  assert.ok(visibleCard)
  await touch.touchscreen.tap(visibleCard.x, visibleCard.y)
  const mobileViewer = touch.getByRole('dialog')
  await mobileViewer.waitFor()
  const visibleSample = await mobileViewer.getByRole('heading').innerText()
  await touch.getByRole('button', { name: 'Use this artwork' }).tap()
  await touch.getByText(visibleSample, { exact: true }).waitFor()
  assert.deepEqual(pageErrors, [])
  console.log('QR studio browser checks passed.')
} finally {
  await browser.close()
}
