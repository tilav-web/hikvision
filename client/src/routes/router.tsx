import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/protected-route';
import { LoginPage } from '@/pages/login-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { CompaniesPage } from '@/pages/companies-page';
import { UsersPage } from '@/pages/users-page';
import { AgentsPage } from '@/pages/agents-page';
import { DevicesPage } from '@/pages/devices-page';
import { PersonsPage } from '@/pages/persons-page';
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
            children: [{ path: '/companies', element: <CompaniesPage /> }],
          },
          { path: '/users', element: <UsersPage /> },
          { path: '/agents', element: <AgentsPage /> },
          { path: '/devices', element: <DevicesPage /> },
          { path: '/persons', element: <PersonsPage /> },
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
