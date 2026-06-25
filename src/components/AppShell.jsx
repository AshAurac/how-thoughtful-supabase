import { Link, useLocation, useNavigate } from 'react-router-dom';
// navigate kept for tab switching logic below
import { Home, Calendar, PlusCircle, MoreHorizontal, Settings, Users, PiggyBank, Package, Bookmark, Star, User, Gift } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import MoreSheet from './MoreSheet';
import PageTransition from './PageTransition';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/calendar', icon: Calendar, label: 'Calendar' },
  { path: '/capture', icon: PlusCircle, label: 'Capture' },
  { path: '/recipients', icon: Users, label: 'People' },
];

// All "More" drawer paths — show brand logo on these too
const MORE_PATHS = ['/budget', '/deliveries', '/saved', '/group-lists', '/family', '/wishlist', '/season', '/year-in-giving', '/profile', '/upgrade', '/ideas'];

// Root-level paths — show brand logo on these
const ROOT_PATHS = ['/', '/calendar', '/capture', '/recipients', '/ideas', '/season', '/upgrade', ...MORE_PATHS];

// Page title map for sub-pages
const PAGE_TITLES = {
  '/events/new': 'New Occasion',
  '/capture': 'Capture',
  '/upgrade': 'Upgrade',
  '/year-in-giving': 'Year in Giving',
};

// More drawer items (mirrors MoreSheet)
const MORE_ITEMS = [
  { path: '/budget', icon: PiggyBank, label: 'Budget' },
  { path: '/deliveries', icon: Package, label: 'Deliveries' },
  { path: '/saved', icon: Bookmark, label: 'Ideas' },
  { path: '/group-lists', icon: Gift, label: 'Groups' },
  { path: '/family', icon: Users, label: 'Family' },
  { path: '/wishlist', icon: Star, label: 'Wishlist' },
  { path: '/year-in-giving', icon: Star, label: 'Year' },
  { path: '/profile', icon: User, label: 'Profile' },
];

function getSubPageTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/events/') && pathname !== '/events') return 'Occasion';
  if (pathname.startsWith('/recipients/')) return 'Person';
  if (pathname.startsWith('/group-manage/')) return 'Manage List';
  return null;
}

function isRootPath(pathname) {
  return ROOT_PATHS.includes(pathname);
}

// Determine which tab root a given pathname belongs to
function getActiveTab(pathname) {
  if (pathname === '/') return '/';
  for (const { path } of navItems) {
    if (path !== '/' && pathname.startsWith(path)) return path;
  }
  return '/';
}

// Find if current path is a "More" drawer item
function getActiveMoreItem(pathname) {
  return MORE_ITEMS.find(item => pathname === item.path || pathname.startsWith(item.path + '/')) || null;
}

