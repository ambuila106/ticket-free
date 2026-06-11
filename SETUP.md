# Festi / Ticket Free — Guía de configuración

Pago por **transferencia manual (Nequi / BRE-B)**, panel de **administración**,
**Mis entradas** (QRs del cliente + transferencias) y **landing pública** de eventos.

## 1. Roles

- **Administrador** (`ambuila106@gmail.com`, ver `src/config/appConfig.js` → `ADMIN_EMAILS`):
  entra a `/admin`. Gestiona usuarios (activa/desactiva el rol **organizador**),
  decide qué eventos se muestran en la landing (`/eventos`) y ve/borra todos los comprobantes.
- **Organizador**: crea discotecas y eventos. **Solo funciona si el admin lo activa**
  (botón en `/admin` → pestaña *Usuarios*). Si no está activado, ve la tarjeta deshabilitada en `/select-role`.
- **Colaborador**: vende a terceros. Al comprar **no se autorrellenan** sus datos
  (debe escribir los del cliente en cada venta).
- **Cliente**: cualquiera con QRs. Entra a `/mis-qrs` para ver, descargar y **transferir** entradas.

## 2. Reglas de seguridad

- **Realtime Database**: `FIREBASE_SECURITY_RULES.json` (nodos `appUsers`, `eventsIndex`,
  `userQrs`, `pendingTransfers`, `comprobantes`; ticket admite estado `sin_validar`).
- **Storage**: `storage.rules` (comprobantes en `comprobantes/{ownerUid}/{eventoId}/{uploaderUid}/...`).
- Ambas se enlazan en `firebase.json`.

```bash
firebase deploy --only database
firebase deploy --only storage
```

## 3. Cloud Functions

Definidas en `functions/index.js` (Node 20, firebase-functions v2):

| Función | Tipo | Qué hace |
|---|---|---|
| `submitTransferOrder` | HTTPS | Crea el pedido tras subir el comprobante → ticket en `sin_validar`. |
| `requestQrTransfer` | HTTPS | Marca QRs como pendientes y crea la transferencia hacia un correo. |
| `acceptQrTransfer` | HTTPS | El destinatario acepta y los QRs pasan a su cuenta. |
| `syncTicketQrs` | Trigger RTDB | Mantiene `userQrs` (índice para *Mis entradas*). |
| `resendTicketQrEmail` | HTTPS | Reenvía el QR por correo (Resend, opcional). |

Se exponen vía Hosting en `/api/...` (ver `rewrites` de `firebase.json`).

### Variables de entorno (solo para el correo, opcional)

Las funciones leen `process.env`. Correo con Resend ([resend.com](https://resend.com)):

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | `re_...` |
| `RESEND_FROM` | `Festi <noreply@tudominio.com>` (dominio verificado) |

- **Local/emulador**: copia `functions/.env.example` a `functions/.env`.
- **Producción**: defínelas en Cloud Run (servicio de cada función) y vuelve a desplegar.
- Sin Resend, todo el flujo funciona; solo se desactiva el reenvío por correo.

## 4. Flujo de compra por transferencia

1. El organizador abre su evento → **Venta pública (transferencia Nequi / BRE-B)**:
   activa, fija precio, método y **número/llave** + titular, **Guardar** y **Copiar enlace** (`/comprar/...`).
2. El comprador entra al enlace, **inicia sesión**, indica cantidad y sus datos
   (autorrelleno si ya compró; los colaboradores marcan *“compro para otra persona”*).
3. Ve el total y el número, **transfiere**, **adjunta el pantallazo** y pulsa **Terminar compra**.
4. Se crean los QRs en estado **sin validar**.
5. El organizador entra al evento → **Pedidos por validar**, revisa el comprobante y pulsa
   **Verificar** (pasa a `pagado`) o **Rechazar** (`cancelado`).
6. En la puerta, el escáner **no deja ingresar** un QR `sin_validar`; solo entrega los `pagado`.

## 5. Comprobantes (liberar espacio)

- El admin los ve todos en `/admin` → *Comprobantes* (paginado de 10) y puede borrarlos.
- El organizador ve los de **su** evento en el evento → **🧾 Comprobantes** (paginado de 10) y puede borrarlos.
- Borrar elimina el archivo de **Storage** y el registro en la base de datos.

## 6. Despliegue

```bash
cd functions && npm install && cd ..
npm run deploy:all   # build + hosting + functions
```

O por partes: `npm run build`, `firebase deploy --only functions`, `firebase deploy --only hosting`.
Functions requiere plan **Blaze**.

## 7. Desarrollo local (Vite)

Las llamadas a `/api/...` no llegan a Functions desde `localhost:5173`. Opciones:

- Probar en **producción** tras desplegar, o
- En el `.env` del front: `VITE_API_BASE=http://127.0.0.1:5001/TU_PROJECT_ID/us-central1`
  y arrancar el emulador (`cd functions && npm run serve`).

---

**No subas** secretos al repositorio. Si expusiste una API key, regénerala y actualiza las variables.
