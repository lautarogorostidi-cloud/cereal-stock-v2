import { NextRequest, NextResponse } from 'next/server'

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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: mediaType ?? 'application/pdf', data: base64 }
            },
            {
              type: 'text',
              text: `Sos un experto en Cartas de Porte Electrónicas (CPE) argentinas del sistema ARCA/AFIP.
Extraé TODOS los datos de este documento con máxima precisión.

REGLAS DE EXTRACCIÓN:
- numero_cpe: el número después de "N° CPE:" (ej: "00000-00000181")
- ctg: el número después de "CTG:" (ej: "10132532577")
- fecha_emision: campo "Fecha:" en formato YYYY-MM-DD (ej: "27/05/2026" → "2026-05-27")
- fecha_vencimiento: campo "Vencimiento:" en formato YYYY-MM-DD (ej: "31/05/2026" → "2026-05-31")
- campania: campo "Campaña:" convertido (ej: "2526" → "25-26", "2425" → "24-25")
- cultivo: nombre del grano en "Grano / Tipo:" (ej: "Girasol", "Soja", "Trigo")
- cuit_titular: CUIT en "Titular Carta de Porte:" (solo el número, ej: "30717870944")
- remitente_comercial: nombre en "Rte. Comercial Venta Primaria:" (ej: "FEDEA S A")
- cuit_remitente: CUIT del remitente (ej: "30685141694")
- destinatario: nombre en "Destinatario:" (ej: "COFCO INTERNATIONAL ARGENTINA S.A.")
- cuit_destinatario: CUIT del destinatario (ej: "33506737449")
- representante_entregador: nombre en "Representante entregador:" (ej: "CUCCHETTI LUCIANO NICOLAS")
- cuit_rep_entregador: CUIT del rep entregador (ej: "20438647601")
- flete_pagador: nombre en "Flete pagador:" (solo el nombre, sin CUIT)
- chofer_nombre: nombre en "Chofer:" (ej: "SEQUEIRA CRISTIAN GABRIEL")
- chofer_cuil: CUIT/CUIL del chofer (ej: "20370353701")
- peso_bruto_kg: "Peso Bruto" en sección B (ej: "48500")
- peso_tara_kg: "Peso Tara" en sección B (ej: "18500")
- declaracion_calidad: si está marcado "Conforme" devolvé "conforme", si "Condicional" devolvé "condicional"
- procedencia_localidad: "Localidad:" en sección C (ej: "TRES LOMAS")
- procedencia_provincia: "Provincia" en sección C (ej: "BUENOS AIRES")
- renspa: el valor después de "RENSPA" en sección C
- descripcion_campo: "Descripción" en sección C (ej: "CAMPO MEDIA LUNA")
- latitud: "Latitud:" en sección C (ej: "36° 36' 04''")
- longitud: "Longitud:" en sección C (ej: "62° 47' 33''")
- destino_localidad: "Localidad:" en sección D (ej: "JUNIN")
- destino_provincia: "Provincia:" en sección D (ej: "BUENOS AIRES")
- nro_planta: "N° Planta" en sección D (ej: "21584")
- destino_direccion: "Dirección:" en sección D (ej: "RUTA 7 KM 266")
- patente_camion: primera patente en "Dominios:" (ej: "AF456OU")
- patente_acoplado: segunda patente en "Dominios:" (ej: "AF456OT")
- fecha_partida: "Partida:" en sección E, formato datetime-local (ej: "27/05/2026 16:00:00" → "2026-05-27T16:00")
- km_recorrer: "Kms. a recorrer:" en sección E (ej: "350")
- fecha_arribo: "Fecha Arribo:" en sección G, solo la fecha YYYY-MM-DD (ej: "28/05/2026 13:55:34" → "2026-05-28")
- fecha_descarga: "Fecha Descarga:" en sección G, solo la fecha YYYY-MM-DD (ej: "28/05/2026 19:56:21" → "2026-05-28")
- nro_turno: "N° Turno:" en sección G (ej: "COSA2743-28052026")
- peso_bruto_destino: "Peso Bruto (kg):" en sección G (ej: "50800")
- peso_tara_destino: "Peso Tara (kg):" en sección G (ej: "19060")
- humedad_destino: dejalo "" si no aparece

Devolvé ÚNICAMENTE el JSON sin markdown:
{
  "numero_cpe": "",
  "ctg": "",
  "fecha_emision": "",
  "fecha_vencimiento": "",
  "campania": "",
  "cultivo": "",
  "cuit_titular": "",
  "remitente_comercial": "",
  "cuit_remitente": "",
  "destinatario": "",
  "cuit_destinatario": "",
  "representante_entregador": "",
  "cuit_rep_entregador": "",
  "flete_pagador": "",
  "chofer_nombre": "",
  "chofer_cuil": "",
  "peso_bruto_kg": "",
  "peso_tara_kg": "",
  "declaracion_calidad": "",
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
  "fecha_arribo": "",
  "fecha_descarga": "",
  "nro_turno": "",
  "peso_bruto_destino": "",
  "peso_tara_destino": "",
  "humedad_destino": ""
}`
            }
          ]
        }]
      })
    })

    if (!response.ok) {
      const errBody = await response.text()
      return NextResponse.json({ ok: false, error: `Error API: ${response.status} - ${errBody}` }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const extracted = JSON.parse(clean)

    return NextResponse.json({ ok: true, data: extracted })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