export default function AppShell({ children, user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);
  // Track the last-visited path within each tab so switching back restores it
  const tabHistory = useRef({});

  const firstName = user?.full_name?.split(' ')[0] || 'there';
  const activeTab = getActiveTab(location.pathname);
  const subPageTitle = getSubPageTitle(location.pathname);
  const isRoot = isRootPath(location.pathname);
  const activeMoreItem = getActiveMoreItem(location.pathname);

  // Keep tabHistory up to date whenever the location changes
  tabHistory.current[activeTab] = location.pathname;

  const handleNavClick = useCallback((path, e) => {
    e.preventDefault();
    if (location.pathname === path) {
      // Already on root — scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (activeTab === path) {
      // On a sub-page of this tab — go back to tab root
      navigate(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Switching to a different tab — restore last path in that tab, or root
      const dest = tabHistory.current[path] || path;
      navigate(dest);
    }
  }, [location.pathname, activeTab, navigate]);

  return (
    <div
      className="min-h-screen bg-background"
      style={{ paddingBottom: 'calc(5rem + var(--safe-bottom))' }}
    >
      {/* Top bar — safe area top */}
      <header
        className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border select-none"
        style={{ paddingTop: 'var(--safe-top)', paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
      >
        <div className="max-w-3xl mx-auto relative flex items-center justify-between px-4 py-3 md:py-4">
          {isRoot ? (
            <>
              <Link
                to="/"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity min-h-[44px]"
                onClick={e => handleNavClick('/', e)}
              >
                <img src="https://media.base44.com/images/public/6a1188b0e669a81e5b3530ea/5247e49c3_RealLogo.png" alt="How Thoughtful" className="w-8 h-8" />
                <span className="font-heading font-bold text-foreground text-sm md:text-base">How Thoughtful</span>
              </Link>
              <div className="flex items-center gap-2">
                <Link
                  to="/profile"
                  className="flex items-center gap-1.5 min-h-[44px] px-2 rounded-full hover:bg-muted transition-all group"
                >
                  <span className="font-accent text-lg md:text-xl text-muted-foreground group-hover:text-foreground transition-colors">hi, {firstName}</span>
                  <Settings className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
              </div>
            </>
          ) : (
            <>
              <Link
                to="/"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity min-h-[44px]"
              >
                <img src="https://media.base44.com/images/public/6a1188b0e669a81e5b3530ea/5247e49c3_RealLogo.png" alt="How Thoughtful" className="w-8 h-8" />
                <span className="font-heading font-bold text-foreground text-sm md:text-base">How Thoughtful</span>
              </Link>
              <div className="w-10" />
            </>
          )}
        </div>
      </header>

      {/* Main content — overscroll none */}
      <main
        className="max-w-3xl mx-auto px-4 py-6 md:py-10 overscroll-none"
        style={{ paddingLeft: 'calc(1rem + var(--safe-left))', paddingRight: 'calc(1rem + var(--safe-right))' }}
      >
        <PageTransition>
          {children}
        </PageTransition>
      </main>

      {/* Bottom nav — safe area bottom */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 select-none"
        style={{ paddingBottom: 'var(--safe-bottom)', paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
      >
        <div className="flex justify-center pb-3 pt-1">
          <div className="bg-card/90 backdrop-blur-xl border border-border rounded-full px-3 py-1.5 shadow-lg flex items-center gap-0.5">
            {/* Home always first */}
            {(() => {
              const { path, icon: Icon, label } = navItems[0];
              const active = activeTab === path && !activeMoreItem;
              return (
                <button
                  key={path}
                  onClick={e => handleNavClick(path, e)}
                  className={`flex flex-col items-center px-3 min-w-[56px] min-h-[44px] justify-center rounded-full transition-all select-none ${
                    active ? 'bg-terracotta text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs mt-0.5 font-body">{label}</span>
                </button>
              );
            })()}

            {/* 2nd slot: active More item OR the normal 2nd nav item */}
            {activeMoreItem ? (
              <button
                onClick={e => handleNavClick(activeMoreItem.path, e)}
                className="flex flex-col items-center px-3 min-w-[56px] min-h-[44px] justify-center rounded-full transition-all select-none bg-terracotta text-white"
              >
                <activeMoreItem.icon className="w-5 h-5" />
                <span className="text-xs mt-0.5 font-body">{activeMoreItem.label}</span>
              </button>
            ) : (
              (() => {
                const { path, icon: Icon, label } = navItems[1];
                const active = activeTab === path;
                return (
                  <button
                    key={path}
                    onClick={e => handleNavClick(path, e)}
                    className={`flex flex-col items-center px-3 min-w-[56px] min-h-[44px] justify-center rounded-full transition-all select-none ${
                      active ? 'bg-terracotta text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs mt-0.5 font-body">{label}</span>
                  </button>
                );
              })()
            )}

            {/* Remaining nav items (3rd and 4th) */}
            {navItems.slice(2).map(({ path, icon: Icon, label }) => {
              const active = activeTab === path;
              return (
                <button
                  key={path}
                  onClick={e => handleNavClick(path, e)}
                  className={`flex flex-col items-center px-3 min-w-[56px] min-h-[44px] justify-center rounded-full transition-all select-none ${
                    active ? 'bg-terracotta text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs mt-0.5 font-body">{label}</span>
                </button>
              );
            })}

            <button
              data-nav="more"
              onClick={() => setShowMore(true)}
              className={`flex flex-col items-center px-3 min-w-[56px] min-h-[44px] justify-center rounded-full transition-all select-none ${
                activeMoreItem ? 'text-terracotta' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-xs mt-0.5 font-body">More</span>
            </button>
          </div>
        </div>
      </nav>

      <MoreSheet open={showMore} onClose={() => setShowMore(false)} />
    </div>
  );
}
