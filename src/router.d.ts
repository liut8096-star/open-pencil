import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    demo?: boolean
    public?: boolean
    requiresAuth?: boolean
  }
}
