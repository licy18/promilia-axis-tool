<template>
  <div class="app">
    <router-view />
  </div>
</template>

<script setup>
// App 根组件
</script>

<style scoped>
.app {
  width: 100vw;
  min-height: 100vh;
  background-color: var(--bg-color);
  color: var(--text-color);
  transition: var(--transition);
}
</style>
