import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: Props) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center text-(--color-muted-foreground)">
          <Construction className="h-10 w-10" />
          <div className="text-sm">Bu sahifa keyingi bosqichda qo'shiladi</div>
        </CardContent>
      </Card>
    </div>
  );
}
