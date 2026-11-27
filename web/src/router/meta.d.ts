import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    auth?: boolean;
    admin?: boolean;
    instructor?: boolean;
    partner?: boolean;
    /** Instructor route that also opens before the application is approved. */
    anyStatus?: boolean;
    layout?: 'public' | 'admin' | 'instructor' | 'partner';
  }
}
