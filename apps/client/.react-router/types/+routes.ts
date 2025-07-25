// Generated by React Router

import "react-router"

declare module "react-router" {
  interface Register {
    pages: Pages
    routeFiles: RouteFiles
  }
}

type Pages = {
  "/": {
    params: {};
  };
  "/:threadId?": {
    params: {
      "threadId"?: string;
    };
  };
  "/*": {
    params: {
      "*": string;
    };
  };
};

type RouteFiles = {
  "root.tsx": {
    id: "root";
    page: "/" | "/:threadId?" | "/*";
  };
  "./layouts/home.tsx": {
    id: "layouts/home";
    page: "/:threadId?" | "/*";
  };
  "routes/home.tsx": {
    id: "routes/home";
    page: "/:threadId?";
  };
  "routes/not-found.tsx": {
    id: "routes/not-found";
    page: "/*";
  };
};