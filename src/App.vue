<template>
  <div id="app">
    <router-view />
    <footer class="app-footer">
      <p>Creada por <strong>Brandon Ambuila</strong></p>
    </footer>
  </div>
</template>

<script setup>
// App principal con router
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background-color: #f5f5f5;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-footer {
  margin-top: auto;
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 14px;
  background: transparent;
}

.app-footer p {
  margin: 0;
}

.app-footer strong {
  color: #667eea;
  font-weight: 600;
}

/* Responsive */
@media (max-width: 768px) {
  .app-footer {
    padding: 15px;
    font-size: 13px;
  }
}
</style>

