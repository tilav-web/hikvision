import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="text-center">
        <div className="text-6xl font-bold tracking-tight text-(--color-muted-foreground)">
          404
        </div>
        <p className="mt-3 text-lg">Sahifa topilmadi</p>
        <Button asChild className="mt-6">
          <Link to="/">Bosh sahifaga qaytish</Link>
        </Button>
      </div>
    </div>
  );
}
