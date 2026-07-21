import { NextRequest, NextResponse } from 'next/server'

const PROMPT_EXTRACCION = `Sos un experto en Cartas de Porte Electrónicas (CPE) argentinas del sistema ARCA/AFIP.
Extraé TODOS los datos de este documento con máxima precisión. Si un campo está vacío en el documento dejalo "".

SECCIÓN A - INTERVINIENTES:
- cuit_titular: CUIT en "Titular Carta de Porte:" (solo número)
- razon_social_titular: razón social en "Titular Carta de Porte:" (solo el nombre, sin CUIT)
- remitente_comercial_productor: nombre en "Remitente Comercial Productor:"
- remitente_comercial: nombre en "Rte. Comercial Venta Primaria:"
- cuit_remitente: CUIT del Rte. Comercial Venta Primaria
- remitente_venta_secundaria: nombre en "Rte. Comercial Venta secundaria:"
- cuit_rte_secundaria: CUIT del Rte. Venta Secundaria
- remitente_venta_secundaria2: nombre en "Rte. Comercial Venta secundaria 2:"
- cuit_rte_secundaria2: CUIT del Rte. Venta Secundaria 2
- mercado_termino: nombre en "Mercado a Término:"
- corredor_venta_primaria: nombre en "Corredor Venta Primaria:"
- cuit_corredor_primaria: CUIT del Corredor Venta Primaria
- corredor_venta_secundaria: nombre en "Corredor Venta Secundaria:"
- cuit_corredor_secundaria: CUIT del Corredor Venta Secundaria
- representante_entregador: nombre en "Representante entregador:"
- cuit_rep_entregador: CUIL del Representante entregador
- representante_recibidor: nombre en "Representante recibidor:"
- cuit_rep_recibidor: CUIL del Representante recibidor
- destinatario: nombre en "Destinatario:"
- cuit_destinatario: CUIT del Destinatario
- destino: nombre en "Destino:"
- cuit_destino: CUIT del Destino
- empresa_transportista: nombre en "Empresa Transportista:"
- cuit_transportista: CUIT de la Empresa Transportista
- flete_pagador: nombre en "Flete pagador:" (sin CUIT)
- intermediario_flete: nombre en "Intermediario de flete:"
- cuit_intermediario: CUIT del Intermediario de flete
- chofer_nombre: nombre en "Chofer:" (solo nombre)
- chofer_cuil: CUIL del Chofer

SECCIÓN B - GRANO:
- cultivo: nombre del grano en "Grano / Tipo:"
- campania: campo "Campaña:" convertido (ej: "2526" a "25-26")
- peso_bruto_kg: número de "Peso Bruto" en sección B SOLAMENTE (NO de sección G). En sección B los campos NO tienen (kg) entre paréntesis.
- peso_tara_kg: número de "Peso Tara" en sección B SOLAMENTE (NO de sección G). Valor típico entre 15000 y 20000.
- declaracion_calidad: "conforme" o "condicional"
- humedad_origen: humedad en origen si aparece

SECCIÓN C - PROCEDENCIA:
- procedencia_localidad: "Localidad:" en sección C
- procedencia_provincia: "Provincia" en sección C
- renspa: valor después de "RENSPA"
- descripcion_campo: "Descripción" en sección C
- latitud: "Latitud:" en sección C
- longitud: "Longitud:" en sección C

SECCIÓN D - DESTINO:
- destino_localidad: "Localidad:" en sección D
- destino_provincia: "Provincia:" en sección D
- nro_planta: "N° Planta" en sección D
- destino_direccion: "Dirección:" en sección D

IDENTIFICACIÓN CPE:
- numero_cpe: número después de "N° CPE:"
- ctg: número después de "CTG:"
- fecha_emision: "Fecha:" en formato YYYY-MM-DD
- fecha_vencimiento: "Vencimiento:" en formato YYYY-MM-DD

SECCIÓN E - TRANSPORTE:
- patente_camion: primera patente en "Dominios:"
- patente_acoplado: segunda patente en "Dominios:"
- fecha_partida: "Partida:" convertí DD/MM/YYYY HH:MM:SS a formato "YYYY-MM-DDTHH:MM" (ej: "15/05/2026 10:00:00" → "2026-05-15T10:00")
- km_recorrer: "Kms. a recorrer:"
- tarifa_flete: "Tarifa:" en sección E (valor numérico, ej: 35.7)

SECCIÓN G - DESCARGA:
IMPORTANTE: Esta sección tiene los labels en una columna y los valores numéricos en otra columna del PDF.
El layout típico es:
  Labels:          Valores:
  Peso Bruto (kg): 50540
  Peso Neto (kg):  31520
  Peso Tara (kg):  19020
Los valores de esta sección son DISTINTOS a los de sección B.
- fecha_arribo: fecha en "Fecha Arribo:" formato YYYY-MM-DD
- fecha_descarga: fecha en "Fecha Descarga:" formato YYYY-MM-DD
- nro_turno: valor en "N° Turno:"
- peso_bruto_destino: número asociado a "Peso Bruto (kg):" en sección G ÚNICAMENTE. Este número es el peso del camión cargado al llegar a destino, SIEMPRE mayor a 30000. NO usar valores de sección B.
- peso_tara_destino: número asociado a "Peso Tara (kg):" en sección G ÚNICAMENTE. Es el peso del camión vacío en destino. NO usar valores de sección B.
- humedad_destino: humedad en destino si aparece

Devolvé ÚNICAMENTE el objeto JSON de una sola vez, completo, sin markdown, sin texto antes ni después, y sin explicaciones:
{
  "numero_cpe": "",
  "ctg": "",
  "fecha_emision": "",
  "fecha_vencimiento": "",
  "campania": "",
  "cultivo": "",
  "cuit_titular": "",
  "razon_social_titular": "",
  "remitente_comercial_productor": "",
  "remitente_comercial": "",
  "cuit_remitente": "",
  "remitente_venta_secundaria": "",
  "cuit_rte_secundaria": "",
  "remitente_venta_secundaria2": "",
  "cuit_rte_secundaria2": "",
  "mercado_termino": "",
  "corredor_venta_primaria": "",
  "cuit_corredor_primaria": "",
  "corredor_venta_secundaria": "",
  "cuit_corredor_secundaria": "",
  "representante_entregador": "",
  "cuit_rep_entregador": "",
  "representante_recibidor": "",
  "cuit_rep_recibidor": "",
  "destinatario": "",
  "cuit_destinatario": "",
  "destino": "",
  "cuit_destino": "",
  "empresa_transportista": "",
  "cuit_transportista": "",
  "flete_pagador": "",
  "intermediario_flete": "",
  "cuit_intermediario": "",
  "chofer_nombre": "",
  "chofer_cuil": "",
  "peso_bruto_kg": "",
  "peso_tara_kg": "",
  "declaracion_calidad": "",
  "humedad_origen": "",
  "procedencia_localidad": "",
  "procedencia_provincia": "",
  "renspa": "",
  "descripcion_campo": "",
  "latitud": "",
  "longitud": "",
  "destino_localidad": "",
  "destino_provincia": "",
  "nro_planta": "",
  "destino_direccion": "",
  "patente_camion": "",
  "patente_acoplado": "",
  "fecha_partida": "",
  "km_recorrer": "",
  "tarifa_flete": "",
  "fecha_arribo": "",
  "fecha_descarga": "",
  "nro_turno": "",
  "peso_bruto_destino": "",
  "peso_tara_destino": "",
  "humedad_destino": ""
}`

