import QRCode from 'qrcode';

// Generar código seguro único
export function generateSecureCode() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}-${random2}`.toUpperCase();
}

// Generar QR como imagen base64
export async function generateQRCode(secureCode) {
  try {
    const qrDataURL = await QRCode.toDataURL(secureCode, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrDataURL;
  } catch (error) {
    console.error('Error generando QR:', error);
    throw error;
  }
}

// Generar imagen completa del ticket
export async function generateTicketImage(ticketData, qrDataURL) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Dimensiones del ticket
    canvas.width = 800;
    canvas.height = 1200;
    
    // Fondo blanco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Línea punteada para separar
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Sección superior (negro)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, 150);
    
    // Título del evento (blanco sobre negro)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(ticketData.eventoNombre || 'EVENTO', 20, 50);
    
    // Número de entrada (derecha, blanco)
    ctx.textAlign = 'right';
    ctx.font = '16px Arial';
    ctx.fillText('NÚM. DE ENTRADA', canvas.width - 20, 40);
    ctx.font = 'bold 20px Arial';
    ctx.fillText(ticketData.secureCode.substring(0, 15), canvas.width - 20, 65);
    
    // Cuerpo del ticket (izquierda)
    let yPos = 200;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    
    // Horario y ubicación
    ctx.font = 'bold 18px Arial';
    ctx.fillText('HORARIO Y UBICACIÓN', 20, yPos);
    yPos += 30;
    ctx.font = '16px Arial';
    ctx.fillText(ticketData.fecha || '', 20, yPos);
    yPos += 25;
    ctx.fillText(ticketData.ubicacion || '', 20, yPos);
    yPos += 40;
    
    // Tipo de entrada y precio
    ctx.font = 'bold 18px Arial';
    ctx.fillText('TIPO DE ENTRADA Y PRECIO', 20, yPos);
    yPos += 30;
    ctx.font = '16px Arial';
    ctx.fillText(ticketData.tipoEntrada || '', 20, yPos);
    yPos += 25;
    ctx.fillText(ticketData.precio || 'Gratis', 20, yPos);
    yPos += 25;
    // Cantidad de boletas
    const cantidadBoletas = ticketData.cantidadBoletas || 1;
    ctx.fillText(`Cantidad: ${cantidadBoletas} ${cantidadBoletas === 1 ? 'boleta' : 'boletas'}`, 20, yPos);
    yPos += 40;
    
    // Pedido por
    ctx.font = 'bold 18px Arial';
    ctx.fillText('PEDIDO POR', 20, yPos);
    yPos += 30;
    ctx.font = '16px Arial';
    ctx.fillText(ticketData.nombreCliente || '', 20, yPos);
    
    // Sección derecha (stub)
    const stubX = canvas.width / 2 + 20;
    yPos = 200;
    
    // Número de pedido
    ctx.font = 'bold 18px Arial';
    ctx.fillText('Pedido núm.', stubX, yPos);
    yPos += 30;
    ctx.font = '16px Arial';
    ctx.fillText(ticketData.secureCode.substring(0, 12), stubX, yPos);
    yPos += 40;
    
    // Estado del pago
    ctx.font = 'bold 18px Arial';
    ctx.fillText('Estado del pago', stubX, yPos);
    yPos += 30;
    ctx.font = '16px Arial';
    ctx.fillText(ticketData.estado || 'Pagado', stubX, yPos);
    yPos += 60;
    
    // QR Code
    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.drawImage(qrImg, stubX, yPos, 300, 300);
      
      // Fecha del pedido
      yPos += 350;
      ctx.font = 'bold 18px Arial';
      ctx.fillText('FECHA DEL PEDIDO', stubX, yPos);
      yPos += 30;
      ctx.font = '16px Arial';
      const fecha = new Date(ticketData.createdAt || Date.now());
      ctx.fillText(fecha.toLocaleDateString('es-ES'), stubX, yPos);
      
      // Convertir a imagen
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        resolve(url);
      }, 'image/png');
    };
    qrImg.src = qrDataURL;
  });
}

