import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import App from './App.vue';
import router from './router';
import i18n from './i18n';
import './styles/index.scss';

const app = createApp(App);

// 注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(createPinia());
app.use(router);
app.use(ElementPlus);
app.use(i18n);

// 初始化主题
const savedTheme = localStorage.getItem('promilia_axis_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// 全局异常捕获
app.config.errorHandler = (err, instance, info) => {
  console.error('全局错误:', err);
  console.error('错误信息:', info);

  // 显示错误提示
  ElMessage.error({
    message: '应用遇到错误，请刷新页面重试',
    duration: 5000,
  });
};

// 捕获未处理的 Promise 错误
window.addEventListener('unhandledrejection', event => {
  console.error('未处理的 Promise 错误:', event.reason);

  // 显示错误提示
  ElMessage.error({
    message: '操作失败，请重试',
    duration: 3000,
  });
});

app.mount('#app');
