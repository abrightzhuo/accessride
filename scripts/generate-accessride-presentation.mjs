import pptxgen from 'pptxgenjs'
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { slides } from './presentation-data.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const imageDirectory = `${root}/releases/full-demo-ui`
const slideDirectory = `${root}/releases/AccessRide-presentation-slides`
const audioDirectory = `${root}/releases/AccessRide-presentation-audio`
const pptxPath = `${root}/releases/AccessRide-Full-Demo-English.pptx`
const manifestPath = `${root}/releases/AccessRide-presentation-manifest.json`
await mkdir(slideDirectory, { recursive: true })
await mkdir(audioDirectory, { recursive: true })

const dimensions = {
  '01-rider-login.png': [860, 1864],
  '02-rider-home.png': [860, 1864],
  '03-round-trip-request.png': [860, 2150],
  '04-rider-requested.png': [860, 1864],
  '05-agency-login.png': [1280, 900],
  '06-agency-new-request.png': [1280, 900],
  '07-agency-scheduled.png': [1280, 900],
  '08-agency-driver-assigned.png': [1280, 900],
  '09-rider-status-update.png': [860, 1864],
  '10-rider-sos.png': [860, 2110],
  '11-agency-sos-call.png': [1280, 900],
  '12-rider-directory.png': [1280, 900],
  '13-agency-reset-password.png': [1280, 900],
  '14-agency-create-rider.png': [1280, 900],
  '15-rider-change-password.png': [860, 2452],
}

function contain(name, x, y, w, h) {
  const [iw, ih] = dimensions[name]
  const scale = Math.min(w / iw, h / ih)
  const width = iw * scale
  const height = ih * scale
  return { path: `${imageDirectory}/${name}`, x: x + (w - width) / 2, y: y + (h - height) / 2, w: width, h: height }
}

const pptx = new pptxgen()
pptx.layout = 'LAYOUT_WIDE'
pptx.author = 'AccessRide'
pptx.subject = 'AccessRide rider and agency application workflow'
pptx.title = 'AccessRide Full Application Demonstration'
pptx.company = 'AccessRide'
pptx.lang = 'en-US'
pptx.theme = {
  headFontFace: 'Aptos Display',
  bodyFontFace: 'Aptos',
  lang: 'en-US',
}
pptx.defineSlideMaster({
  title: 'ACCESSRIDE',
  background: { color: 'FBF8F1' },
  objects: [
    { rect: { x: 0, y: 0, w: 13.333, h: 0.12, fill: { color: 'E88916' }, line: { color: 'E88916' } } },
    { text: { text: 'AccessRide', options: { x: 0.55, y: 0.22, w: 2.2, h: 0.3, fontFace: 'Aptos', fontSize: 12, bold: true, color: '996000', margin: 0 } } },
  ],
  slideNumber: { x: 12.25, y: 7.05, w: 0.45, h: 0.2, color: '77716A', fontSize: 9, align: 'right' },
})

