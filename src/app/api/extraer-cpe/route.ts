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
- peso_bruto_kg: número en "Peso Bruto" de la sección B - GRANO / ESPECIE (origen, NO el de sección G)
- peso_tara_kg: número en "Peso Tara" de la sección B - GRANO / ESPECIE (origen, NO el de sección G)
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
- fecha_arribo: "Fecha Arribo:" solo fecha YYYY-MM-DD
- fecha_descarga: "Fecha Descarga:" solo fecha YYYY-MM-DD
- nro_turno: "N° Turno:"
- peso_bruto_destino: número en "Peso Bruto (kg):" que aparece DENTRO de la sección G - DESCARGA (NO el de sección B)
- peso_tara_destino: número en "Peso Tara (kg):" que aparece DENTRO de la sección G - DESCARGA (NO el de sección B)
- humedad_destino: humedad en destino si aparece

Devolvé ÚNICAMENTE el JSON sin markdown:
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