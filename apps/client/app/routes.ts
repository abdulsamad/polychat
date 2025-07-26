import { type RouteConfig, layout, route } from '@react-router/dev/routes';

export default [
  layout('./layouts/home.tsx', [
    route('/:threadId?', 'routes/home.tsx'),
    route('/*', 'routes/not-found.tsx'), // Fix for dev server error
  ]),
] satisfies RouteConfig;
