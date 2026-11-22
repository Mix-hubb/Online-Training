import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    auth?: boolean;
    admin?: boolean;
    instructor?: boolean;
    partner?: boolean;
    layout?: 'public' | 'admin' | 'instructor' | 'partner';
  }
}
