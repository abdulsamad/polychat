import React from 'react';
import { Link } from 'react-router';

const NotFound: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-5xl font-bold text-primary mb-4">404</h1>
      <p className="text-lg text-muted-foreground mb-6">
        Sorry, the page you are looking for does not exist.
      </p>
      <Link
        to="/"
        className="inline-block px-6 py-2 bg-primary text-secondary rounded-md hover:bg-primary/90 transition">
        Go Home
      </Link>
    </div>
  );
};

export default NotFound;
