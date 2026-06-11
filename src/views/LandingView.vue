<template>
  <div class="landing">
    <header class="hero">
      <div class="hero-inner">
        <h1 class="brand">Festi</h1>
        <p class="tagline">Los mejores eventos, una sola plataforma</p>
        <router-link to="/" class="login-link">Iniciar sesión</router-link>
      </div>
    </header>

    <main class="content">
      <h2 class="section-title">Próximos eventos</h2>

      <div v-if="loading" class="state">Cargando eventos…</div>

      <div v-else-if="eventos.length === 0" class="state">
        <p>No hay eventos publicados por ahora.</p>
        <p class="state-hint">Vuelve pronto 🎉</p>
      </div>

      <div v-else class="grid">
        <router-link
          v-for="ev in eventos"
          :key="ev.ownerUid + ev.eventoId"
          :to="`/comprar/${ev.ownerUid}/${ev.discotecaId}/${ev.eventoId}`"
          class="event-card"
        >
          <div class="event-top">
            <span class="event-badge">Evento</span>
          </div>
          <h3 class="event-name">{{ ev.nombre }}</h3>
          <p v-if="ev.nombreDiscoteca" class="event-disco">{{ ev.nombreDiscoteca }}</p>
          <p v-if="ev.fecha" class="event-meta">📅 {{ ev.fecha }}</p>
          <p v-if="ev.ubicacion" class="event-meta">📍 {{ ev.ubicacion }}</p>
          <p v-if="ev.descripcion" class="event-desc">{{ ev.descripcion }}</p>
          <p v-if="precio(ev)" class="event-price">Desde {{ precio(ev) }}</p>
          <span class="event-cta">Comprar entradas →</span>
        </router-link>
      </div>
    </main>

    <footer class="footer">
      <p>Creada por <strong>Brandon Ambuila</strong></p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { databaseService } from '../services/databaseService';

const eventos = ref([]);
const loading = ref(true);

function precio(ev) {
  const n = Number(ev.precioPorEntradaCOP);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n);
}

onMounted(async () => {
  try {
    eventos.value = await databaseService.getPublicHomeEvents();
  } catch (e) {
    console.error('Error cargando eventos:', e);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.landing {
  min-height: 100vh;
  background: #f5f6fa;
  display: flex;
  flex-direction: column;
}

.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 60px 20px 70px;
  text-align: center;
}

.hero-inner {
  max-width: 800px;
  margin: 0 auto;
}

.brand {
  font-size: 3rem;
  font-weight: 800;
  letter-spacing: -1px;
}

.tagline {
  margin-top: 10px;
  font-size: 1.1rem;
  opacity: 0.9;
}

.login-link {
  display: inline-block;
  margin-top: 24px;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  padding: 10px 24px;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.35);
}

.login-link:hover {
  background: rgba(255, 255, 255, 0.28);
}

.content {
  max-width: 1100px;
  margin: -40px auto 0;
  padding: 0 20px 40px;
  width: 100%;
  flex: 1;
}

.section-title {
  font-size: 1.5rem;
  color: #333;
  margin-bottom: 20px;
  text-align: center;
}

.state {
  text-align: center;
  padding: 50px 20px;
  color: #666;
  background: #fff;
  border-radius: 14px;
}

.state-hint {
  margin-top: 8px;
  color: #999;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.event-card {
  background: #fff;
  border-radius: 16px;
  padding: 22px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s, box-shadow 0.2s;
}

.event-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 28px rgba(102, 126, 234, 0.22);
}

.event-badge {
  display: inline-block;
  background: #eef1ff;
  color: #667eea;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 4px 10px;
  border-radius: 999px;
}

.event-name {
  font-size: 1.3rem;
  color: #222;
  margin: 12px 0 6px;
}

.event-disco {
  color: #667eea;
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 8px;
}

.event-meta {
  color: #666;
  font-size: 0.9rem;
  margin: 3px 0;
}

.event-desc {
  color: #888;
  font-size: 0.88rem;
  margin: 10px 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.event-price {
  color: #2d7a4d;
  font-weight: 700;
  margin: 8px 0;
}

.event-cta {
  margin-top: auto;
  padding-top: 12px;
  color: #667eea;
  font-weight: 700;
  font-size: 0.95rem;
}

.footer {
  text-align: center;
  padding: 24px;
  color: #999;
  font-size: 14px;
}

.footer strong {
  color: #667eea;
}

@media (max-width: 600px) {
  .brand {
    font-size: 2.2rem;
  }
  .hero {
    padding: 40px 20px 60px;
  }
}
</style>
