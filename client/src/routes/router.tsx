import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/protected-route';
import { LoginPage } from '@/pages/login-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { PlaceholderPage } from '@/pages/placeholder-page';
import { NotFoundPage } from '@/pages/not-found-page';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <DashboardPage /> },
          {
            element: <ProtectedRoute roles={['super_admin']} />,
            children: [
              {
                path: '/companies',
                element: (
                  <PlaceholderPage
                    title="Kampaniyalar"
                    description="SaaS mijozlari, to'lov holati, qurilmalar"
                  />
                ),
              },
            ],
          },
          {
            path: '/users',
            element: (
              <PlaceholderPage
                title="Foydalanuvchilar"
                description="Admin va kampaniya egalari"
              />
            ),
          },
          {
            path: '/agents',
            element: (
              <PlaceholderPage
                title="Agentlar"
                description="Mahalliy bridge agentlari (Windows/RPI)"
              />
            ),
          },
          {
            path: '/devices',
            element: (
              <PlaceholderPage
                title="Qurilmalar"
                description="Hikvision FaceID terminallari"
              />
            ),
          },
          {
            path: '/persons',
            element: (
              <PlaceholderPage
                title="Hodimlar"
                description="Yuz, karta, PIN — kirish ruxsatlari"
              />
            ),
          },
          {
            path: '/schedules',
            element: (
              <PlaceholderPage
                title="Ish jadvali"
                description="Ish vaqti, kechikish chegarasi"
              />
            ),
          },
          {
            path: '/events',
            element: (
              <PlaceholderPage
                title="Hodisalar"
                description="Real vaqtda kirish/chiqish"
              />
            ),
          },
          {
            path: '/payroll',
            element: (
              <PlaceholderPage
                title="Mukofot va Jarima"
                description="Avtomatik va qo'lda hisob"
              />
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
