# Ticket Free

Sistema de gestión de tickets para eventos con Firebase Realtime Database.

## Características

- 🔐 Autenticación con Google
- 🎪 Gestión de discotecas y eventos
- 🎫 Creación y gestión de tickets
- 📱 Generación de códigos QR únicos y seguros
- 📷 Lector de QR para validación de tickets
- 👥 Sistema de colaboradores
- 📊 Estados de tickets: pagado, entregado, cancelado
- 🖼️ Generación de imágenes de tickets para WhatsApp
- 🛒 **Página pública de compra** (`/comprar/...`) con Wompi (Cloud Functions) — ver `WOMPI_SETUP.md`

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

## Despliegue (Hosting + Functions / Wompi)

```bash
npm run deploy:all
```

Solo hosting: `npm run deploy`. Configuración Wompi: **`WOMPI_SETUP.md`**.

## Vista previa

```bash
npm run preview
```

## Uso

1. **Login**: Inicia sesión con Google
2. **Selección de Rol**: Elige entre Organizador o Colaborador
3. **Organizador**:
   - Crea discotecas
   - Crea eventos dentro de discotecas
   - Crea tickets para eventos
   - Agrega colaboradores a eventos
   - Lee QRs para validar tickets
4. **Colaborador**:
   - Ve eventos donde colabora
   - Crea tickets
   - Lee QRs para validar tickets

## Tecnologías

- Vue 3 (Composition API)
- Vite
- Firebase (Authentication, Realtime Database)
- Vue Router
- QRCode (generación de QRs)
- Html5Qrcode (lectura de QRs)

