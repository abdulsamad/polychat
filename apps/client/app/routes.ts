import { type RouteConfig, layout, route } from '@react-router/dev/routes';

export default [
  layout('./layouts/home.tsx', [
    // Static routes rank above the dynamic thread route, so /compare is never a thread id.
    route('/compare', 'routes/compare.tsx'),
    route('/:threadId?', 'routes/home.tsx'),
    route('/*', 'routes/not-found.tsx'), // Fix for dev server error
  ]),
] satisfies RouteConfig;
