import {createRouter, createWebHistory} from 'vue-router'

import {ensureAuthSession, useAuth} from '@/composables/use-auth'

import EditorView from './views/EditorView.vue'
import LoginView from './views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
      {path: '/login', component: LoginView, meta: {public: true}},
      {path: '/', component: EditorView, meta: {requiresAuth: true}},
      {path: '/demo', component: EditorView, meta: {demo: true, public: true}},
      {path: '/share/:roomId', component: EditorView, meta: {requiresAuth: true}}
  ]
})

router.beforeEach(async (to) => {
    const {authEnabled, status} = useAuth()
    if (!authEnabled) return true
    if (to.meta.public) {
        if (to.path === '/login' && status.value !== 'unauthenticated') {
            const authenticated = await ensureAuthSession()
            if (authenticated) {
                const next = typeof to.query.next === 'string' ? to.query.next : '/'
                return next
            }
        }
        return true
    }
    if (!to.meta.requiresAuth) return true
    const authenticated = await ensureAuthSession()
    if (authenticated) return true
    return {
        path: '/login',
        query: {next: to.fullPath}
    }
})

export default router
