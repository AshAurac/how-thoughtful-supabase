import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { base44 } from '@/api/base44Client';

// Pages
import Dashboard from './pages/Dashboard';
import EventsList from './pages/EventsList';
import CreateEvent from './pages/CreateEvent';
import EventDetail from './pages/EventDetail';
import CapturePage from './pages/CapturePage';
import CalendarPage from './pages/CalendarPage';
import IdeasPage from './pages/IdeasPage';
import BudgetPage from './pages/BudgetPage';
import YearInGiving from './pages/YearInGiving';
import UpgradePage from './pages/UpgradePage';
import ProfilePage from './pages/ProfilePage';
import RecipientsPage from './pages/RecipientsPage';
import RecipientDetail from './pages/RecipientDetail';
import DeliveriesPage from './pages/DeliveriesPage';
import SavedIdeasPage from './pages/SavedIdeasPage';
import SeasonPage from './pages/SeasonPage';
import WishlistPage from './pages/WishlistPage';
import PublicWishlist from './pages/PublicWishlist';
import RestockPage from './pages/RestockPage';
import LandingPage from './pages/LandingPage';
import SharedListsPage from './pages/SharedListsPage';
import FamilyPage from './pages/FamilyPage';
import GroupManagePage from './pages/GroupManagePage';
import PublicGroupList from './pages/PublicGroupList';
import JoinEventPage from './pages/JoinEventPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import LoginPage from './pages/LoginPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';

// Layout
import AppShell from './components/AppShell';

// Redirects to login if user is not authenticated
const RequireAuth = ({ user, children }) => {
  if (!user) {
    base44.auth.redirectToLogin(window.location.href);
    return null;
  }
  return children;
};

function DarkModeSync() {
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.classList.toggle('dark', saved === 'dark');
      return;
    }
    // Fall back to system preference
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (dark) => document.documentElement.classList.toggle('dark', dark);
    apply(mq.matches);
    mq.addEventListener('change', e => apply(e.matches));
    return () => mq.removeEventListener('change', e => apply(e.matches));
  }, []);
  return null;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-sand-200 border-t-terracotta rounded-full animate-spin" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Public routes — no auth needed */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/w/:token" element={<PublicWishlist />} />
      <Route path="/group/:token" element={<PublicGroupList />} />
      <Route path="/join-event/:token" element={<JoinEventPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/welcome" element={<LandingPage />} />

      {/* Home: show landing if not authenticated, dashboard if authenticated */}
      <Route path="/" element={
        user
          ? <AppShell user={user}><Dashboard user={user} /></AppShell>
          : <LandingPage />
      } />

      {/* All authenticated pages — redirect to login if not authenticated */}
      <Route path="/events" element={<RequireAuth user={user}><AppShell user={user}><EventsList user={user} /></AppShell></RequireAuth>} />
      <Route path="/events/new" element={<RequireAuth user={user}><AppShell user={user}><CreateEvent /></AppShell></RequireAuth>} />
      <Route path="/events/:id" element={<RequireAuth user={user}><AppShell user={user}><EventDetail user={user} /></AppShell></RequireAuth>} />
      <Route path="/capture" element={<RequireAuth user={user}><AppShell user={user}><CapturePage user={user} /></AppShell></RequireAuth>} />
      <Route path="/calendar" element={<RequireAuth user={user}><AppShell user={user}><CalendarPage user={user} /></AppShell></RequireAuth>} />
      <Route path="/ideas" element={<RequireAuth user={user}><AppShell user={user}><IdeasPage user={user} /></AppShell></RequireAuth>} />
      <Route path="/budget" element={<RequireAuth user={user}><AppShell user={user}><BudgetPage user={user} /></AppShell></RequireAuth>} />
      <Route path="/year-in-giving" element={<RequireAuth user={user}><AppShell user={user}><YearInGiving user={user} /></AppShell></RequireAuth>} />
      <Route path="/upgrade" element={<RequireAuth user={user}><AppShell user={user}><UpgradePage user={user} /></AppShell></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth user={user}><AppShell user={user}><ProfilePage user={user} /></AppShell></RequireAuth>} />
      <Route path="/recipients" element={<RequireAuth user={user}><AppShell user={user}><RecipientsPage user={user} /></AppShell></RequireAuth>} />
      <Route path="/recipients/:id" element={<RequireAuth user={user}><AppShell user={user}><RecipientDetail user={user} /></AppShell></RequireAuth>} />
      <Route path="/deliveries" element={<RequireAuth user={user}><AppShell user={user}><DeliveriesPage user={user} /></AppShell></RequireAuth>} />
      <Route path="/saved" element={<RequireAuth user={user}><AppShell user={user}><SavedIdeasPage user={user} /></AppShell></RequireAuth>} />
      <Route path="/season" element={<RequireAuth user={user}><AppShell user={user}><SeasonPage user={user} /></AppShell></RequireAuth>} />
      <Route path="/wishlist" element={<RequireAuth user={user}><AppShell user={user}><WishlistPage user={user} /></AppShell></RequireAuth>} />
      <Route path="/restock" element={<RequireAuth user={user}><AppShell user={user}><RestockPage /></AppShell></RequireAuth>} />
      <Route path="/group-lists" element={<RequireAuth user={user}><AppShell user={user}><SharedListsPage /></AppShell></RequireAuth>} />
      <Route path="/family" element={<RequireAuth user={user}><AppShell user={user}><FamilyPage user={user} /></AppShell></RequireAuth>} />
      <Route path="/group-manage/:id" element={<RequireAuth user={user}><AppShell user={user}><GroupManagePage /></AppShell></RequireAuth>} />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <DarkModeSync />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
