import { ReactNode } from 'react';
import { Header } from './Header';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>{children}</main>
      <footer className="border-t border-border/50 bg-card py-8 mt-16">
        <div className="container text-center text-muted-foreground">
          <p className="font-display text-lg text-foreground mb-2">Savory</p>
          <p className="text-sm">Your personal recipe companion for delicious home cooking</p>
        </div>
      </footer>
    </div>
  );
}
