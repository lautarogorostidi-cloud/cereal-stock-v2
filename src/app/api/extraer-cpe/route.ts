import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY no está configurada')
      return NextResponse.json({ ok: false, error: 'API key no configurada' }, { status: 500 })
    }

    const { base64, mediaType } = await request.json()

    if (!base64) {
      return NextResponse.json({ ok: false, error: 'No se recibió el PDF' }, { status: 400 })
    }

    console.log('Llamando a Claude API...')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: mediaType ?? 'application/pdf', data: base64 }
            },
            {
              type: 'text',
              text: `Extraé los datos de esta Carta de Porte Electrónica (CPE) argentina y devolvé ÚNICAMENTE un JSON válido sin markdown ni texto adicional con estos campos:
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
  "declaracion_calidad": "conforme o condicional",
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
  "km_recorrer": "",
  "nro_turno": ""
}
Para fechas usá formato YYYY-MM-DD. Para campaña devolvé formato "25-26". Si un campo no existe dejalo "".`
            }
          ]
        }]
      })
    })

    console.log('Respuesta de Claude:', response.status)

    if (!response.ok) {
      const errBody = await response.text()
      console.error('Error de Claude API:', errBody)
      return NextResponse.json({ ok: false, error: `Error API: ${response.status} - ${errBody}` }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''
    console.log('Texto extraído:', text.substring(0, 200))
    
    const clean = text.replace(/```json|```/g, '').trim()
    const extracted = JSON.parse(clean)

    return NextResponse.json({ ok: true, data: extracted })
  } catch (err: any) {
    console.error('Error general:', err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}