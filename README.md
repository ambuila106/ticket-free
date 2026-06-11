# Ticket Free / Festi

Sistema de gestión de tickets para eventos con Firebase Realtime Database.

## Características

- 🔐 Autenticación con Google
- 🛡️ **Panel de administración** (`/admin`): gestiona usuarios, activa/desactiva el rol organizador, controla qué eventos salen en la landing y borra comprobantes.
- 🌐 **Landing pública** (`/eventos`) con los eventos próximos que el admin decide mostrar.
- 🎪 Gestión de discotecas y eventos
- 🎫 Creación y gestión de tickets
- 💸 **Compra por transferencia manual** (Nequi / BRE-B): el comprador transfiere, sube el comprobante y sus QRs quedan `sin_validar` hasta que el organizador verifica el pago.
- 🎟️ **Mis entradas** (`/mis-qrs`): el cliente ve sus QRs y los **transfiere** a otro usuario por correo (con aceptación del destinatario).
- 📱 Generación de códigos QR únicos y seguros
- 📷 Lector de QR (no deja ingresar QRs `sin_validar`)
- 👥 Roles: administrador, organizador, colaborador y cliente
- 📊 Estados de tickets: `sin_validar`, `pagado`, `entregado`, `cancelado`
- 🖼️ Generación de imágenes de tickets para WhatsApp

> Configuración completa (roles, reglas, funciones y flujo de pago): **`SETUP.md`**.

## Estructura de Datos

La aplicación usa Firebase Realtime Database con la siguiente estructura:
```
correo/
  discotecas/
    discotecaId/
      eventos/
        eventoId/
          tickets/
            ticketId/
          colaboradores/
            colaboradorEmail/
```

## Instalación

```bash
npm install
```

## Configuración de Firebase

1. Asegúrate de tener configurado Firebase Authentication con Google
2. Habilita Firebase Realtime Database en tu proyecto
3. Configura las reglas de seguridad según tus necesidades

## Desarrollo

```bash
npm run dev
```

## Construcción

```bash
npm run build
```

## Despliegue (Hosting + Functions)

```bash
npm run deploy:all
```

Solo hosting: `npm run deploy`. Configuración completa: **`SETUP.md`**.

## Vista previa

```bash
npm run preview
```

## Uso

1. **Login**: Inicia sesión con Google.
2. **Selección de rol** (`/select-role`): según permisos verás Administrador, Organizador (si el admin lo activó), Colaborador y *Mis entradas*.
3. **Administrador** (`/admin`):
   - Activa/desactiva el rol organizador por usuario (ve cuántas veces ha entrado cada uno).
   - Muestra u oculta eventos en la landing (`/eventos`).
   - Ve y borra todos los comprobantes (paginado de 10).
4. **Organizador**:
   - Crea discotecas, eventos y tickets; agrega colaboradores.
   - Configura la **venta pública** (precio + número de Nequi/BRE-B) y comparte el enlace `/comprar/...`.
   - Revisa **Pedidos por validar** y verifica/rechaza transferencias.
   - Ve y borra los comprobantes de su evento.
5. **Colaborador**: vende a terceros (sin autorrelleno de datos del cliente).
6. **Cliente** (`/mis-qrs`): ve, descarga y transfiere sus QRs; acepta los que le envían.

## Tecnologías

- Vue 3 (Composition API)
- Vite
- Firebase (Authentication, Realtime Database, Storage, Cloud Functions v2)
- Vue Router
- QRCode (generación de QRs)
- Html5Qrcode (lectura de QRs)

