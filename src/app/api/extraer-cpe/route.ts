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
        max_tokens: 1500,
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
Extraé TODOS los datos visibles en este documento y devolvé ÚNICAMENTE un JSON válido sin markdown.

Reglas importantes:
- fechas en formato YYYY-MM-DD
- Para "fecha_partida" buscá en la sección "E - DATOS DEL TRANSPORTE" el campo "Partida:" que tiene fecha y hora (ej: "27/05/2026 16:00:00") → convertí a "2026-05-27T16:00"
- Para "campania" extraé el número como "25-26" o "24-25" (el campo dice "Campaña: 2526" → devolvé "25-26")
- Para "cultivo" extraé el nombre del grano (ej: "Girasol", "Soja", "Trigo")
- Para "km_recorrer" buscá "Kms. a recorrer:" 
- Para "nro_planta" buscá "N° Planta"
- Para "destino_direccion" buscá "Dirección:" en la sección D
- Para "renspa" buscá "RENSPA" en la sección C
- Para "descripcion_campo" buscá "Descripción" en la sección C
- Para "declaracion_calidad" mirá si dice "Conforme" o "Condicional" en la sección B
- Si un campo no existe o está vacío en el documento, dejalo ""

JSON a completar:
{
  "numero_cpe": "",
  "ctg": "",
  "fecha_emision": "YYYY-MM-DD",
  "fecha_vencimiento": "YYYY-MM-DD",
  "campania": "",
  "cultivo": "",
  "cuit_titular": "",
  "remitente_comercial": "",
  "cuit_remitente": "",
  "destinatario": "",
  "cuit_destinatario": "",
  "representante_entregador": "",
  "cuit_rep_entregador": "",
  "chofer_nombre": "",
  "chofer_cuil": "",
  "flete_pagador": "",
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
  "nro_turno": "",
  "fecha_arribo": "",
  "fecha_descarga": "",
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
      console.error('Error de Claude API:', errBody)
      return NextResponse.json({ ok: false, error: `Error API: ${response.status} - ${errBody}` }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const extracted = JSON.parse(clean)

    return NextResponse.json({ ok: true, data: extracted })
  } catch (err: any) {
    console.error('Error general:', err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
