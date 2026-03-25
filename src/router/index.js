import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('../views/Home.vue'),
    },
    {
      path: '/editor',
      name: 'Editor',
      component: () => import('../views/Editor.vue'),
    },
    {
      path: '/preset',
      name: 'Preset',
      component: () => import('../views/Preset.vue'),
    },
    {
      path: '/handbook',
      name: 'Handbook',
      component: () => import('../views/Handbook.vue'),
    },
    {
      path: '/guide',
      name: 'Guide',
      component: () => import('../views/Guide.vue'),
    },
    {
      path: '/data-editor',
      name: 'DataEditor',
      component: () => import('../views/DataEditor.vue'),
    },
  ],
});

export default router;
