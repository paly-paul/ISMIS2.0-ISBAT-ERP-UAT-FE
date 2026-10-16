// Minimal .xlsx reader/writer for the browser — no dependency. Covers what
// mark-import templates need: read the first sheet's cell values as strings,
// and (mock mode only) write a one-sheet workbook. An .xlsx file is a zip of
// XML parts; unzipping uses the built-in DecompressionStream('deflate-raw').
// Not a general spreadsheet library: no formulas evaluated (the cached value
// is read), no dates, no styles beyond what Excel needs to open the file.

// ── Zip ────────────────────────────────────────────────────────────────────

interface ZipEntry { name: string; method: number; compressedSize: number; localOffset: number }

function readZipEntries(buf: DataView): ZipEntry[] {
  // End of central directory: signature 0x06054b50, searched from the end
  // (a trailing comment of up to 64 KB may follow it).
  let eocd = -1
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 65535); i--) {
    if (buf.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd === -1) throw new Error('This file is not a valid Excel workbook (.xlsx).')
  const count = buf.getUint16(eocd + 10, true)
  let p = buf.getUint32(eocd + 16, true)
  const entries: ZipEntry[] = []
  const decoder = new TextDecoder()
  for (let i = 0; i < count; i++) {
    if (buf.getUint32(p, true) !== 0x02014b50) break
    const method = buf.getUint16(p + 10, true)
    const compressedSize = buf.getUint32(p + 20, true)
    const nameLen = buf.getUint16(p + 28, true)
    const extraLen = buf.getUint16(p + 30, true)
    const commentLen = buf.getUint16(p + 32, true)
    const localOffset = buf.getUint32(p + 42, true)
    const name = decoder.decode(new Uint8Array(buf.buffer, buf.byteOffset + p + 46, nameLen))
    entries.push({ name, method, compressedSize, localOffset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

async function readZipEntry(buf: DataView, entry: ZipEntry): Promise<string> {
  const p = entry.localOffset
  const nameLen = buf.getUint16(p + 26, true)
  const extraLen = buf.getUint16(p + 28, true)
  const start = p + 30 + nameLen + extraLen
  const data = new Uint8Array(buf.buffer, buf.byteOffset + start, entry.compressedSize)
  if (entry.method === 0) return new TextDecoder().decode(data)
  if (entry.method !== 8) throw new Error('This workbook uses an unsupported compression method.')
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(stream).text()
}

// ── Read ───────────────────────────────────────────────────────────────────

const parseXml = (s: string) => new DOMParser().parseFromString(s, 'application/xml')
const byTag = (node: Document | Element, tag: string) => Array.from(node.getElementsByTagNameNS('*', tag))

// "BC12" → 54 (0-based column index).
function columnIndex(ref: string): number {
  let n = 0
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function resolvePath(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = base.split('/').slice(0, -1)
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

export interface SheetData {
  name: string
  // rows[r][c], every value as trimmed text ('' for empty cells).
  rows: string[][]
}

async function openWorkbook(file: Blob) {
  const buf = new DataView(await file.arrayBuffer())
  const entries = readZipEntries(buf)
  const byName = new Map(entries.map(e => [e.name, e]))
  const read = async (name: string) => {
    const e = byName.get(name)
    return e ? readZipEntry(buf, e) : null
  }
  const workbookXml = await read('xl/workbook.xml')
  if (!workbookXml) throw new Error('This file is not a valid Excel workbook (.xlsx).')
  const sheets = byTag(parseXml(workbookXml), 'sheet')
  return { read, sheets }
}

// Names of every sheet, in workbook order.
export async function listSheetNames(file: Blob): Promise<string[]> {
  const { sheets } = await openWorkbook(file)
  return sheets.map((s, i) => s.getAttribute('name') ?? `Sheet${i + 1}`)
}

// Reads the first sheet of an .xlsx file.
export function readFirstSheet(file: Blob): Promise<SheetData> {
  return readSheet(file)
}

// Reads one sheet by name (the first sheet when no name is given).
export async function readSheet(file: Blob, name?: string): Promise<SheetData> {
  const { read, sheets } = await openWorkbook(file)
  const firstSheet = name === undefined ? sheets[0] : sheets.find(s => s.getAttribute('name') === name)
  if (!firstSheet) throw new Error(name === undefined ? 'The workbook has no sheets.' : `The sheet "${name}" was not found in the workbook.`)
  const sheetName = firstSheet.getAttribute('name') ?? 'Sheet1'
  const relId = firstSheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? firstSheet.getAttribute('r:id')

  let sheetPath = 'xl/worksheets/sheet1.xml'
  const relsXml = await read('xl/_rels/workbook.xml.rels')
  if (relsXml && relId) {
    const rel = byTag(parseXml(relsXml), 'Relationship').find(r => r.getAttribute('Id') === relId)
    const target = rel?.getAttribute('Target')
    if (target) sheetPath = resolvePath('xl/workbook.xml', target)
  }

  const sharedXml = await read('xl/sharedStrings.xml')
  const shared = sharedXml
    ? byTag(parseXml(sharedXml), 'si').map(si => byTag(si, 't').map(t => t.textContent ?? '').join(''))
    : []

  const sheetXml = await read(sheetPath)
  if (!sheetXml) throw new Error('The first sheet of the workbook could not be read.')
  const rows: string[][] = []
  for (const row of byTag(parseXml(sheetXml), 'row')) {
    const r = Number(row.getAttribute('r') ?? rows.length + 1) - 1
    const values: string[] = []
    let next = 0
    for (const c of byTag(row, 'c')) {
      const ref = c.getAttribute('r')
      const col = ref ? columnIndex(ref) : next
      next = col + 1
      const type = c.getAttribute('t')
      let value = ''
      if (type === 'inlineStr') value = byTag(c, 't').map(t => t.textContent ?? '').join('')
      else {
        const v = byTag(c, 'v')[0]?.textContent ?? ''
        value = type === 's' ? shared[Number(v)] ?? '' : v
      }
      values[col] = value.trim()
    }
    rows[r] = Array.from(values, v => v ?? '')
  }
  return { name: sheetName, rows: Array.from(rows, r => r ?? []) }
}

// ── Write (mock mode) ──────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// Uncompressed ("stored") zip — larger than deflate, but trivial to build.
function zipStored(files: { name: string; content: string }[]): Blob {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const data = enc.encode(f.content)
    const crc = crc32(data)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true)
    local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true)
    local.setUint16(26, name.length, true)
    chunks.push(new Uint8Array(local.buffer), name, data)
    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true)
    cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true)
    cd.setUint16(28, name.length, true); cd.setUint32(42, offset, true)
    central.push(new Uint8Array(cd.buffer), name)
    offset += 30 + name.length + data.length
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true)
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true)
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function colLetter(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

// One sheet; row 0 is written bold. Numbers stay numeric cells.
export function writeWorkbook(sheetName: string, rows: (string | number | null)[][]): Blob {
  const sheetRows = rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => {
    if (v === null || v === '') return ''
    const ref = `${colLetter(c)}${r + 1}`
    const style = r === 0 ? ' s="1"' : ''
    return typeof v === 'number'
      ? `<c r="${ref}"${style}><v>${v}</v></c>`
      : `<c r="${ref}"${style} t="inlineStr"><is><t>${esc(v)}</t></is></c>`
  }).join('')}</row>`).join('')
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  return zipStored([
    { name: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: '_rels/.rels', content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}" xmlns:r="${rel}"><sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', content: `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${ns}"><fonts count="2"><font/><font><b/></font></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>` },
    { name: 'xl/worksheets/sheet1.xml', content: `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetData>${sheetRows}</sheetData></worksheet>` },
  ])
}

// Triggers a browser download of a blob.
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
