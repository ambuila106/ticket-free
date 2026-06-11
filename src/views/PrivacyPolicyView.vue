<template>
  <main class="privacy-page">
    <article class="privacy-content">
      <p class="page-label">Política de Privacidad - Festi</p>
      <h1>Política de Privacidad de Festi</h1>
      <p class="updated-at">Última actualización: 28 de marzo de 2026</p>

      <p>
        En Festi valoramos tu privacidad. Esta Política de Privacidad describe cómo tratamos la
        información cuando usas nuestra aplicación móvil.
      </p>

      <section>
        <h2>1. Información que recopilamos</h2>
        <p>Festi puede procesar información técnica mínima necesaria para el funcionamiento de la app, como:</p>
        <ul>
          <li>Datos básicos del dispositivo y sistema operativo.</li>
          <li>Registros técnicos de uso y errores (si aplica).</li>
          <li>Información necesaria para conectarse a servicios externos enlazados desde la app.</li>
        </ul>
        <p>Festi no vende datos personales.</p>
      </section>

      <section>
        <h2>2. Uso de la información</h2>
        <p>La información se utiliza únicamente para:</p>
        <ul>
          <li>Proveer y mejorar el funcionamiento de la aplicación.</li>
          <li>Detectar y corregir errores técnicos.</li>
          <li>Mantener seguridad y estabilidad del servicio.</li>
        </ul>
      </section>

      <section>
        <h2>3. Servicios de terceros</h2>
        <p>
          La aplicación puede interactuar con servicios de terceros (por ejemplo, Google Play y enlaces
          externos abiertos por el usuario). Estos terceros pueden tratar datos conforme a sus propias
          políticas de privacidad.
        </p>
      </section>

      <section>
        <h2>4. Compartición de datos</h2>
        <p>
          No compartimos datos personales con terceros para fines comerciales. Solo se comparte
          información cuando sea necesario para operar la app o por obligación legal.
        </p>
      </section>

      <section>
        <h2>5. Seguridad</h2>
        <p>
          Aplicamos medidas razonables para proteger la información procesada por la app. Sin embargo,
          ningún sistema es 100% seguro.
        </p>
      </section>

      <section>
        <h2>6. Privacidad de menores</h2>
        <p>
          Festi no está dirigida intencionalmente a menores de 13 años. Si detectamos recolección no
          intencional de datos de menores, tomaremos medidas para eliminarlos.
        </p>
      </section>

      <section>
        <h2>7. Derechos y contacto</h2>
        <p>
          Si tienes dudas, solicitudes o quieres ejercer derechos sobre tus datos, contáctanos en:
        </p>
        <p>
          Correo:
          <a href="mailto:ambuila106@gmail.com">ambuila106@gmail.com</a>
        </p>
      </section>

      <section>
        <h2>8. Cambios a esta política</h2>
        <p>
          Podemos actualizar esta Política de Privacidad ocasionalmente. Publicaremos cualquier cambio
          en esta misma página con su fecha de actualización.
        </p>
      </section>
    </article>
  </main>
</template>

<style scoped>
.privacy-page {
  width: 100%;
  padding: 20px 16px 40px;
}

.privacy-content {
  margin: 0 auto;
  max-width: 900px;
  line-height: 1.65;
  font-size: 1rem;
  color: #111;
}

.page-label {
  margin-bottom: 8px;
  font-size: 0.95rem;
}

h1 {
  font-size: 1.6rem;
  margin-bottom: 8px;
  color: #111;
}

.updated-at {
  margin-bottom: 20px;
  font-size: 0.95rem;
}

section + section {
  margin-top: 20px;
}

h2 {
  font-size: 1.1rem;
  margin-bottom: 8px;
  color: #111;
}

p {
  margin-bottom: 10px;
  color: #111;
}

ul {
  padding-left: 22px;
  margin-bottom: 10px;
}

li + li {
  margin-top: 6px;
}

a {
  color: #111;
  font-weight: 600;
}

@media (min-width: 601px) {
  .privacy-page {
    padding: 28px 28px 48px;
  }

  .privacy-content {
    font-size: 1.04rem;
  }

  h1 {
    font-size: 1.9rem;
  }

  h2 {
    font-size: 1.25rem;
  }
}

@media (min-width: 1265px) {
  .privacy-page {
    padding: 36px 42px 56px;
  }

  .privacy-content {
    font-size: 1.08rem;
  }

  h1 {
    font-size: 2.1rem;
  }
}
</style>
