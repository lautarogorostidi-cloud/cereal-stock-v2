import { NextRequest, NextResponse } from 'next/server'

const MAG_URL = 'https://www.mercadoagroganadero.com.ar/dll/hacienda2.dll/haciinfo000013'

function parsearNumeroAR(str: string): number | null {
  const limpio = str.replace(/\./g, '').replace(',', '.').trim()
  const n = parseFloat(limpio)
  return isNaN(n) ? null : n
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde') // DD/MM/YYYY
  const hasta = searchParams.get('hasta')

  if (!desde || !hasta) {
    return NextResponse.json({ error: 'Parámetros desde y hasta requeridos.' }, { status: 400 })
  }

  try {
    const body = new URLSearchParams({
      txtFechaIni: desde,
      txtFechaFin: hasta,
      ID: '',
      CP: '',
      FLASH: '',
      USUARIO: 'SIN IDENTIFICAR',
      OPCIONMENU: '',
      OPCIONSUBMENU: '',
    })

    const res = await fetch(MAG_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': MAG_URL,
        'Origin': 'https://www.mercadoagroganadero.com.ar',
      },
      body: body.toString(),
    })

    const html = await res.text()
    const filas = parsearTabla(html)

    if (filas.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron datos para el período seleccionado.' },
        { status: 404 }
      )
    }

    const filasConIndice = filas.filter((f) => f.indice !== null)
    const totalCabezas = filas.reduce((s, f) => s + f.cabezas, 0)
    const totalImporte = filas.reduce((s, f) => s + f.importe, 0)
    const precioPorCabeza = totalCabezas > 0 ? totalImporte / totalCabezas : 0

    const cabezasConIndice = filasConIndice.reduce((s, f) => s + f.cabezas, 0)
    const indicePonderado = cabezasConIndice > 0
      ? filasConIndice.reduce((s, f) => s + f.indice! * f.cabezas, 0) / cabezasConIndice
      : null

    const pesoPromedio = indicePonderado && precioPorCabeza > 0
      ? precioPorCabeza / indicePonderado
      : null

    return NextResponse.json({
      filas,
      resumen: {
        totalCabezas,
        totalImporte,
        precioPorCabeza: Math.round(precioPorCabeza),
        indicePonderado: indicePonderado !== null ? Math.round(indicePonderado * 1000) / 1000 : null,
        pesoPromedio: pesoPromedio !== null ? Math.round(pesoPromedio * 10) / 10 : null,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error al obtener datos.' }, { status: 500 })
  }
}

function parsearTabla(html: string) {
  const filas: {
    fecha: string
    cabezas: number
    importe: number
    indice: number | null
    faltaCerrar: boolean
  }[] = []

  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let trMatch: RegExpExecArray | null

  while ((trMatch = trRe.exec(html)) !== null) {
    const rowHtml = trMatch[1]
    const celdas: string[] = []
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let tdMatch: RegExpExecArray | null
    while ((tdMatch = tdRe.exec(rowHtml)) !== null) {
      celdas.push(tdMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim())
    }

    if (celdas.length < 4) continue
    const primeraLower = celdas[0].toLowerCase()
    if (
      primeraLower.includes('fecha') ||
      primeraLower.includes('total') ||
      primeraLower.includes('cab.')
    ) continue

    const cabezas = parsearNumeroAR(celdas[1])
    const importe = parsearNumeroAR(celdas[2])
    if (!cabezas || !importe) continue

    const indiceRaw = celdas[3].trim()
    const faltaCerrar =
      indiceRaw.toLowerCase().includes('falta') ||
      indiceRaw.toLowerCase().includes('cerrar') ||
      indiceRaw === '-' ||
      indiceRaw === '- *' ||
      indiceRaw === ''
    const indice = faltaCerrar ? null : parsearNumeroAR(indiceRaw)

    filas.push({ fecha: celdas[0], cabezas, importe, indice, faltaCerrar })
  }

  return filas
}
