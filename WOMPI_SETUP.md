# Wompi + página pública de compra — checklist final

## 1. Reglas Realtime Database

Publica `FIREBASE_SECURITY_RULES.json` (ya corregidas: `replace` con strings, paréntesis, colaboradores).

## 2. Variables de entorno en Cloud Functions (producción)

Las funciones leen **`process.env`**. Debes definirlas en **Google Cloud Console**:

1. [Cloud Run](https://console.cloud.google.com/run) → filtra por región **us-central1**
2. Abre el servicio **`preparewompipayment`** (o nombre similar) → **Editar e implementar nueva revisión** → **Variables y secretos** → agrega:

| Variable | Valor (desde Wompi → Desarrollo → Programadores) |
|----------|---------------------------------------------------|
| `WOMPI_PUBLIC_KEY` | Llave pública `pub_prod_...` |
| `WOMPI_INTEGRITY_SECRET` | Secreto de integridad `prod_integrity_...` |
| `WOMPI_EVENTS_SECRET` | Secreto de eventos `prod_events_...` |
| `PUBLIC_APP_URL` | `https://TU-PROYECTO.web.app` (recomendado) |

3. Repite para el servicio **`wompiwebhook`** (mismas variables; al menos `WOMPI_EVENTS_SECRET` para validar el webhook).

> Tras cambiar variables, despliega una nueva revisión o vuelve a ejecutar `firebase deploy --only functions`.

**Local / emulador:** copia `functions/.env.example` a `functions/.env` y rellena (está en `.gitignore`).

## 3. URL de eventos en Wompi

En el dashboard de comercios, **URL de eventos**:

`https://TU-DOMINIO.web.app/api/wompiWebhook`

(misma URL que usa Firebase Hosting + rewrites de `firebase.json`).

## 4. Despliegue

```bash
cd functions && npm install && cd ..
npm run deploy:all
```

O por partes: `npm run build`, luego `firebase deploy --only functions`, luego `firebase deploy --only hosting`.

**Requisito:** plan de pago Blaze para Functions (si Firebase lo pide).

## 5. Organizador en la app

En cada evento: **Venta pública (Wompi)** → activar, precio COP, **Guardar**, **Copiar enlace** `/comprar/...`.

## 6. Seguridad del webhook

Si `WOMPI_EVENTS_SECRET` está definido, se valida el checksum según [documentación Wompi Colombia (Eventos → Seguridad)](https://docs.wompi.co/docs/colombia/eventos/). También se comprueba que `amount_in_cents` coincida con el pedido pendiente.

## 7. Desarrollo local (Vite)

Las peticiones a `/api/...` no llegan a Functions desde `localhost:5173`. Opciones:

- Probar compra en **producción** tras deploy, o
- Variable en `.env` del front: `VITE_API_BASE=http://127.0.0.1:5001/TU_PROJECT_ID/us-central1` y emulador (ruta exacta según salida del emulador).

---

**No subas** llaves ni secretos al repositorio. Si los expusiste en un chat público, **regenera** secretos en Wompi y actualiza las variables en Cloud Run.