for (const [index, item] of slides.entries()) {
  const slide = pptx.addSlide('ACCESSRIDE')
  if (item.cover) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0.12, w: 0.2, h: 7.38,
      fill: { color: 'E88916' }, line: { color: 'E88916' },
    })
    slide.addText(item.title, {
      x: 0.95, y: 2.05, w: 11.2, h: 0.95,
      fontSize: 54, bold: true, color: '241F19', margin: 0,
    })
    slide.addText(item.subtitle, {
      x: 0.98, y: 3.08, w: 11.0, h: 0.52,
      fontSize: 25, bold: true, color: '996000', margin: 0,
    })
    slide.addShape(pptx.ShapeType.line, {
      x: 0.98, y: 3.88, w: 1.45, h: 0,
      line: { color: 'E88916', width: 3 },
    })
    slide.addText('RIDER APP  |  AGENCY APP  |  REAL-TIME COORDINATION', {
      x: 0.98, y: 4.15, w: 9.7, h: 0.35,
      fontSize: 14, bold: true, color: '77716A', margin: 0,
    })
    slide.addNotes(item.narration)
    continue
  }
  const hasImage = Boolean(item.image)
  slide.addText(item.title, {
    x: 0.65, y: 0.7, w: hasImage ? 5.0 : 12.0, h: 0.62,
    fontSize: index === 0 || index === slides.length - 1 ? 34 : 27,
    bold: true, color: '241F19', margin: 0, breakLine: false,
  })
  slide.addText(item.subtitle, {
    x: 0.67, y: 1.34, w: hasImage ? 4.9 : 11.8, h: 0.45,
    fontSize: 17, bold: true, color: '8F5A00', margin: 0,
  })

  const bulletWidth = hasImage ? (dimensions[item.image][0] > dimensions[item.image][1] ? 4.6 : 7.2) : 11.5
  item.bullets.forEach((bullet, bulletIndex) => {
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 0.73, y: 2.18 + bulletIndex * 0.72, w: 0.12, h: 0.12,
      fill: { color: bulletIndex === 0 ? 'E88916' : '3E7EA1' },
      line: { color: bulletIndex === 0 ? 'E88916' : '3E7EA1' },
    })
    slide.addText(bullet, {
      x: 0.98, y: 2.03 + bulletIndex * 0.72, w: bulletWidth, h: 0.45,
      fontSize: 18, color: '4A443D', margin: 0,
    })
  })

  if (item.image) {
    const [iw, ih] = dimensions[item.image]
    if (item.secondaryImage) {
      slide.addImage(contain(item.image, 7.5, 1.35, 2.45, 5.7))
      slide.addImage(contain(item.secondaryImage, 9.65, 2.2, 3.35, 3.0))
    } else if (iw < ih) {
      slide.addImage(contain(item.image, 8.45, 0.72, 4.15, 6.28))
    } else {
      slide.addImage(contain(item.image, 5.65, 1.72, 7.0, 5.05))
    }
  }
  if (item.footnote) {
    slide.addText(item.footnote, {
      x: 0.68, y: 6.74, w: 10.8, h: 0.28, fontSize: 9.5, color: '77716A', margin: 0,
    })
  }
  slide.addNotes(item.narration)
}

