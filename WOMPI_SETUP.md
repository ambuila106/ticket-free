# Wompi + página pública de compra

## Rama

Los cambios están en la rama `feature/public-evento-wompi`.

## Qué hace

- **Ruta pública** (sin login): `/comprar/:ownerUid/:discotecaId/:eventoId`
- Los compradores **no** acceden al dashboard; solo ven info del evento y el formulario de pago.
- Los datos públicos viven en **`publicEvents/...`** en Realtime Database (no se exponen los tickets).
- **Cloud Functions** preparan el pago (firma de integridad) y el **webhook** crea el ticket al aprobar el pago.

## 1. Reglas de Firebase

Publica las reglas de `FIREBASE_SECURITY_RULES.json` en la consola de Firebase (Realtime Database > Reglas).

## 2. Variables de entorno (Functions)

En [Google Cloud Console](https://console.cloud.google.com) → Cloud Functions → tu función → Editar → Variables de entorno, o con CLI:

```bash
# Ejemplo (ajusta valores reales de tu panel Wompi)
firebase functions:config:set wompi.integrity="TU_SECRETO"  # legado; preferible env en Cloud
```

Para **2nd gen**, define variables en la consola o usa Secret Manager:

- `WOMPI_INTEGRITY_SECRET` — Desarrolladores > Secreto de integridad
- `WOMPI_PUBLIC_KEY` — Llave pública `pub_test_` o `pub_prod_`
- `PUBLIC_APP_URL` — URL de tu sitio (ej. `https://chatonline-4aa0d.web.app`)
- `WOMPI_EVENTS_SECRET` — (opcional) para validar webhooks si Wompi lo ofrece

Copia `functions/.env.example` a `functions/.env` para el **emulador** (no subas `.env` a git).

## 3. Webhook en Wompi

En el panel de Wompi, configura la URL del evento de transacciones:

`https://TU_DOMINIO/api/wompiWebhook`

(Con Firebase Hosting + rewrites, es la misma URL que tu app en producción.)

## 4. Despliegue

```bash
cd functions && npm install && cd ..
firebase deploy --only functions,hosting
```

Primera vez con Functions: habilita la API y la cuenta de facturación si Firebase lo pide.

## 5. Front: desarrollo local

Las peticiones van a `/api/...`. Con Vite en `localhost:5173` no hay proxy a Functions por defecto.

Opciones:

- Usa **Firebase emulators** y en `.env` del front (Vite):

  `VITE_API_BASE=http://127.0.0.1:5001/chatonline-4aa0d/us-central1`

  (La ruta exacta puede variar; revisa la salida del emulador.)

- O prueba solo en **producción** tras deploy.

## 6. Organizador: enlace público

En la vista del evento (rol organizador), bloque **“Venta pública (Wompi)”**: activar, precio en COP, guardar y **copiar enlace** para compartir.

## Notas

- El `ownerUid` en la URL es el UID de Firebase del organizador; quien tenga el enlace puede ver la página pública, no el panel admin.
- Revisa en la documentación de Wompi Colombia el formato de **centavos** en COP si algo no cuadra con montos.