type Resultado = { ok: true; data: any } | { ok: false; error: string; reintentable: boolean }

async function intentarExtraccion(apiKey: string, base64: string, mediaType: string): Promise<Resultado> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: mediaType ?? 'application/pdf', data: base64 }
          },
          { type: 'text', text: PROMPT_EXTRACCION }
        ]
      }]
    })
  })

  if (!response.ok) {
    const errBody = await response.text()
    // Errores del servidor de Anthropic (5xx) o de rate limit (429) vale la pena reintentarlos
    const reintentable = response.status === 429 || response.status >= 500
    return { ok: false, error: `Error API: ${response.status} - ${errBody}`, reintentable }
  }

  const data = await response.json()

  // La API respondió 200 pero con un payload de error (poco común, pero posible)
  if (data.type === 'error') {
    const msg = data.error?.message ?? JSON.stringify(data.error ?? data)
    console.error('extraer-cpe: la API devolvió un error con status 200:', msg)
    return { ok: false, error: `Error de la API: ${msg}`, reintentable: true }
  }

  if (data.stop_reason === 'max_tokens') {
    console.error('extraer-cpe: respuesta truncada por max_tokens', JSON.stringify(data).slice(0, 500))
    return { ok: false, error: 'La respuesta del modelo se cortó por longitud.', reintentable: true }
  }

  if (data.stop_reason === 'refusal') {
    console.error('extraer-cpe: el modelo rechazó procesar el documento', JSON.stringify(data).slice(0, 500))
    return { ok: false, error: 'El modelo no pudo procesar este documento.', reintentable: true }
  }

  // El modelo puede devolver un bloque "thinking" antes del bloque "text" (razonamiento extendido).
  // Buscamos específicamente el bloque de tipo "text", no asumimos que sea el primero.
  const text = data.content?.find((b: any) => b.type === 'text')?.text ?? ''
  let clean = text.replace(/```json|```/g, '').trim()

  // Si vino texto extra antes/después del JSON, nos quedamos solo con el bloque { ... }
  const inicio = clean.indexOf('{')
  const fin = clean.lastIndexOf('}')
  if (inicio !== -1 && fin !== -1 && fin > inicio) {
    clean = clean.slice(inicio, fin + 1)
  }

  if (!clean) {
    // Diagnóstico temporal: mostramos en el propio error qué devolvió realmente la API,
    // para poder ver la causa real sin necesitar acceso a los logs de Vercel.
    const tiposBloques = Array.isArray(data.content) ? data.content.map((b: any) => b.type).join(',') : typeof data.content
    const diagnostico = `stop_reason=${data.stop_reason ?? 'N/A'} bloques=[${tiposBloques}] usage=${JSON.stringify(data.usage ?? {})}`
    console.error('extraer-cpe: respuesta vacía del modelo —', diagnostico, JSON.stringify(data).slice(0, 800))
    return { ok: false, error: `El modelo no devolvió datos (${diagnostico}).`, reintentable: true }
  }

  try {
    const extracted = JSON.parse(clean)
    return { ok: true, data: extracted }
  } catch (parseErr: any) {
    console.error('extraer-cpe: JSON inválido:', clean.slice(0, 1000))
    return { ok: false, error: `No se pudo interpretar la respuesta del modelo (${parseErr.message}).`, reintentable: true }
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'API key no configurada' }, { status: 500 })
    }

    const { base64, mediaType } = await request.json()
    if (!base64) {
      return NextResponse.json({ ok: false, error: 'No se recibió el PDF' }, { status: 400 })
    }

    let resultado = await intentarExtraccion(apiKey, base64, mediaType)

    // Si falló por algo transitorio (truncamiento, JSON incompleto, 429/5xx), reintentamos automáticamente una vez
    if (!resultado.ok && resultado.reintentable) {
      console.warn('extraer-cpe: primer intento falló, reintentando —', resultado.error)
      resultado = await intentarExtraccion(apiKey, base64, mediaType)
    }

    if (!resultado.ok) {
      return NextResponse.json({ ok: false, error: resultado.error }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data: resultado.data })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