await pptx.writeFile({ fileName: pptxPath })

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  for (const [index, item] of slides.entries()) {
    const imageData = {}
    for (const name of [item.image, item.secondaryImage].filter(Boolean)) {
      const bytes = await readFile(`${imageDirectory}/${name}`)
      imageData[name] = `data:image/png;base64,${bytes.toString('base64')}`
    }
    const isPortrait = item.image && dimensions[item.image][0] < dimensions[item.image][1]
    const bulletHtml = item.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')
    const imageHtml = item.image
      ? item.secondaryImage
        ? `<div class="media dual"><img class="portrait" src="${imageData[item.image]}"><img class="secondary" src="${imageData[item.secondaryImage]}"></div>`
        : `<div class="media ${isPortrait ? 'portrait-wrap' : 'landscape-wrap'}"><img src="${imageData[item.image]}"></div>`
      : ''
    const slideHtml = item.cover ? `
      <style>
        *{box-sizing:border-box} body{margin:0;background:#fbf8f1;font-family:Arial,sans-serif;color:#241f19}
        .cover{position:relative;width:1280px;height:720px;overflow:hidden;border-top:12px solid #e88916}
        .rail{position:absolute;left:0;top:0;width:20px;height:720px;background:#e88916}
        .brand{position:absolute;top:28px;left:58px;color:#996000;font-weight:800;font-size:14px}
        h1{position:absolute;left:90px;top:185px;margin:0;font-size:86px;line-height:1;font-weight:800}
        h2{position:absolute;left:94px;top:300px;margin:0;font-size:34px;line-height:1.2;color:#996000}
        .rule{position:absolute;left:94px;top:404px;width:142px;height:5px;background:#e88916}
        .scope{position:absolute;left:94px;top:438px;font-size:18px;font-weight:700;color:#77716a}
        .num{position:absolute;right:54px;bottom:28px;font-size:12px;color:#77716a}
      </style>
      <div class="cover">
        <div class="rail"></div>
        <div class="brand">AccessRide</div>
        <h1>${escapeHtml(item.title)}</h1>
        <h2>${escapeHtml(item.subtitle)}</h2>
        <div class="rule"></div>
        <div class="scope">RIDER APP &nbsp;|&nbsp; AGENCY APP &nbsp;|&nbsp; REAL-TIME COORDINATION</div>
        <div class="num">${index + 1}</div>
      </div>
    ` : `
      <style>
        *{box-sizing:border-box} body{margin:0;background:#fbf8f1;font-family:Arial,sans-serif;color:#241f19}
        .slide{position:relative;width:1280px;height:720px;overflow:hidden;border-top:12px solid #e88916;padding:54px 65px}
        .brand{position:absolute;top:20px;left:54px;color:#996000;font-weight:800;font-size:14px}
        h1{font-size:${index === 0 || index === slides.length - 1 ? 55 : 42}px;line-height:1.05;margin:12px 0 10px;max-width:${item.image ? '610px' : '1100px'}}
        h2{font-size:24px;line-height:1.25;margin:0;color:#8f5a00;max-width:${item.image ? '590px' : '1100px'}}
        ul{list-style:none;padding:0;margin:54px 0 0;width:${item.image ? (isPortrait ? '650px' : '420px') : '1050px'}}
        li{position:relative;font-size:25px;line-height:1.35;margin:0 0 22px;padding-left:27px;color:#4a443d}
        li:before{content:'';position:absolute;left:0;top:12px;width:10px;height:10px;border-radius:50%;background:#e88916}
        .media{position:absolute;display:flex;align-items:center;justify-content:center}
        .portrait-wrap{right:70px;top:56px;width:410px;height:625px}
        .landscape-wrap{right:45px;top:165px;width:710px;height:505px}
        .media img{max-width:100%;max-height:100%;object-fit:contain;box-shadow:0 0 0 8px #00000013;border-radius:8px}
        .dual{right:45px;top:110px;width:570px;height:565px;gap:18px}
        .dual .portrait{width:245px;max-height:565px}.dual .secondary{width:300px;max-height:330px}
        .foot{position:absolute;left:65px;bottom:48px;font-size:13px;color:#77716a}
        .num{position:absolute;right:54px;bottom:28px;font-size:12px;color:#77716a}
      </style>
      <div class="slide">
        <div class="brand">AccessRide</div>
        <h1>${escapeHtml(item.title)}</h1>
        <h2>${escapeHtml(item.subtitle)}</h2>
        <ul>${bulletHtml}</ul>
        ${imageHtml}
        ${item.footnote ? `<div class="foot">${escapeHtml(item.footnote)}</div>` : ''}
        <div class="num">${index + 1}</div>
      </div>
    `
    await page.setContent(slideHtml)
    await page.screenshot({
      path: `${slideDirectory}/slide-${String(index + 1).padStart(2, '0')}.png`,
    })
    const narrationPath = `${audioDirectory}/slide-${String(index + 1).padStart(2, '0')}.aiff`
    const result = spawnSync('say', ['-v', 'Samantha', '-r', '165', '-o', narrationPath, item.narration])
    if (result.status !== 0) throw new Error(result.stderr.toString())
  }
} finally {
  await browser.close()
}

await writeFile(
  manifestPath,
  JSON.stringify({
    slides: slides.map((_, index) => {
      const number = String(index + 1).padStart(2, '0')
      return {
        image: `${slideDirectory}/slide-${number}.png`,
        audio: `${audioDirectory}/slide-${number}.aiff`,
      }
    }),
  }, null, 2),
)

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

console.log(JSON.stringify({ pptxPath, slideDirectory, audioDirectory, manifestPath, slideCount: slides.length }, null, 2))
