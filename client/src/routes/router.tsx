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
import { PersonDetailPage } from '@/pages/person-detail-page';
import { SchedulesPage } from '@/pages/schedules-page';
import { EventsPage } from '@/pages/events-page';
import { AttendancePage } from '@/pages/attendance-page';
import { PayrollPage } from '@/pages/payroll-page';
import { ProfilePage } from '@/pages/profile-page';
import { HolidaysPage } from '@/pages/holidays-page';
import { VacationsPage } from '@/pages/vacations-page';
import { StatisticsPage } from '@/pages/statistics-page';
import { TelegramChannelsPage } from '@/pages/telegram-channels-page';
import { AuditLogsPage } from '@/pages/audit-logs-page';
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
          { path: '/profile', element: <ProfilePage /> },
          // Super admin only
          {
            element: <ProtectedRoute roles={['super_admin']} />,
            children: [
              { path: '/companies', element: <CompaniesPage /> },
              { path: '/users', element: <UsersPage /> },
            ],
          },
          // Both roles (server scope's by company_id)
          { path: '/agents', element: <AgentsPage /> },
          { path: '/devices', element: <DevicesPage /> },
          { path: '/persons', element: <PersonsPage /> },
          { path: '/persons/:id', element: <PersonDetailPage /> },
          { path: '/attendance', element: <AttendancePage /> },
          { path: '/statistics', element: <StatisticsPage /> },
          { path: '/events', element: <EventsPage /> },
          { path: '/audit-logs', element: <AuditLogsPage /> },
          { path: '/telegram-channels', element: <TelegramChannelsPage /> },
          // Company admin only — kampaniya ichki ish
          {
            element: <ProtectedRoute roles={['company_admin']} />,
            children: [
              { path: '/schedules', element: <SchedulesPage /> },
              { path: '/holidays', element: <HolidaysPage /> },
              { path: '/vacations', element: <VacationsPage /> },
              { path: '/payroll', element: <PayrollPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
