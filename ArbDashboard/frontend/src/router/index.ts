import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'
import Dashboard from '../views/Dashboard.vue'

/**
 * 懒加载 LazyMode.vue
 * - 开源版没有 private/ 目录，直接指向锁页
 * - 如需私有插件，在 private/LazyMode.vue 放置后取消下面注释：
 *   const LazyMode = () => import('../private/LazyMode.vue')
 */
const LazyMode = () => import('../views/DongGeSecret.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: MainLayout,
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: Dashboard
        },
        {
          path: 'analysis',
          name: 'Analysis',
          component: () => import('../views/Analysis.vue')
        },
        {
          path: 'auto-trade',
          name: 'AutoTrade',
          component: () => import('../views/AutoTrade.vue')
        },
        {
          path: 'data',
          name: 'Data',
          component: () => import('../views/Data.vue')
        },
        {
          path: 'ledger',
          name: 'Ledger',
          component: () => import('../views/Ledger.vue')
        },
        {
          path: 'settings',
          name: 'Settings',
          component: () => import('../views/Settings.vue')
        },
        {
          path: 'etf-rotation',
          name: 'ETFRotation',
          component: () => import('../views/ETFRotation.vue')
        },
        {
          path: 'lazymode',
          name: 'LazyMode',
          component: LazyMode
        },
        {
          path: 'developing',
          name: 'Developing',
          component: () => import('../views/Developing.vue')
        }
      ]
    }
  ]
})

export default router
