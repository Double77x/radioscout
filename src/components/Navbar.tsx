import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Menu, X, ArrowUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { useNavbarScroll } from "@/hooks/use-navbar-scroll";
import { NAV_LINKS } from "@/data/navigation";
import { siteConfig } from "@/lib/site";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    scrolled,
    showScrollTop,
    activeFragment,
    refs: { topRef, scrollSentinelRef, middleSentinelRef },
    handleSmoothScroll: hookSmoothScroll,
    scrollToTop,
  } = useNavbarScroll();
  const location = useLocation();

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, to: string, id?: string) => {
    setIsOpen(false);
    hookSmoothScroll(e, to, id);
  };

  return (
    <>
      {/* Declarative sentinels — replace imperative document.createElement */}
      <div ref={scrollSentinelRef} aria-hidden className='pointer-events-none invisible absolute top-0 h-5 w-px' />
      <div ref={topRef} aria-hidden className='pointer-events-none invisible absolute top-0 h-25 w-px' />
      <div ref={middleSentinelRef} aria-hidden className='pointer-events-none invisible absolute top-0 h-1/2 w-px' />

      <div className='fixed inset-x-0 top-0 z-50'>
        {/* Floating glass dock — centered, detached from the top edge */}
        <div className='mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6 sm:pt-4 lg:px-8'>
          <nav
            className={cn(
              "relative z-10 flex h-14 items-center justify-between rounded-2xl border px-4 backdrop-blur-xl transition duration-300 sm:px-5 md:h-16",
              scrolled
                ? "border-border/70 bg-background/85 shadow-lg shadow-black/5 dark:shadow-black/25"
                : "border-border/40 bg-background/60",
            )}>
            {/* Logo Section */}
            <Link
              to='/'
              className='group flex shrink-0 items-center gap-2.5'
              onClick={(e) => handleSmoothScroll(e, "/", "")}>
              <Logo className='size-6.5 transition-transform duration-300 group-hover:scale-105' />
              <span className='text-base font-semibold tracking-tight text-foreground'>{siteConfig.name}</span>
            </Link>

            {/* Desktop segmented nav pill */}
            <div className='hidden items-center gap-1 rounded-full bg-surface-3/70 p-1 border-hairline-inset md:flex'>
              {NAV_LINKS.map((link) => {
                const isActive = link.id === undefined ? location.pathname === link.to : activeFragment === link.id;

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={(e) => handleSmoothScroll(e, link.to, link.id)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-medium transition duration-200",
                      isActive
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                    )}>
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Right Actions */}
            <div className='hidden items-center gap-1.5 md:flex'>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => globalThis.dispatchEvent(new Event("open-command-palette"))}
                className='size-9 rounded-full text-muted-foreground transition-colors hover:text-foreground'
                aria-label='Quick find'>
                <Search className='size-5' />
              </Button>

              <ThemeToggle />

              <Link to='/'>
                <Button
                  size='sm'
                  className='cursor-pointer rounded-full px-5 text-xs font-semibold shadow-lg shadow-primary/20'>
                  Listen
                </Button>
              </Link>
            </div>

            {/* Mobile Actions */}
            <div className='flex items-center gap-1.5 md:hidden'>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => globalThis.dispatchEvent(new Event("open-command-palette"))}
                className='size-9 rounded-full text-muted-foreground transition-colors hover:text-foreground'
                aria-label='Quick find'>
                <Search className='size-5' />
              </Button>

              <ThemeToggle />

              <Button
                variant='ghost'
                size='icon'
                onClick={() => setIsOpen(!isOpen)}
                className='size-9 rounded-full'
                aria-label={isOpen ? "Close menu" : "Open menu"}>
                {isOpen ? <X className='size-5' /> : <Menu className='size-5' />}
              </Button>
            </div>
          </nav>

          {/* Mobile glass dropdown */}
          {isOpen && (
            // oxlint-disable-next-line react-doctor/no-transition-all
            <div className='relative z-10 mt-2 rounded-2xl border border-border/60 bg-surface-1/95 p-2 shadow-xl shadow-black/5 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 md:hidden'>
              {NAV_LINKS.map((link) => {
                const isActive = link.id === undefined ? location.pathname === link.to : activeFragment === link.id;
                return (
                  <Link
                    key={link.to}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    to={link.to as any}
                    onClick={(e) => handleSmoothScroll(e, link.to, link.id)}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-medium transition-colors",
                      isActive ? "bg-primary/25 text-scout-pine" : "text-foreground hover:bg-surface-2",
                    )}>
                    {link.label}
                  </Link>
                );
              })}
              <div className='my-1 h-px bg-border' />
              <Link to='/'>
                <Button className='w-full rounded-xl' size='sm'>
                  Listen
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Scroll to Top Button */}
      <Button
        onClick={scrollToTop}
        className={cn(
          "fixed right-8 bottom-8 z-50 size-12 rounded-full shadow-lg transition duration-300",
          showScrollTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-10 opacity-0",
        )}
        size='icon'>
        <ArrowUp className='size-6' />
        <span className='sr-only'>Scroll to top</span>
      </Button>
    </>
  );
};

export default Navbar;
